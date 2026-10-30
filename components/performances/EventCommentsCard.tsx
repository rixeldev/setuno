import React from "react"
import { useTranslation } from "react-i18next"

import { Card } from "@/components/ui/Card"
import { CommentThread } from "@/components/comments/CommentThread"
import { useEventComments } from "@/hooks/useEventComments"
import { createEventComment, deleteEventComment } from "@/services/eventComments"
import type { CommentEntry, OrganizationMember } from "@/interfaces"

interface EventCommentsCardProps {
  organizationId: string
  performanceId: string
  /** Denormalised into the activity line the comment writes. */
  performanceName: string
  currentUid: string
  isAdmin: boolean
  author: { id: string; name: string }
  members: readonly OrganizationMember[]
}

/**
 * The event's discussion thread (roadmap #90): the band talks about the night
 * — the call time, the load-in, who is driving — right on the event, with
 * `@mentions` that push like a suggestion's. Members only, exactly like the
 * rules: a guest reads the event but never its conversation (#59).
 */
export function EventCommentsCard({
  organizationId,
  performanceId,
  performanceName,
  currentUid,
  isAdmin,
  author,
  members,
}: EventCommentsCardProps) {
  const { t } = useTranslation()
  const { comments, loading, error } = useEventComments(organizationId, performanceId)

  return (
    <Card>
      <CommentThread
        title={t("performances.commentsTitle")}
        emptyText={t("performances.commentsEmpty")}
        comments={comments}
        loading={loading}
        error={error}
        currentUid={currentUid}
        isAdmin={isAdmin}
        author={author}
        members={members}
        onSend={async (body) => {
          await createEventComment(organizationId, performanceId, body, author, performanceName)
        }}
        onDelete={async (comment: CommentEntry) => {
          await deleteEventComment(organizationId, performanceId, comment.id)
        }}
      />
    </Card>
  )
}
