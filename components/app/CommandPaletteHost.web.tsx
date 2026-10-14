import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useOrgData } from "@/hooks/useOrgData"
import { AppText } from "@/components/ui/AppText"
import { Input } from "@/components/ui/Input"
import { SearchIcon } from "@/components/ui/Icons"
import { SheetSurface } from "@/components/ui/SheetSurface"
import { SIDEBAR_NAV } from "@/libs/navigation"
import {
  rankSearchable,
  registeredPaletteCommands,
  type PaletteCommand,
} from "@/libs/commandPalette"

/** Enough to reach anything in a real band without turning the list into a wall. */
const MAX_RESULTS = 40

/**
 * The command palette (roadmap #29): Ctrl/Cmd+K anywhere in the app to search,
 * create, transpose and navigate without reaching for the mouse.
 *
 * A desktop/web affordance, so it lives in a `.web.tsx` — the native build
 * (`CommandPaletteHost.ts`) renders nothing at all, and Metro picks by
 * platform. It reuses `SheetSurface`'s centered placement rather than opening a
 * second kind of overlay.
 *
 * Commands come from three places: the destinations every band has, the three
 * "new …" routes, and whatever the screen you are on registered through
 * `usePaletteCommands` — which is how the reader offers its transpose without
 * the palette knowing anything about the reader. Songs are searched live from
 * the library already subscribed behind it, so a query costs no extra read.
 */
