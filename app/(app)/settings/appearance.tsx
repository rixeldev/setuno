import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { updatePreferences } from "@/services/users"
import {
  applyAccent,
  applyAppearanceMode,
  getAppearance,
  resetAppearance,
} from "@/services/themeManager"
import { ACCENT_LIST, APPEARANCE_MODES } from "@/libs/appearance"
import type { AppearanceMode } from "@/interfaces"

const SONG_FONT_SIZES = [15, 17, 18, 20, 22, 26, 30]

/** Appearance settings (docs §33): light/dark, accent, reader defaults. */
export default function AppearanceSettings() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { profile } = useAuth()

  const appearance = getAppearance()
  const preferences = profile?.preferences
  const uid = profile?.uid ?? null

  const persist = async (patch: Parameters<typeof updatePreferences>[1]): Promise<void> => {
    if (!uid) return
    try {
      await updatePreferences(uid, patch)
    } catch {
      // Appearance is already applied locally; a failed preference write is not
      // worth interrupting the user for.
    }
  }

  return (
    <ScreenContainer back title="Appearance" subtitle="Make Stage Book yours" large>
      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          Theme
        </AppText>
        <View style={styles.row}>
          {APPEARANCE_MODES.map((mode: AppearanceMode) => (
            <Option
              key={mode}
              label={mode === "dark" ? "Dark" : "Light"}
              selected={appearance.mode === mode}
              onPress={() => {
                applyAppearanceMode(mode)
                void persist({ appearance: mode })
              }}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          Accent colour
        </AppText>
        <View style={styles.swatches}>
          {ACCENT_LIST.map((accent) => (
            <Pressable
              key={accent.id}
              accessibilityRole="button"
              accessibilityLabel={accent.name}
              accessibilityState={{ selected: appearance.accent === accent.id }}
              onPress={() => {
                applyAccent(accent.id)
                void persist({ accent: accent.id })
              }}
              style={({ pressed }) => [styles.swatch, pressed && styles.pressed]}
            >
              <View style={[styles.swatchFill, { backgroundColor: accent.primary }]}>
                {appearance.accent === accent.id ? (
                  <AppText variant="label" tone="inverse">
                    ✓
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {accent.name}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          Song reader
        </AppText>

        <View style={styles.row}>
          {SONG_FONT_SIZES.map((size) => (
            <Option
              key={size}
              label={`${size}`}
              selected={(preferences?.songFontSize ?? 18) === size}
              onPress={() => void persist({ songFontSize: size })}
              style={{ minWidth: 44 }}
            />
          ))}
        </View>
        <AppText variant="caption" tone="faint">
          Base size for lyrics and chords. You can still change it per song while you play.
        </AppText>

        <Button
          label={(preferences?.chordsVisible ?? true) ? "Chords shown by default" : "Chords hidden by default"}
          variant="secondary"
          onPress={() => void persist({ chordsVisible: !(preferences?.chordsVisible ?? true) })}
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          Motion
        </AppText>
        <Button
          label={(preferences?.reduceMotion ?? false) ? "Reduce motion: on" : "Reduce motion: off"}
          variant="secondary"
          onPress={() => void persist({ reduceMotion: !(preferences?.reduceMotion ?? false) })}
        />
        <AppText variant="caption" tone="faint">
          Reduce motion shortens transitions and removes the animated toast.
        </AppText>
      </Card>

      <Button
        label="Reset to defaults"
        variant="ghost"
        onPress={() => {
          resetAppearance()
          void persist({ appearance: "dark", accent: "teal" })
        }}
      />

      <Button label="Done" onPress={() => router.back()} />
    </ScreenContainer>
  )
}

interface OptionProps {
  label: string
  selected: boolean
  onPress: () => void
  style?: object
}

/** Selectable pill used across the settings screens. */
function Option({ label, selected, onPress, style }: OptionProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <AppText variant="bodyStrong" tone={selected ? "inverse" : "default"}>
        {label}
      </AppText>
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.m },
    swatch: { width: 76, gap: 4 },
    swatchFill: {
      height: 44,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
    },
    option: {
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.s,
      borderRadius: Theme.radii.pill,
      borderWidth: 1,
      borderColor: Theme.colors.border,
      backgroundColor: Theme.colors.background2,
      alignItems: "center",
    },
    optionSelected: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
    pressed: { opacity: 0.7 },
  })