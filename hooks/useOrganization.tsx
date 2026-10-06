import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  fetchMember,
  fetchOrganization,
  subscribeMember,
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
  /** Set when the band list could not be read (the UI offers a retry). */
  organizationsError: string | null
  switchOrganization: (organizationId: string) => Promise<void>
  refresh: () => Promise<void>
  retryOrganizations: () => void
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
/** Backoff attempts before a dropped listener surfaces an error to the UI. */
const BANDS_RETRIES = 4
/** How long to wait for the server before offering a retry instead of a spinner. */
const BANDS_SERVER_DEADLINE_MS = 10000

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
  const [bandsError, setBandsError] = useState<string | null>(null)
  const bandsRetryRef = useRef<(() => void) | null>(null)

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

  // 4. Live list of the bands the user belongs to. A dropped listener is
  // retried with backoff, and a cache-only empty snapshot never counts as an
  // answer: only a load that truly finished may surface the onboarding screen.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    let attempts = 0
    let unsubscribe: () => void = () => undefined
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let slowTimer: ReturnType<typeof setTimeout> | null = null

    const listen = (): void => {
      unsubscribe()
      if (slowTimer) {
        clearTimeout(slowTimer)
        slowTimer = null
      }
      unsubscribe = subscribeMyOrganizations(
        uid,
        (items, fromCache) => {
          if (cancelled) return
          attempts = 0
          if (slowTimer) {
            clearTimeout(slowTimer)
            slowTimer = null
          }
          setBandsError(null)
          setBandRefs(items)
          // Wait for the server snapshot when the cache has nothing: the user
          // may belong to bands this device has never seen. If the server does
          // not answer, surface a retry instead of an endless spinner.
          if (!fromCache || items.length > 0) {
            setLoadedFor(uid)
          } else {
            slowTimer = setTimeout(() => {
              if (cancelled) return
              setBandsError(
                toFriendlyError(
                  undefined,
                  "Your bands are taking longer than expected. Try again.",
                ),
              )
            }, BANDS_SERVER_DEADLINE_MS)
          }
        },
        (error) => {
          if (cancelled) return
          attempts += 1
          if (attempts <= BANDS_RETRIES) {
            retryTimer = setTimeout(listen, Math.min(800 * 2 ** (attempts - 1), 8000))
            return
          }
          setBandsError(toFriendlyError(error, "We couldn't load your bands."))
          // Keep the app usable with whatever we have; the dashboard offers a
          // retry instead of pretending the user has no band.
          setLoadedFor(uid)
        },
      )
    }

    bandsRetryRef.current = () => {
      attempts = 0
      if (retryTimer) clearTimeout(retryTimer)
      setBandsError(null)
      listen()
    }

    listen()
    return () => {
      cancelled = true
      bandsRetryRef.current = null
      if (retryTimer) clearTimeout(retryTimer)
      if (slowTimer) clearTimeout(slowTimer)
      unsubscribe()
    }
  }, [uid])

  // 5. Live band document + the caller's membership. Subscriptions are
  // cache-first, so on a warm start the name and role are instant; the member
  // listener is re-created on failure to cover the offline-first race right
  // after accepting an invitation (the cache shows the new membership before
  // the server has committed and rules-approved the batch).
  useEffect(() => {
    if (!activeIdResolved || !uid) return
    const organizationId = activeIdResolved
    let cancelled = false
    let attempts = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let unsubscribeOrganization: () => void = () => undefined
    let unsubscribeMember: () => void = () => undefined

    const listen = (): void => {
      unsubscribeOrganization()
      unsubscribeMember()
      unsubscribeOrganization = subscribeOrganization(organizationId, (nextOrganization) => {
        if (cancelled) return
        setDetail((current) => ({
          id: organizationId,
          organization: nextOrganization,
          member: current.id === organizationId ? current.member : null,
        }))
      })
      unsubscribeMember = subscribeMember(
        organizationId,
        uid,
        (nextMember) => {
          if (cancelled) return
          attempts = 0
          setDetail((current) => ({
            id: organizationId,
            organization: current.id === organizationId ? current.organization : null,
            member: nextMember,
          }))
        },
        () => {
          if (cancelled) return
          attempts += 1
          if (attempts <= BANDS_RETRIES) {
            retryTimer = setTimeout(listen, Math.min(1200 * 2 ** (attempts - 1), 6000))
          }
        },
      )
    }

    listen()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      unsubscribeOrganization()
      unsubscribeMember()
    }
  }, [activeIdResolved, uid])

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

  const retryOrganizations = useCallback(() => {
    setBandsError(null)
    setLoadedFor(null)
    bandsRetryRef.current?.()
  }, [])

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
      organizationsError: bandsError,
      switchOrganization,
      refresh,
      retryOrganizations,
    }),
    [
      state,
      organizations,
      organization,
      member,
      invitations,
      invitesError,
      bandsError,
      activeIdResolved,
      switchOrganization,
      refresh,
      retryOrganizations,
    ],
  )

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error("useOrganization must be used inside an OrganizationProvider")
  return context
}