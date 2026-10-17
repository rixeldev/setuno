import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Skeleton } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { AtIcon, TrashIcon } from "@/components/ui/Icons"
import { MentionText } from "@/components/suggestions/MentionText"
import { useSuggestionComments } from "@/hooks/useSuggestionComments"
import {
  createSuggestionComment,
  deleteSuggestionComment,
} from "@/services/suggestionComments"
import { sanitizeCommentBody } from "@/libs/suggestionComments"
import { canCollaborate } from "@/libs/membership"
import { appendMention } from "@/functions/src/mentions"
import { toFriendlyError } from "@/services/errors"
import { formatRelativeTime } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import type { OrganizationMember, SuggestionComment } from "@/interfaces"

/**
 * The suggestion's discussion thread (roadmap #55): every member may write,
 * removal is a tombstone ("comment removed") so the conversation keeps its
 * shape for everyone, and only the author or an admin ever sees the delete
 * control — which always asks first.
 *
 * Since roadmap #58 the composer can mention a bandmate: the @ button opens
 * the roster and inserts `@handle `, handles light up in every posted
 * comment, and the push that fires from the mention is derived by the same
 * parser (`functions/src/mentions.ts`) this screen renders with. Guests are
 * filtered out of the roster twice over — they cannot open this thread at
 * all, so a mention they would never see must not resolve.
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
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { comments, loading, error } = useSuggestionComments(organizationId, suggestionId)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SuggestionComment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)

  const roster = useMemo(
    () =>
      members
        .filter((member) => canCollaborate(member.role))
        .map((member) => ({ uid: member.uid, displayName: member.displayName })),
    [members],
  )
  // A solo band has nobody to mention — not even a ping to yourself.
  const mentionable = roster.filter((entry) => entry.uid !== author.id)

  const canSend = !sending && sanitizeCommentBody(draft) !== null

  const send = async (): Promise<void> => {
    if (!organizationId || !canSend) return
    setSending(true)
    try {
      await createSuggestionComment(organizationId, suggestionId, draft, author, songTitle)
      setDraft("")
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("suggestions.commentsSendError")))
    } finally {
      setSending(false)
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!organizationId || !pendingDelete) return
    setDeleting(true)
    try {
      await deleteSuggestionComment(organizationId, suggestionId, pendingDelete.id)
      setPendingDelete(null)
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("suggestions.commentsDeleteError")))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View style={styles.block}>
      <AppText variant="label" tone="faint">
        {t("suggestions.commentsTitle")}
      </AppText>

      {loading ? (
        <View style={styles.loading}>
          <Skeleton height={14} width="38%" />
          <Skeleton height={36} />
          <Skeleton height={14} width="28%" />
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger">
          {toFriendlyError(error, t("suggestions.commentsError"))}
        </AppText>
      ) : null}

      {!loading && !error && comments.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {t("suggestions.commentsEmpty")}
        </AppText>
      ) : null}

      {comments.map((comment) => {
        const canRemove =
          comment.deletedAt === null && (comment.authorId === currentUid || isAdmin)
        return (
          <View key={comment.id} style={styles.comment}>
            <View style={styles.commentHead}>
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.commentAuthor}>
                {comment.authorName}
              </AppText>
              <AppText variant="caption" tone="faint">
                {formatRelativeTime(toDate(comment.createdAt))}
              </AppText>
              {canRemove ? (
                <IconButton
                  icon={<TrashIcon size={16} color={Theme.colors.textFaint} />}
                  label={t("suggestions.commentsDeleteAction")}
                  size={28}
                  onPress={() => setPendingDelete(comment)}
                  style={styles.commentRemove}
                />
              ) : null}
            </View>
            {comment.deletedAt !== null ? (
              <AppText variant="caption" tone="faint" style={styles.removed}>
                {t("suggestions.commentsRemoved")}
              </AppText>
            ) : (
              <MentionText body={comment.body} members={roster} />
            )}
          </View>
        )
      })}

      <View style={styles.composer}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder={t("suggestions.commentsPlaceholder")}
          multiline
          containerStyle={styles.composerField}
        />
        {mentionable.length > 0 ? (
          <IconButton
            icon={<AtIcon size={18} color={Theme.colors.text} />}
            label={t("suggestions.mentionMember")}
            size={28}
            onPress={() => setMentionOpen(true)}
            style={styles.mentionButton}
          />
        ) : null}
        <Button
          label={t("suggestions.commentsSend")}
          variant="secondary"
          size="sm"
          disabled={!canSend}
          loading={sending}
          onPress={() => void send()}
        />
      </View>

      <BottomSheet
        visible={mentionOpen}
        onClose={() => setMentionOpen(false)}
        title={t("suggestions.mentionMember")}
      >
        {mentionable.map((member) => (
          <SheetOptionRow
            key={member.uid}
            label={member.displayName}
            onPress={() => {
              setMentionOpen(false)
              setDraft((current) => appendMention(current, member.displayName))
            }}
          />
        ))}
      </BottomSheet>

      <Dialog
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("suggestions.commentsDeleteTitle")}
        description={t("suggestions.commentsDeleteDescription")}
        confirmLabel={t("common.delete")}
        tone="danger"
        confirmLoading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    block: { gap: Theme.spacing.s },
    loading: { gap: Theme.spacing.xs },
    comment: { gap: 4, paddingVertical: Theme.spacing.xs },
    commentHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    commentAuthor: { flexShrink: 1 },
    commentRemove: { marginLeft: "auto" },
    removed: { fontStyle: "italic" },
    composer: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.s,
      marginTop: Theme.spacing.xs,
    },
    composerField: { flex: 1 },
    mentionButton: { marginTop: 2 },
  })
