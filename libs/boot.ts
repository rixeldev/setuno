import type { AuthStatus } from "@/hooks/useAuth"
import type { SessionState } from "@/hooks/useOrganization"

export interface BootStateInput {
  authStatus: AuthStatus
  organizationState: SessionState
  /** True while the active band's first data slice is still in flight. */
  organizationDataLoading: boolean
}

/**
 * The app has finished loading when the session is resolved: auth settled, the
 * band list loaded (when signed in) and, if there is an active band, its first
 * data slice already in memory. `StartupGate` uses this to decide when the
 * animated splash can fade into the app.
 */
export const isBootResolved = ({
  authStatus,
  organizationState,
  organizationDataLoading,
}: BootStateInput): boolean => {
  if (authStatus === "initializing") return false
  if (authStatus === "signed-out") return true
  if (organizationState === "loading") return false
  if (organizationState === "needs-organization") return true
  return !organizationDataLoading
}
