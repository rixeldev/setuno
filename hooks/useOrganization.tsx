import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  fetchMember,
  fetchOrganization,
  subscribeMyInvitations,
  subscribeMyOrganizations,
  subscribeOrganization,
} from "@/services/organizations"
import { updateUserProfile } from "@/services/users"
import { toFriendlyError } from "@/services/errors"
import type {
  Invitation,
  Organization,
  OrganizationMember,
  OrganizationRef,
  OrganizationRole,
} from "@/interfaces"
import { useAuth } from "@/hooks/useAuth"

export type SessionState = "loading" | "ready" | "needs-organization"

interface OrganizationContextValue {
  state: SessionState
  organizations: OrganizationRef[]
  organization: Organization | null
  member: OrganizationMember | null
  role: OrganizationRole | null
  isAdmin: boolean
  organizationId: string | null
  invitations: Invitation[]
  /** Set when the invitations query failed (e.g. rules not deployed yet). */
  invitationsError: string | null
  switchOrganization: (organizationId: string) => Promise<void>
  refresh: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

/** The band document + membership, tagged with the band they were loaded for. */
interface OrganizationDetail {
  id: string | null
  organization: Organization | null
  member: OrganizationMember | null
}

const EMPTY_DETAIL: OrganizationDetail = { id: null, organization: null, member: null }
const NO_ORGANIZATIONS: OrganizationRef[] = []
const NO_INVITATIONS: Invitation[] = []

/**
 * Resolves which organization the user is currently working in, exposes their
 * role, and gates the app until they join or create one (onboarding).
 *
 * Everything that can be computed is derived during render — the active band,
 * whether the list has loaded and the current band document — so switching bands
 * is instant and there are no "state that lags one effect behind" flashes.
 */
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const uid = user?.uid ?? null
  const email = profile?.email || user?.email || null

  const [bandRefs, setBandRefs] = useState<OrganizationRef[]>(NO_ORGANIZATIONS)
  // Which user the list above belongs to, so a sign-out never leaks stale bands.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrganizationDetail>(EMPTY_DETAIL)
  const [invites, setInvites] = useState<Invitation[]>(NO_INVITATIONS)
  const [invitesError, setInvitesError] = useState<string | null>(null)

  const loaded = uid !== null && loadedFor === uid
  const organizations = loaded ? bandRefs : NO_ORGANIZATIONS

  // 1. The band to work in: the explicit choice if it is still one of the user's
  // bands, otherwise the profile preference, otherwise the first band.
  const preferred = profile?.activeOrganizationId ?? null
  const activeIdResolved =
    organizations.length === 0
      ? null
      : activeId !== null && organizations.some((band) => band.id === activeId)
        ? activeId
        : preferred !== null && organizations.some((band) => band.id === preferred)
          ? preferred
          : (organizations[0]?.id ?? null)

  // 2. Only surface the band document/membership that belongs to the active band.
  const organization = detail.id === activeIdResolved ? detail.organization : null
  const member = detail.id === activeIdResolved ? detail.member : null

  // 3. Pending invitations addressed to this user, surfaced in the band
  // switcher even when they already belong to a band (multi-band membership).
  const invitations = uid !== null ? invites : NO_INVITATIONS

  // 4. Live list of the bands the user belongs to.
  useEffect(() => {
    if (!uid) return
    return subscribeMyOrganizations(uid, (items) => {
      setBandRefs(items)
      setLoadedFor(uid)
    })
  }, [uid])

  // 5. Load the active band document + the caller's membership.
  useEffect(() => {
    if (!activeIdResolved || !uid) return
    let cancelled = false
    void Promise.all([
      fetchOrganization(activeIdResolved),
      fetchMember(activeIdResolved, uid),
    ]).then(([nextOrganization, nextMember]) => {
      if (!cancelled) setDetail({ id: activeIdResolved, organization: nextOrganization, member: nextMember })
    })
    return () => {
      cancelled = true
    }
  }, [activeIdResolved, uid])

  // 6. Live updates for the band document (name/logo/description).
  useEffect(() => {
    if (!activeIdResolved) return
    return subscribeOrganization(activeIdResolved, (next) => {
      setDetail((current) => ({
        ...current,
        id: activeIdResolved,
        organization: next,
        member: current.id === activeIdResolved ? current.member : null,
      }))
    })
  }, [activeIdResolved])

  // 7. Pending invitations addressed to this user (join flow), always live so
  // an invite can be accepted whether or not the user already has a band.
  useEffect(() => {
    if (!uid || !email) return
    return subscribeMyInvitations(
      email,
      (items) => {
        setInvites(items)
        setInvitesError(null)
      },
      (error) =>
        setInvitesError(toFriendlyError(error, "We couldn't check your invitations.")),
    )
  }, [uid, email])

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      setActiveId(organizationId)
      if (uid) {
        await updateUserProfile(uid, { activeOrganizationId: organizationId })
      }
    },
    [uid],
  )

  const refresh = useCallback(async () => {
    if (!activeIdResolved || !uid) return
    const [nextOrganization, nextMember] = await Promise.all([
      fetchOrganization(activeIdResolved),
      fetchMember(activeIdResolved, uid),
    ])
    setDetail({ id: activeIdResolved, organization: nextOrganization, member: nextMember })
  }, [activeIdResolved, uid])

  const state: SessionState = !loaded
    ? "loading"
    : organizations.length === 0
      ? "needs-organization"
      : "ready"

  const value = useMemo<OrganizationContextValue>(
    () => ({
      state,
      organizations,
      organization,
      member,
      role: member?.role ?? null,
      isAdmin: member?.role === "admin",
      organizationId: activeIdResolved,
      invitations,
      invitationsError: invitesError,
      switchOrganization,
      refresh,
    }),
    [
      state,
      organizations,
      organization,
      member,
      invitations,
      invitesError,
      activeIdResolved,
      switchOrganization,
      refresh,
    ],
  )

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error("useOrganization must be used inside an OrganizationProvider")
  return context
}