export function CommandPaletteHost() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const { songs } = useOrgData()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const [screenCommands, setScreenCommands] = useState<readonly PaletteCommand[]>([])

  const close = useCallback((): void => {
    setOpen(false)
  }, [])

  const openPalette = useCallback((): void => {
    // Collected here rather than in an effect: the palette only needs them
    // once it is up, and a screen's commands are whatever it registered last.
    setScreenCommands(registeredPaletteCommands())
    setQuery("")
    setSelected(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (open) close()
        else openPalette()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, close, openPalette])

  const navigationCommands = useMemo<PaletteCommand[]>(
    () =>
      SIDEBAR_NAV.map((item) => ({
        id: `nav:${item.href}`,
        title: t(item.label),
        group: t("palette.group.navigate"),
        icon: item.icon,
        run: () => router.push(item.href as never),
      })),
    [t, router],
  )

  const createCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "create:song",
        title: t("palette.newSong"),
        group: t("palette.group.create"),
        keywords: ["song", "cancion", "canción"],
        run: () => router.push("/songs/new"),
      },
      {
        id: "create:setlist",
        title: t("palette.newSetlist"),
        group: t("palette.group.create"),
        keywords: ["setlist", "lista"],
        run: () => router.push("/setlists/new"),
      },
      {
        id: "create:performance",
        title: t("palette.newEvent"),
        group: t("palette.group.create"),
        keywords: ["event", "evento", "gira", "tour", "show"],
        run: () => router.push("/performances/new"),
      },
    ],
    [t, router],
  )

  const songCommands = useMemo<PaletteCommand[]>(
    () =>
      songs.map((song) => ({
        id: `song:${song.id}`,
        title: song.title,
        group: t("palette.group.songs"),
        keywords: [song.artist, song.key, ...song.tags].filter((word) => word.length > 0),
        run: () => router.push(`/songs/${song.id}`),
      })),
    [songs, t, router],
  )

  const results = useMemo(() => {
    const entries = [...screenCommands, ...navigationCommands, ...createCommands, ...songCommands]
    return rankSearchable(
      entries.map((command) => ({ command, text: command.title, keywords: command.keywords })),
      query,
      MAX_RESULTS,
    )
  }, [screenCommands, navigationCommands, createCommands, songCommands, query])

  // Buckets keep the ranking's order: a command is listed under its heading
  // where it fell, so the best match of every kind stays near the top.
  const groups = useMemo(() => {
    const buckets: { group: string; commands: PaletteCommand[] }[] = []
    for (const entry of results) {
      const last = buckets[buckets.length - 1]
      if (last && last.group === entry.command.group) last.commands.push(entry.command)
      else buckets.push({ group: entry.command.group, commands: [entry.command] })
    }
    return buckets
  }, [results])

  const flat = useMemo(() => groups.flatMap((bucket) => bucket.commands), [groups])
  const activeIndex = flat.length === 0 ? 0 : Math.min(selected, flat.length - 1)
  const activeCommand = flat[activeIndex]

  const run = useCallback(
    (command: PaletteCommand | undefined): void => {
      if (!command) return
      close()
      command.run()
    },
    [close],
  )

  // The palette is modal, so while it is up these keys belong to it alone —
  // which is also why they are prevented: Enter must not additionally activate
  // whatever a click left focused.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setSelected((current) => (flat.length === 0 ? 0 : (current + 1) % flat.length))
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setSelected((current) => (flat.length === 0 ? 0 : (current - 1 + flat.length) % flat.length))
      } else if (event.key === "Enter") {
        event.preventDefault()
        run(flat[activeIndex])
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, flat, activeIndex, run])

  const handleChangeText = (value: string): void => {
    setQuery(value)
    // Reset with the query rather than in an effect watching it: the new list
    // and the new selection have to arrive in the same render.
    setSelected(0)
  }

  return (
    <SheetSurface visible={open} onClose={close} placement="center" maxWidth={560}>
      <View style={styles.panel}>
        <Input
          value={query}
          onChangeText={handleChangeText}
          placeholder={t("palette.placeholder")}
          icon={<SearchIcon size={18} color={Theme.colors.textFaint} />}
          accessibilityLabel={t("palette.placeholder")}
          autoFocus
          containerStyle={styles.field}
          returnKeyType="search"
        />

        {flat.length === 0 ? (
          <AppText variant="body" tone="muted" style={styles.empty}>
            {t("palette.noResults")}
          </AppText>
        ) : (
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {groups.map((bucket) => (
              <View key={bucket.group}>
                <AppText variant="caption" tone="faint" style={styles.group}>
                  {bucket.group}
                </AppText>
                {bucket.commands.map((command) => {
                  const active = activeCommand?.id === command.id
                  const Icon = command.icon
                  return (
                    <Pressable
                      key={command.id}
                      onPress={() => run(command)}
                      onHoverIn={() =>
                        setSelected(flat.findIndex((entry) => entry.id === command.id))
                      }
                      style={[styles.row, active && styles.rowActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      {Icon ? (
                        <Icon size={16} color={active ? Theme.colors.primary : Theme.colors.textFaint} />
                      ) : null}
                      <AppText
                        variant="body"
                        numberOfLines={1}
                        style={[styles.rowTitle, active && styles.rowTitleActive]}
                      >
                        {command.title}
                      </AppText>
                      {command.hint ? (
                        <AppText variant="mono" tone="faint" numberOfLines={1} style={styles.rowHint}>
                          {command.hint}
                        </AppText>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            ))}
          </ScrollView>
        )}

        <AppText variant="caption" tone="faint" style={styles.shortcuts}>
          {t("palette.shortcuts")}
        </AppText>
      </View>
    </SheetSurface>
  )
}

const createStyles = () =>
  StyleSheet.create({
    panel: {
      paddingHorizontal: Theme.spacing.m,
      paddingTop: Theme.spacing.m,
      paddingBottom: Theme.spacing.s,
      gap: Theme.spacing.xs,
    },
    field: { marginBottom: 0 },
    list: { flexGrow: 0, maxHeight: 420 },
    group: {
      marginTop: Theme.spacing.s,
      marginBottom: Theme.spacing.xxs,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.xs,
      borderRadius: Theme.radii.s,
      /** Painted from the start: Android squares a background that only appears
          in another state. */
      backgroundColor: Theme.colors.transparent,
    },
    rowActive: { backgroundColor: Theme.colors.primarySoft },
    rowTitle: { flex: 1 },
    rowTitleActive: { color: Theme.colors.text },
    rowHint: { flexShrink: 0 },
    empty: {
      paddingVertical: Theme.spacing.l,
      paddingHorizontal: Theme.spacing.xs,
      textAlign: "center",
    },
    shortcuts: {
      marginTop: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.xs,
      textAlign: "center",
    },
  })
