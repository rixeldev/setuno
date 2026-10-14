import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { useToast } from "@/components/ui/Toast"
import { PrintIcon, ShareIcon } from "@/components/ui/Icons"
import { PRINT_SCALES, type PrintScale, type SongPrintOptions } from "@/libs/songPrint"
import { printSheet, sharePrintSheet } from "@/libs/printFile"
import { toFriendlyError } from "@/services/errors"

/** Size chips are labelled where they are rendered. */
const SCALE_LABELS: Record<PrintScale, string> = {
  small: "songs.sizeSmall",
  normal: "songs.sizeNormal",
  large: "songs.sizeLarge",
}

interface PrintSheetProps {
  visible: boolean
  onClose: () => void
  /** Name of whatever is being printed, shown under the sheet's title. */
  title: string
  /** Builds the printable HTML for the options currently picked. */
  render: (options: SongPrintOptions) => string
}

/**
 * Options for printing a song or a setlist (roadmap #20): with or without
 * chords, and a text size. The sheet keeps its own defaults and resets nothing,
 * so reopening it last picks where the user left off — printing the same chart
 * twice in a row is the common case.
 */
export function PrintSheet({ visible, onClose, title, render }: PrintSheetProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const [includeChords, setIncludeChords] = useState(true)
  const [scale, setScale] = useState<PrintScale>("normal")
  const [busy, setBusy] = useState(false)

  const sheet = (): string => render({ includeChords, scale, t })

  const share = async (): Promise<void> => {
    setBusy(true)
    try {
      const shared = await sharePrintSheet(sheet(), { dialogTitle: t("songs.printSharePdf") })
      if (shared) onClose()
      else toast.showError(t("songs.printUnavailable"))
    } catch (caught) {
      toast.showError(toFriendlyError(caught, t("songs.printFailed")))
    } finally {
      setBusy(false)
    }
  }

  const print = async (): Promise<void> => {
    setBusy(true)
    try {
      await printSheet(sheet())
      onClose()
    } catch (caught) {
      toast.showError(toFriendlyError(caught, t("songs.printFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("songs.printSheetTitle")}
      subtitle={title}
    >
      <View style={styles.block}>
        <AppText variant="label" tone="muted">
          {t("songs.printContent")}
        </AppText>
        <View style={styles.chips}>
          <Chip
            label={t("songs.printWithChords")}
            selected={includeChords}
            onPress={() => setIncludeChords(true)}
          />
          <Chip
            label={t("songs.printLyricsOnly")}
            selected={!includeChords}
            onPress={() => setIncludeChords(false)}
          />
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label" tone="muted">
          {t("songs.printSize")}
        </AppText>
        <View style={styles.chips}>
          {PRINT_SCALES.map((entry) => (
            <Chip
              key={entry}
              label={t(SCALE_LABELS[entry])}
              selected={scale === entry}
              onPress={() => setScale(entry)}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t("songs.printSharePdf")}
          icon={<ShareIcon size={16} color={Theme.colors.onPrimary} />}
          onPress={() => void share()}
          disabled={busy}
        />
        <Button
          label={t("songs.printNow")}
          variant="secondary"
          icon={<PrintIcon size={16} color={Theme.colors.text} />}
          onPress={() => void print()}
          disabled={busy}
        />
      </View>
    </BottomSheet>
  )
}

const createStyles = () =>
  StyleSheet.create({
    block: { gap: Theme.spacing.xs, marginBottom: Theme.spacing.m },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xs },
    actions: { gap: Theme.spacing.s },
  })
