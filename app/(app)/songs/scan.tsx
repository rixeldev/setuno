import React, { useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { Redirect, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import * as ImagePicker from "expo-image-picker"
import { File } from "expo-file-system"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useOrganization } from "@/hooks/useOrganization"
import { isOcrAvailable, recognizeImage, recognizePdf } from "@/modules/setuno-ocr"
import { proposeSongFromOcr, type OcrProposal } from "@/libs/ocrSheet"
import { setSongDraft } from "@/libs/ocrDraft"
import { toFriendlyError } from "@/services/errors"

type Phase = "idle" | "reading" | "proposal"

/**
 * Import a song from a photo or a PDF (roadmap #84).
 *
 * The recognition happens **on the phone** (ML Kit on Android, Vision on
 * iOS) — the photo never leaves the device. What comes out is a *proposal*:
 * the sheet is read, the chords are put back over the words they change, and
 * the member reviews everything in the editor before anything is saved. A
 * recognition is never certain, so the screen says how sure it was.
 */
export default function ScanSongScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { isAdmin } = useOrganization()

  const [phase, setPhase] = useState<Phase>("idle")
  const [proposal, setProposal] = useState<OcrProposal | null>(null)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Song creation is admin in the rules, so the door closes here too.
  if (!isAdmin) return <Redirect href="/songs" />

  const close = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/songs")
  }

  /** Reads the sheet and turns it into a proposal. */
  const read = async (uri: string, pdf: boolean): Promise<void> => {
    setPhase("reading")
    setError(null)
    try {
      const result = pdf ? await recognizePdf(uri) : await recognizeImage(uri)
      const proposed = proposeSongFromOcr(result)
      setProposal(proposed)
      setTitle(proposed.title)
      setText(proposed.text)
      setPhase("proposal")
    } catch (failure) {
      setError(toFriendlyError(failure))
      setPhase("idle")
    }
  }

  const takePhoto = async (): Promise<void> => {
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.9 })
    const uri = picked.canceled ? undefined : picked.assets[0]?.uri
    if (uri) await read(uri, false)
  }

  const choosePhoto = async (): Promise<void> => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    })
    const uri = picked.canceled ? undefined : picked.assets[0]?.uri
    if (uri) await read(uri, false)
  }

  const choosePdf = async (): Promise<void> => {
    const picked = await File.pickFileAsync()
    if (picked.canceled || !picked.result) return
    const file = picked.result
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError(t("songs.scanNotAPdf"))
      return
    }
    await read(file.uri, true)
  }

  /** Hands the proposal to the editor, where it is reviewed before saving. */
  const continueToEditor = (): void => {
    const token = setSongDraft({
      title,
      key: proposal?.key ?? null,
      capo: proposal?.capo ?? null,
      bpm: proposal?.bpm ?? null,
      text,
    })
    router.replace({ pathname: "/songs/new", params: { draft: token } })
  }

  const warnings = proposal?.warnings ?? []

  return (
    <ModalScreen title={t("songs.scanTitle")} subtitle={t("songs.scanSubtitle")} onClose={close}>
      {phase === "reading" ? (
        <View style={styles.reading}>
          <ActivityIndicator color={Theme.colors.accent} />
          <AppText style={styles.readingText}>{t("songs.scanReading")}</AppText>
        </View>
      ) : null}

      {phase !== "reading" && !isOcrAvailable ? (
        <Card style={styles.card}>
          <AppText style={styles.paragraph}>{t("songs.scanUnavailable")}</AppText>
        </Card>
      ) : null}

      {phase === "idle" && isOcrAvailable ? (
        <View style={styles.actions}>
          <Button label={t("songs.scanTakePhoto")} onPress={takePhoto} full />
          <Button
            label={t("songs.scanChoosePhoto")}
            onPress={choosePhoto}
            variant="secondary"
            full
          />
          <Button
            label={t("songs.scanChoosePdf")}
            onPress={choosePdf}
            variant="secondary"
            full
          />
          <AppText style={styles.privacy}>{t("songs.scanPrivacy")}</AppText>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </View>
      ) : null}

      {phase === "proposal" && proposal ? (
        <View style={styles.actions}>
          <Card style={styles.card}>
            <AppText style={styles.confidence}>
              {t("songs.scanConfidence", { percent: Math.round(proposal.confidence * 100) })}
            </AppText>
            {warnings.map((warning) => (
              <AppText key={warning} style={styles.warning}>
                {t(`songs.scanWarning.${warning}`)}
              </AppText>
            ))}
          </Card>

          <Input
            label={t("songs.scanTitleLabel")}
            value={title}
            onChangeText={setTitle}
            placeholder={t("songs.scanTitlePlaceholder")}
          />

          <Input
            label={t("songs.scanRecognized")}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={10}
            inputStyle={styles.textArea}
          />

          <Button label={t("songs.scanContinue")} onPress={continueToEditor} full />
          <Button
            label={t("songs.scanAgain")}
            onPress={() => {
              setProposal(null)
              setText("")
              setTitle("")
              setPhase("idle")
            }}
            variant="secondary"
            full
          />
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </View>
      ) : null}
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    actions: {
      gap: Theme.spacing.m,
    },
    card: {
      gap: Theme.spacing.xs,
    },
    paragraph: {
      color: Theme.colors.text,
      fontSize: Theme.sizes.h5,
    },
    reading: {
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.xxl,
    },
    readingText: {
      color: Theme.colors.textMuted,
      fontSize: Theme.sizes.h5,
    },
    privacy: {
      color: Theme.colors.textMuted,
      fontSize: Theme.sizes.caption,
      textAlign: "center",
    },
    confidence: {
      color: Theme.colors.text,
      fontSize: Theme.sizes.h5,
      fontWeight: "600",
    },
    warning: {
      color: Theme.colors.warning,
      fontSize: Theme.sizes.caption,
    },
    error: {
      color: Theme.colors.danger,
      fontSize: Theme.sizes.caption,
    },
    textArea: {
      minHeight: 160,
      textAlignVertical: "top",
    },
  })
