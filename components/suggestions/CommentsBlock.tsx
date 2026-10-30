import React from "react"
import { useTranslation } from "react-i18next"

import { CommentThread } from "@/components/comments/CommentThread"
import { useSuggestionComments } from "@/hooks/useSuggestionComments"
import {
  createSuggestionComment,
  deleteSuggestionComment,
} from "@/services/suggestionComments"
import type { CommentEntry, OrganizationMember } from "@/interfaces"

/**
 * The suggestion's discussion thread (roadmap #55): the data layer for one
 * suggestion, rendered by the shared `CommentThread` the event comments use
 * too (roadmap #90). Every member may write; removal is a tombstone so the
 * conversation keeps its shape for everyone.
 */
export function CommentsBlock({
  organizationId,
  suggestionId,
  songTitle,
  currentUid,
  isAdmin,
  author,
  members,
}: {
  organizationId: string | null
  suggestionId: string
  songTitle: string
  currentUid: string
  isAdmin: boolean
  author: { id: string; name: string }
  /** Live band roster from `useOrgData` — drives the @ picker and the highlights. */
  members: OrganizationMember[]
}) {
  const { t } = useTranslation()
  const { comments, loading, error } = useSuggestionComments(organizationId, suggestionId)

  return (
    <CommentThread
      title={t("suggestions.commentsTitle")}
      emptyText={t("suggestions.commentsEmpty")}
      comments={comments}
      loading={loading}
      error={error}
      currentUid={currentUid}
      isAdmin={isAdmin}
      author={author}
      members={members}
      onSend={async (body) => {
        if (!organizationId) return
        await createSuggestionComment(organizationId, suggestionId, body, author, songTitle)
      }}
      onDelete={async (comment: CommentEntry) => {
        if (!organizationId) return
        await deleteSuggestionComment(organizationId, suggestionId, comment.id)
      }}
    />
  )
}
