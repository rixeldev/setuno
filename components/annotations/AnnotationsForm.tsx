import React, { useEffect, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { DiscardChangesDialog } from "@/components/app/DiscardChangesDialog"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useAnnotations } from "@/hooks/useAnnotations"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { subscribeSong } from "@/services/songs"
import { saveAnnotations } from "@/services/annotations"
import { toFriendlyError } from "@/services/errors"
import {
  ANNOTATION_MARKERS_LIMIT,
  addMarker,
  canAddMarker,
  clampAnnotationNotes,
  markerAnchorLabel,
  markerPlacements,
  removeMarker,
  sortMarkerPlacements,
  updateMarkerText,
} from "@/libs/annotations"
import { sectionLabelFor } from "@/libs/songUtils"
import {
  ChevronRightIcon,
  EditIcon,
  NoteIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import type { AnnotationMarker, Song, SongSection } from "@/interfaces"

interface AnnotationsFormProps {
  songId: string
  songTitle: string
}

interface Draft {
  songId: string
  notes: string
  markers: AnnotationMarker[]
}

type ComposerStep = { kind: "section" } | { kind: "line"; sectionIndex: number }

interface NoteDialogState {
  mode: "create" | "edit"
  markerId?: string
  sectionId?: string
  lineIndex?: number
}

/**
 * Editor for the reader's personal annotations of one song (roadmap #3):
 * free-form notes plus inline notes anchored to a section and line. Everything
 * stays under `users/{uid}/annotations/{songId}` — the band's song document is
 * never touched. Presented as a modal over the reader.
 */
export function AnnotationsForm({ songId, songTitle }: AnnotationsFormProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { songLibrary } = useOrgData()

  const [song, setSong] = useState<Song | null>(songLibrary.get(songId) ?? null)
  // Live song: the anchor labels follow edits made by an admin.
  useEffect(() => subscribeSong(organizationId, songId, setSong), [organizationId, songId])

  const snapshot = useAnnotations(profile?.uid ?? null, songId)

  // Seed the draft once per song, the moment the stored annotation arrives
  // (adjust state while rendering, as documented by React).
  const [draft, setDraft] = useState<Draft | null>(null)
  if ((!draft || draft.songId !== songId) && snapshot) {
    setDraft({ songId, notes: snapshot.notes, markers: snapshot.markers })
  }

  const [saving, setSaving] = useState(false)
  const [composer, setComposer] = useState<ComposerStep | null>(null)
  const [noteDialog, setNoteDialog] = useState<NoteDialogState | null>(null)
  const [noteText, setNoteText] = useState("")
  const [noteError, setNoteError] = useState<string | null>(null)
  const [removeMarkerId, setRemoveMarkerId] = useState<string | null>(null)

  const differsFromSnapshot = (): boolean => {
    if (!draft || !snapshot) return false
    if (draft.notes !== snapshot.notes) return true
    if (draft.markers.length !== snapshot.markers.length) return true
    return draft.markers.some((marker, index) => {
      const stored = snapshot.markers[index]
      return (
        !stored ||
        stored.id !== marker.id ||
        stored.sectionId !== marker.sectionId ||
        stored.lineIndex !== marker.lineIndex ||
        stored.text !== marker.text
      )
    })
  }
  const hasUnsavedChanges = !saving && differsFromSnapshot()
  const leaveGuard = useUnsavedChanges(hasUnsavedChanges)

  const sections = song?.sections ?? []
  const placements = sortMarkerPlacements(
    draft ? markerPlacements(draft.markers, sections) : [],
  )
  const canAdd = draft !== null && canAddMarker(draft.markers)

  const save = async (): Promise<void> => {
    if (!profile?.uid || !draft) return
    setSaving(true)
    try {
      await saveAnnotations(profile.uid, songId, { notes: draft.notes, markers: draft.markers })
      toast.showSuccess(t("annotations.saved"))
      router.back()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("annotations.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  const openCreate = (sectionId: string, lineIndex: number): void => {
    setNoteDialog({ mode: "create", sectionId, lineIndex })
    setNoteText("")
    setNoteError(null)
    setComposer(null)
  }

  const openEdit = (marker: AnnotationMarker): void => {
    setNoteDialog({ mode: "edit", markerId: marker.id })
    setNoteText(marker.text)
    setNoteError(null)
  }

  const confirmNote = (): void => {
    if (!noteDialog || !draft) return
    const text = noteText.trim()
    if (text.length === 0) {
      setNoteError(t("annotations.noteRequired"))
      return
    }
    setDraft(
      noteDialog.mode === "create"
        ? {
            ...draft,
            markers: addMarker(draft.markers, {
              sectionId: noteDialog.sectionId ?? "",
              lineIndex: noteDialog.lineIndex ?? -1,
              text,
            }),
          }
        : { ...draft, markers: updateMarkerText(draft.markers, noteDialog.markerId ?? "", text) },
    )
    setNoteDialog(null)
  }

  const confirmRemove = (): void => {
    if (!removeMarkerId || !draft) return
    setDraft({ ...draft, markers: removeMarker(draft.markers, removeMarkerId) })
    setRemoveMarkerId(null)
  }

  return (
    <ModalScreen title={t("annotations.personalNotes")} subtitle={songTitle}>
      <Card style={styles.card}>
        {draft === null ? (
          <AppText variant="caption" tone="faint">
            {t("common.loading")}
          </AppText>
        ) : (
          <Input
            label={t("annotations.notesFieldLabel")}
            value={draft.notes}
            onChangeText={(value) => setDraft({ ...draft, notes: clampAnnotationNotes(value) })}
            placeholder={t("annotations.notesPlaceholder")}
            multiline
          />
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <AppText variant="label" tone="faint">
            {t("annotations.inlineNotes")}
          </AppText>
          {draft !== null && draft.markers.length > 0 ? (
            <AppText variant="caption" tone="faint">
              {t("annotations.count", { count: draft.markers.length })}
            </AppText>
          ) : null}
        </View>

        {placements.map(({ marker }) => (
          <View key={marker.id} style={styles.markerRow}>
            <View style={styles.flex}>
              <AppText variant="caption" tone="accent" numberOfLines={1}>
                {markerAnchorLabel(marker, sections, t)}
              </AppText>
              <AppText variant="body" numberOfLines={2}>
                {marker.text}
              </AppText>
            </View>
            <View style={styles.markerActions}>
              <IconButton
                label={t("annotations.editNoteA11y")}
                size={36}
                onPress={() => openEdit(marker)}
                icon={<EditIcon size={16} color={Theme.colors.textMuted} />}
              />
              <IconButton
                label={t("annotations.deleteNoteA11y")}
                size={36}
                variant="danger"
                onPress={() => setRemoveMarkerId(marker.id)}
                icon={<TrashIcon size={16} color={Theme.colors.danger} />}
              />
            </View>
          </View>
        ))}

        {draft !== null && draft.markers.length === 0 ? (
          <AppText variant="caption" tone="faint">
            {t("annotations.emptyMarkers")}
          </AppText>
        ) : null}

        {draft !== null && !canAddMarker(draft.markers) ? (
          <AppText variant="caption" tone="faint">
            {t("annotations.maxMarkers", { count: ANNOTATION_MARKERS_LIMIT })}
          </AppText>
        ) : null}

        <Button
          label={t("annotations.addInlineNote")}
          variant="secondary"
          icon={<PlusIcon size={15} color={Theme.colors.text} />}
          disabled={!canAdd || sections.length === 0}
          onPress={() => setComposer({ kind: "section" })}
        />

        {composer ? (
          <Composer
            sections={sections}
            step={composer}
            onPickSection={(sectionIndex) => setComposer({ kind: "line", sectionIndex })}
            onBackToSections={() => setComposer({ kind: "section" })}
            onCreate={openCreate}
          />
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button
          label={t("common.cancel")}
          variant="ghost"
          onPress={() => router.back()}
          style={styles.action}
        />
        <Button
          label={t("common.save")}
          onPress={() => void save()}
          loading={saving}
          disabled={draft === null}
          style={styles.action}
        />
      </View>

      <Dialog
        visible={noteDialog !== null}
        onClose={() => setNoteDialog(null)}
        title={t("annotations.noteDialogTitle")}
        description={noteDialog?.mode === "edit" ? t("annotations.editNote") : t("annotations.addNote")}
        confirmLabel={noteDialog?.mode === "edit" ? t("annotations.saveNote") : t("annotations.addNote")}
        confirmDisabled={noteText.trim().length === 0}
        onConfirm={confirmNote}
      >
        <Input
          label={t("annotations.yourNote")}
          value={noteText}
          onChangeText={(value) => {
            setNoteText(value)
            setNoteError(null)
          }}
          placeholder={t("annotations.notePlaceholder")}
          error={noteError}
          multiline
        />
      </Dialog>

      <Dialog
        visible={removeMarkerId !== null}
        onClose={() => setRemoveMarkerId(null)}
        title={t("annotations.deleteNoteConfirm")}
        description={t("annotations.deleteNoteDescription")}
        confirmLabel={t("annotations.deleteNote")}
        tone="danger"
        onConfirm={confirmRemove}
      />

      <DiscardChangesDialog
        visible={leaveGuard.confirmVisible}
        what={t("annotations.discardWhat")}
        onKeepEditing={leaveGuard.keepEditing}
        onDiscard={leaveGuard.discardAndLeave}
      />
    </ModalScreen>
  )
}

/** Two-step anchor picker: choose a section, then a line to attach to. */
function Composer({
  sections,
  step,
  onPickSection,
  onBackToSections,
  onCreate,
}: {
  sections: SongSection[]
  step: ComposerStep
  onPickSection: (sectionIndex: number) => void
  onBackToSections: () => void
  onCreate: (sectionId: string, lineIndex: number) => void
}) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  return (
    <View style={styles.composer}>
      <View style={styles.composerHeader}>
        <AppText variant="caption" tone="muted">
          {step.kind === "section"
            ? t("annotations.pickSectionTitle")
            : t("annotations.pickLineTitle")}
        </AppText>
        {step.kind === "line" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("annotations.backToSections")}
            onPress={onBackToSections}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <AppText variant="caption" tone="primary">
              {t("annotations.backToSections")}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {step.kind === "section" ? (
        <View style={styles.pickerList}>
          {sections.map((section, index) => (
            <Pressable
              key={section.id}
              accessibilityRole="button"
              onPress={() => onPickSection(index)}
              style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
            >
              <AppText variant="body" numberOfLines={1} style={styles.flex}>
                {sectionLabelFor(sections, index, t)}
              </AppText>
              <AppText variant="caption" tone="faint">
                {t("songs.linesCount", { count: section.lines.length })}
              </AppText>
              <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.pickerList}>
          {(sections[step.sectionIndex]?.lines ?? []).map((line, lineIndex) => (
            <Pressable
              key={`${step.sectionIndex}-${lineIndex}`}
              accessibilityRole="button"
              onPress={() => onCreate(sections[step.sectionIndex].id, lineIndex)}
              style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
            >
              <AppText variant="body" numberOfLines={2} style={styles.flex}>
                {line.text.trim().length > 0 ? line.text : t("annotations.emptyLinePreview")}
              </AppText>
              <NoteIcon size={15} color={Theme.colors.textFaint} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    markerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    markerActions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.xs },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.m },
    action: { flexGrow: 1, flexShrink: 1, flexBasis: 120 },
    composer: {
      gap: Theme.spacing.s,
      paddingTop: Theme.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    composerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    pickerList: { gap: 2 },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.s,
    },
  })