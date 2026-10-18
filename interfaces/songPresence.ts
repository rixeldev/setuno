/**
 * One editor's heartbeat dot while the song editor is open (roadmap #28).
 * Soft information only: it may warn that somebody else is in there, and it
 * never locks anyone out.
 */
export interface SongPresence {
  /** The editor's uid — also the document id, pinned by the rules. */
  uid: string
  /** How the band knows them: the same display name the roster shows. */
  displayName: string
  /**
   * Client-clock moment of the last heartbeat — client time on purpose, the
   * #47 tasks precedent: freshness is judged offline, and a `serverTimestamp`
   * would read null while a write queues.
   */
  updatedAt: Date
}
