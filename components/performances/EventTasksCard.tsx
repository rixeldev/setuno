import React, { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { useToast } from "@/components/ui/Toast"
import { CheckCircleIcon, ListIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons"
import type { ChecklistTemplate, EventTask, OrganizationMember } from "@/interfaces"
import { CHECKLIST_KIND_KEYS } from "@/interfaces/checklist"
import { TASK_TITLE_MAX } from "@/libs/eventLogistics"
import {
  createEventTask,
  deleteEventTask,
  toggleEventTask,
  updateEventTask,
} from "@/services/eventLogistics"
import { attachChecklistToEvent } from "@/services/checklists"
import { useChecklists } from "@/hooks/useChecklists"
import { toFriendlyError } from "@/services/errors"

interface EventTasksCardProps {
  organizationId: string
  performanceId: string
  /** Live task list from `useEventTasks` (roadmap #47), already sorted. */
  tasks: EventTask[]
  members: OrganizationMember[]
  currentUid: string
  isAdmin: boolean
  /**
   * Roadmap #59: a guest reads this list but the rules deny them the writes
   * (create, toggle, edit, assign, attach), so every affordance that would
   * fail is withheld rather than shown and rejected.
   */
  canWrite: boolean
}

/**
 * "Who brings what" (roadmap #47): one row per thing, ticked live by whoever
 * has their hands on the list — every member writes them, logistics is not an
 * admin job. Tapping the title rewrites it, tapping the assignee chip reassigns
 * it (the bottom sheet is the repo's short-picker pattern), and only the
 * creator or an admin gets the delete button, behind its usual confirmation.
 * Its footer also stamps a band checklist onto the event (roadmap #49): one
 * task document per item in a single batch — exactly this card's own shape.
 */
export function EventTasksCard({
  organizationId,
  performanceId,
  tasks,
  members,
  currentUid,
  isAdmin,
  canWrite,
}: EventTasksCardProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const { lists: checklists, loading: checklistsLoading } = useChecklists(organizationId)

  const [busy, setBusy] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [dialog, setDialog] = useState<
    { mode: "add" } | { mode: "edit"; task: EventTask } | null
  >(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<EventTask | null>(null)
  const [assignTarget, setAssignTarget] = useState<EventTask | null>(null)

  const nameOf = (uid: string): string =>
    members.find((member) => member.uid === uid)?.displayName ?? ""

  const run = async (action: Promise<void>, fallback: string, done?: () => void) => {
    setBusy(true)
    try {
      await action
      done?.()
    } catch (error) {
      toast.showError(toFriendlyError(error, fallback))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Stamps a checklist onto the event (roadmap #49): the batch is #47's own
   * task shape, so the sheet closes, `run` owns the busy flag and the toast
   * reports how many rows landed (or why none did).
   */
  const attach = (list: ChecklistTemplate) => {
    setAttachOpen(false)
    run(
      attachChecklistToEvent(organizationId, performanceId, list).then((count) => {
        toast.showSuccess(t("checklists.attached", { count }))
      }),
      t("checklists.couldNotAttach"),
    )
  }

  const submitDialog = () => {
    const fallback = t("performances.taskError")
    if (dialog?.mode === "edit") {
      const task = dialog.task
      run(
        updateEventTask(organizationId, performanceId, task.id, { title: draftTitle }),
        fallback,
        () => {
          setDialog(null)
          toast.showSuccess(t("performances.taskSaved"))
        },
      )
    } else {
      run(
        createEventTask(organizationId, performanceId, {
          title: draftTitle,
          assignedTo: "",
        }),
        fallback,
        () => {
          setDialog(null)
          toast.showSuccess(t("performances.taskSaved"))
        },
      )
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("performances.tasks")}</AppText>

      {tasks.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {t("performances.taskEmpty")}
        </AppText>
      ) : null}

      {tasks.map((task) => {
        const assignee = task.assignedTo ? nameOf(task.assignedTo) : ""
        const canDelete = canWrite && (task.createdBy === currentUid || isAdmin)
        return (
          <View key={task.id} style={styles.row}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.done }}
              accessibilityLabel={task.title}
              hitSlop={Theme.hitSlop}
              disabled={busy || !canWrite}
              onPress={() =>
                run(
                  toggleEventTask(organizationId, performanceId, task),
                  t("performances.taskError"),
                )
              }
              style={styles.tick}
            >
              {task.done ? (
                <CheckCircleIcon size={22} color={Theme.colors.primary} />
              ) : (
                <View style={styles.tickEmpty} />
              )}
            </Pressable>

            <Pressable
              style={styles.rowBody}
              disabled={busy || !canWrite}
              onPress={() => {
                setDraftTitle(task.title)
                setDialog({ mode: "edit", task })
              }}
              accessibilityRole="button"
              accessibilityLabel={t("performances.taskEditTitle")}
            >
              <AppText
                variant={task.done ? "caption" : "body"}
                tone={task.done ? "muted" : "default"}
                numberOfLines={2}
                style={task.done ? styles.doneTitle : undefined}
              >
                {task.title}
              </AppText>
            </Pressable>

            <Chip
              size="sm"
              label={assignee || t("performances.taskAnyone")}
              tone={assignee ? "primary" : "default"}
              disabled={busy || !canWrite}
              onPress={() => setAssignTarget(task)}
              accessibilityLabel={t("performances.taskAssignTo")}
            />

            {canDelete ? (
              <IconButton
                icon={<TrashIcon size={16} color={Theme.colors.textMuted} />}
                onPress={() => setDeleteTarget(task)}
                label={t("common.delete")}
              />
            ) : null}
          </View>
        )
      })}

      {canWrite ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            label={t("performances.taskAdd")}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
            disabled={busy}
            style={styles.action}
            onPress={() => {
              setDraftTitle("")
              setDialog({ mode: "add" })
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            label={t("checklists.attachButton")}
            icon={<ListIcon size={18} color={Theme.colors.text} />}
            disabled={busy}
            style={styles.action}
            onPress={() => setAttachOpen(true)}
          />
        </View>
      ) : null}

      <Dialog
        visible={dialog !== null}
        onClose={() => setDialog(null)}
        title={t(dialog?.mode === "edit" ? "performances.taskEditTitle" : "performances.taskAddTitle")}
        confirmLabel={
          t(dialog?.mode === "edit" ? "common.save" : "performances.taskAdd")
        }
        confirmLoading={busy}
        confirmDisabled={draftTitle.trim().length === 0}
        onConfirm={submitDialog}
      >
        <Input
          label={t("performances.taskTitleField")}
          placeholder={t("performances.taskTitlePlaceholder")}
          value={draftTitle}
          onChangeText={setDraftTitle}
          maxLength={TASK_TITLE_MAX}
          returnKeyType="done"
        />
      </Dialog>

      <BottomSheet
        visible={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        title={t("performances.taskAssignTo")}
      >
        <SheetOptionRow
          label={t("performances.taskAnyone")}
          selected={assignTarget?.assignedTo === ""}
          onPress={() => {
            const task = assignTarget
            setAssignTarget(null)
            if (task) {
              run(
                updateEventTask(organizationId, performanceId, task.id, {
                  assignedTo: "",
                }),
                t("performances.taskError"),
              )
            }
          }}
        />
        {members.map((member) => (
          <SheetOptionRow
            key={member.uid}
            label={member.displayName}
            hint={member.email}
            selected={assignTarget?.assignedTo === member.uid}
            onPress={() => {
              const task = assignTarget
              setAssignTarget(null)
              if (task) {
                run(
                  updateEventTask(organizationId, performanceId, task.id, {
                    assignedTo: member.uid,
                  }),
                  t("performances.taskError"),
                )
              }
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        title={t("checklists.attachSheet")}
      >
        {checklistsLoading ? <AppText tone="muted">{t("checklists.attachLoading")}</AppText> : null}

        {!checklistsLoading && checklists.length === 0 ? (
          <AppText tone="muted">{t("checklists.attachEmpty")}</AppText>
        ) : null}

        {checklists.map((list) => (
          <SheetOptionRow
            key={list.id}
            label={list.name}
            hint={`${t(CHECKLIST_KIND_KEYS[list.kind])} · ${t("checklists.itemsCount", {
              count: list.items.length,
            })}`}
            onPress={() => attach(list)}
          />
        ))}

        <SheetOptionRow
          label={t(checklists.length === 0 ? "checklists.newChecklist" : "checklists.manage")}
          onPress={() => {
            setAttachOpen(false)
            router.push(checklists.length === 0 ? "/checklists/new" : "/checklists")
          }}
        />
      </BottomSheet>

      <Dialog
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        tone="danger"
        title={t("performances.taskDeleteTitle", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        confirmLoading={busy}
        onConfirm={() => {
          const task = deleteTarget
          setDeleteTarget(null)
          if (task) {
            run(
              deleteEventTask(organizationId, performanceId, task.id),
              t("performances.taskError"),
              () => toast.showSuccess(t("performances.taskDeleted")),
            )
          }
        }}
      />
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    rowBody: { flex: 1, minWidth: 0, gap: 2 },
    tick: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    tickEmpty: {
      width: 20,
      height: 20,
      borderRadius: Theme.radii.pill,
      borderWidth: 1.5,
      borderColor: Theme.colors.border,
    },
    doneTitle: { textDecorationLine: "line-through" },
    actions: { flexDirection: "row", gap: Theme.spacing.s },
    action: { flex: 1 },
  })
