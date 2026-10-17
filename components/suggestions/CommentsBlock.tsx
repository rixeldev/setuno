import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { Skeleton } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { TrashIcon } from "@/components/ui/Icons"
import { useSuggestionComments } from "@/hooks/useSuggestionComments"
import {
  createSuggestionComment,
  deleteSuggestionComment,
} from "@/services/suggestionComments"
import { sanitizeCommentBody } from "@/libs/suggestionComments"
import { toFriendlyError } from "@/services/errors"
import { formatRelativeTime } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import type { SuggestionComment } from "@/interfaces"

/**
 * The suggestion's discussion thread (roadmap #55): every member may write,
 * removal is a tombstone ("comment removed") so the conversation keeps its
 * shape for everyone, and only the author or an admin ever sees the delete
 * control — which always asks first.
 */
export function CommentsBlock({
  organizationId,
  suggestionId,
  songTitle,
  currentUid,
  isAdmin,
  author,
}: {
  organizationId: string | null
  suggestionId: string
  songTitle: string
  currentUid: string
  isAdmin: boolean
  author: { id: string; name: string }
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { comments, loading, error } = useSuggestionComments(organizationId, suggestionId)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SuggestionComment | null>(null)
  const [deleting, setDeleting] = useState(false)

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
              <AppText variant="body">{comment.body}</AppText>
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
        <Button
          label={t("suggestions.commentsSend")}
          variant="secondary"
          size="sm"
          disabled={!canSend}
          loading={sending}
          onPress={() => void send()}
        />
      </View>

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
  })
