import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, Skeleton } from "@/components/ui/States"
import {
  BookIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  EditIcon,
  ExportIcon,
  FullscreenExitIcon,
  KeepAwakeIcon,
  LibraryIcon,
  MusicIcon,
  NoteIcon,
  PauseIcon,
  PlayFilledIcon,
  PrintIcon,
  StarFilledIcon,
  StarIcon,
  SuggestIcon,
  SwapIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { AppBackground } from "@/components/app/AppBackground"
import { PageHeader } from "@/components/ui/PageHeader"
import { TourHint } from "@/components/onboarding/TourHint"
import { SongContent } from "@/components/songs/SongContent"
import { SongLinks } from "@/components/songs/SongLinks"
import { ChordShapeSheet } from "@/components/songs/ChordShapeSheet"
import { SongControls } from "@/components/songs/SongControls"
import { AutoscrollBar } from "@/components/songs/AutoscrollBar"
import { LiveShowBar } from "@/components/songs/LiveShowBar"
import { SongNavArrows } from "@/components/songs/SongNavArrows"
import { MergeSongsDialog } from "@/components/songs/MergeSongsDialog"
import { MetronomeSheet } from "@/components/songs/MetronomeSheet"
import { PrintSheet } from "@/components/songs/PrintSheet"
import { AddToCollectionSheet } from "@/components/collections/AddToCollectionSheet"
import { ReaderDock, READER_DOCK_HEIGHT } from "@/components/songs/ReaderDock"
import { AnnotationsBlock } from "@/components/annotations/AnnotationsBlock"
import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { useResponsive } from "@/hooks/useResponsive"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { readImmersiveMode, setReaderDirection, writeImmersiveMode } from "@/hooks/useReaderSession"
import { useWakeLock } from "@/hooks/useWakeLock"
import { useAutoscroll } from "@/hooks/useAutoscroll"
import { useMetronome } from "@/hooks/useMetronome"
import { useReaderState } from "@/hooks/useReaderState"
import { useReadingPosition } from "@/hooks/useReadingPosition"
import { useFontSizePinch } from "@/hooks/useFontSizePinch"
import { useFontSizeShortcuts } from "@/hooks/useFontSizeShortcuts"
import { useReaderKeys } from "@/hooks/useReaderKeys"
import { useAnnotations } from "@/hooks/useAnnotations"
import { useFavorites } from "@/hooks/useFavorites"
import { usePaletteCommands } from "@/hooks/usePaletteCommands"
import { duplicateSong, subscribeSong, trashSong } from "@/services/songs"
import { mergeSongs } from "@/services/songMerge"
import { saveReaderState, type ReaderState } from "@/services/readerState"
import { updatePreferences } from "@/services/users"
import { updateCachedPreferences, usePreferences } from "@/services/prefs"
import { toFriendlyError } from "@/services/errors"
import { displayKey as spellKey, semitonesBetweenKeys, transposeKey } from "@/libs/chords"
import type { PaletteCommand } from "@/libs/commandPalette"
import { voicingPrefKey } from "@/libs/chordShapes"
import { liveSetEntries, liveTotalSec } from "@/libs/liveShow"
import { formatRelativeTime, formatDuration } from "@/libs/format"
import {
  AUTOSCROLL_DEFAULT_DELAY,
  AUTOSCROLL_DEFAULT_SPEED,
  clampAutoscrollDelay,
  clampAutoscrollSpeed,
  maxScrollOffset,
  type AutoscrollDelay,
} from "@/libs/autoscroll"
import {
  clampReaderCapo,
  clampReaderFontSize,
  clampReaderSemitones,
  clampScrollRatio,
  scrollOffsetForRatio,
} from "@/libs/readerState"
import { READER_TOUR } from "@/libs/onboarding"
import { toDate } from "@/interfaces/timestamp"
import type { UserPreferences } from "@/interfaces"
import { songLyricsText, sectionLabelFor } from "@/libs/songUtils"
import { serializeChordPro } from "@/libs/chordpro"
import { exportTextFile } from "@/libs/exportFile"
import { songPrintHtml } from "@/libs/songPrint"
import { setlistStep } from "@/libs/setlistNavigation"
import * as Clipboard from "expo-clipboard"

/**
 * Song reader / performance view (docs §12).
 *
 * The screen is ordered like the job: the title and the artist in the header,
 * one slim bar for every display control, then the lyrics — the only thing that
 * matters while playing. Notes, suggestions, sharing and the destructive actions
 * live below the song, so nothing competes with the chords.
 */
export default function SongScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { gutter, isMobile } = useResponsive()
  const params = useLocalSearchParams<{ id?: string; setlist?: string; tour?: string }>()
  const songId = params.id ?? null
  // Set by the setlist screen when the song is part of a list: only then does
  // the reader offer the running-order arrows.
  const setlistId = params.setlist ?? null
  // Wide screens read the song in two columns (#9): phones keep one, tablets
  // and desktop (and a phone in landscape) split it down the middle. Stage mode
  // reuses the same value, so landscape never breaks the immersive layout.
  const readerColumns = isMobile ? 1 : 2

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { songLibrary, songs, setlists, suggestions, performances, loading } = useOrgData()
  const [song, setSong] = useState(songId ? (songLibrary.get(songId) ?? null) : null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [addToCollection, setAddToCollection] = useState(false)
  // The control tray ships shut: the lyrics are the screen, everything else is
  // one tap away (roadmap redesign of the song screen).
  const [controlsOpen, setControlsOpen] = useState(false)
  const [metronomeOpen, setMetronomeOpen] = useState(false)
  // Session practice transport (roadmap #11): seeds from the song's BPM, dies
  // with the screen — stepping to the next song starts a fresh visit.
  const metronome = useMetronome(song?.bpm ?? null)

  // Live document: reflects admin edits and accepted suggestions immediately.
  useEffect(() => subscribeSong(organizationId, songId, setSong), [organizationId, songId])

  // Corner arrows to walk the running order: only for songs opened from a
  // setlist screen, and only when that list really belongs to a live event —
  // never for the general songbook or a draft list.
  const contextSetlist = useMemo(
    () => (setlistId ? (setlists.find((entry) => entry.id === setlistId) ?? null) : null),
    [setlistId, setlists],
  )
  const eventSetlist = useMemo(() => {
    if (!contextSetlist) return null
    const belongsToEvent = performances.some(
      (performance) =>
        performance.status !== "cancelled" &&
        performance.setlists.some((reference) => reference.id === contextSetlist.id),
    )
    return belongsToEvent ? contextSetlist : null
  }, [contextSetlist, performances])
  // Key the band chose for this song in a live event's setlist ("" otherwise).
  const chosenPlayKey = eventSetlist?.songs.find((entry) => entry.songId === song?.id)?.key ?? ""
  // The band's cue for *this entry* of the list it was opened from — "tune Eb",
  // "starts alone" (roadmap #43). Context, not the song: the same song can be
  // called something different in another list. Any list counts, live show or
  // not — you opened it from there, and the note is meant to be read while you do.
  const entryNote =
    contextSetlist?.songs.find((entry) => entry.songId === song?.id)?.note ?? ""

  // Live show (#7): the running order with durations, this song's place in it
  // and the setlist's estimate. Shown while reading from an event's setlist.
  const liveEntries = useMemo(() => (eventSetlist ? liveSetEntries(eventSetlist) : []), [eventSetlist])
  const liveIndex = useMemo(
    () => (song ? liveEntries.findIndex((entry) => entry.songId === song.id) : -1),
    [liveEntries, song],
  )
  const liveEstimated = useMemo(
    () => (eventSetlist ? eventSetlist.estimatedDurationSec || liveTotalSec(liveEntries) : 0),
    [eventSetlist, liveEntries],
  )

  // Reader display settings come from the local preference cache so they are
  // restored instantly on every start-up (docs §32), then mirrored to the
  // profile so the defaults follow the account across devices.
  const preferences = usePreferences()
  // Solfège ("Do Re Mi") and Nashville numbers ("1 4 5") are display choices
  // stored with the reader settings.
  const notation = preferences.chordNotation ?? "letters"
  // Reader layout (#6): chords above the lyrics, lyrics only or a chord chart.
  const chordView = preferences.chordView ?? "both"
  // Per-song text size (#5): `null` means "no choice yet", so the profile
  // default applies. Adjust state while rendering, as documented by React.
  const [fontSizeChoice, setFontSizeChoice] = useState<FontSizeChoice>(NO_FONT_SIZE_CHOICE)
  if (fontSizeChoice.songId !== (songId ?? "")) {
    setFontSizeChoice({ songId: songId ?? "", size: null })
  }
  // Stage mode survives the screen swap while stepping through a setlist; the
  // general songbook always opens in the regular layout.
  const [immersive, setImmersive] = useState(() => (setlistId ? readImmersiveMode() : false))
  const [notesOpen, setNotesOpen] = useState(false)
  // Contextual tips: only while the guided tour walks the reader (roadmap #65).
  const [tourActive, setTourActive] = useState(params.tour === "reader")
  // Letter chord tapped in the reader; opens the “how to play” sheet.
  const [chordHelp, setChordHelp] = useState<string | null>(null)

  // Autoscroll (#1) and resume (#4) share one private document per song,
  // `users/{uid}/readerState/{songId}`. The transport is per session — it never
  // starts on its own — while the speed, the start delay, the reading position
  // and the transposition are remembered per song and per user. The shared song
  // document is never touched: reading preferences belong to the player.
  const scrollRef = useRef<ScrollView | null>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  /** Latest offset, tracked to tell a manual scroll from the restore (#4). */
  const scrollOffsetRef = useRef(0)
  /** Song whose saved position has already been applied this visit (#4). */
  const restoredRef = useRef<string | null>(null)
  /**
   * The touch that just landed found the scroll moving. That tap is the
   * documented "pause by hand", so it must not also throw the reader into
   * stage mode — the next one does.
   */
  const touchStoppedScrollRef = useRef(false)
  // Whatever the reader moved by hand during this visit wins over the saved
  // state, and is dropped the moment another song opens (adjust state while
  // rendering, as documented by React).
  const [autoscrollChoice, setAutoscrollChoice] =
    useState<AutoscrollChoice>(NO_AUTOSCROLL_CHOICE)
  if (autoscrollChoice.songId !== (songId ?? "")) {
    setAutoscrollChoice({ ...NO_AUTOSCROLL_CHOICE, songId: songId ?? "" })
  }
  const savedReaderState = useReaderState(profile?.uid ?? null, songId)
  const savedAutoscroll = savedReaderState?.songId === songId ? savedReaderState : null

  // The size this song opens at: the reader's own pick, or the profile default.
  const fontSize =
    fontSizeChoice.size ??
    (savedAutoscroll?.fontSize !== undefined
      ? clampReaderFontSize(savedAutoscroll.fontSize)
      : preferences.songFontSize)

  // Resume (#4): transpose and capo are remembered per song like the autoscroll
  // settings. `null` means "no choice yet", so the setlist's chosen key (or the
  // saved value, or the song's own capo) applies; a live change of that key
  // re-applies while the reader is on screen (adjust state while rendering).
  const [tuning, setTuning] = useState<TuningChoice>(NO_TUNING)
  if (tuning.songId !== (songId ?? "")) {
    setTuning({ songId: songId ?? "", playKey: chosenPlayKey, semitones: null, capo: null })
  } else if (tuning.playKey !== chosenPlayKey) {
    setTuning({ ...tuning, playKey: chosenPlayKey, semitones: null })
  }
  const savedSemitones = clampReaderSemitones(savedAutoscroll?.semitones ?? 0)
  const savedCapo =
    savedAutoscroll?.capo !== undefined ? clampReaderCapo(savedAutoscroll.capo) : null
  const playKeyShift = song && chosenPlayKey ? semitonesBetweenKeys(song.key, chosenPlayKey) : 0
  const semitones = tuning.semitones ?? (chosenPlayKey ? playKeyShift : savedSemitones)
  const capo = tuning.capo ?? (chosenPlayKey ? null : savedCapo) ?? song?.capo ?? 0

  const persistReaderPatch = useCallback(
    (patch: ReaderState): void => {
      if (!profile?.uid || !songId) return
      void saveReaderState(profile.uid, songId, patch).catch(() => undefined)
    },
    [profile, songId],
  )

  const changeSemitones = useCallback(
    (next: number): void => {
      const value = clampReaderSemitones(next)
      setTuning((current) => ({ ...current, semitones: value }))
      persistReaderPatch({ semitones: value })
    },
    [persistReaderPatch, setTuning],
  )

  const changeCapo = (next: number): void => {
    const value = clampReaderCapo(next)
    setTuning((current) => ({ ...current, capo: value }))
    persistReaderPatch({ capo: value })
  }

  // Personal notes (#3): inline markers plus the end-of-song block, both
  // owner-only under `users/{uid}/annotations/{songId}`.
  const annotations = useAnnotations(profile?.uid ?? null, songId)
  // Favorites are personal (roadmap #33): every member stars their own list,
  // and nothing about it ever touches the shared song document.
  const { isFavorite, setFavorite } = useFavorites()
  const currentAnnotations = annotations?.songId === songId ? annotations : null
  const openAnnotations = useCallback((): void => {
    if (!song) return
    router.push(`/annotations/${song.id}?title=${encodeURIComponent(song.title)}`)
  }, [router, song])
  const autoscrollSpeed =
    autoscrollChoice.speed ??
    (savedAutoscroll?.autoscrollSpeed !== undefined
      ? clampAutoscrollSpeed(savedAutoscroll.autoscrollSpeed)
      : AUTOSCROLL_DEFAULT_SPEED)
  const autoscrollDelay =
    autoscrollChoice.delay ??
    (savedAutoscroll?.autoscrollDelay !== undefined
      ? clampAutoscrollDelay(savedAutoscroll.autoscrollDelay)
      : AUTOSCROLL_DEFAULT_DELAY)

  const {
    reset: resetAutoscroll,
    pause: pauseAutoscroll,
    onScroll: reportScroll,
    ...autoscroll
  } = useAutoscroll({
    scrollRef,
    speed: autoscrollSpeed,
    delay: autoscrollDelay,
    fontSize,
    reducedMotion: preferences.reduceMotion,
    contentHeight,
    viewportHeight,
  })

  // A different song opens at the top with the transport stopped; the saved
  // position (#4) is applied later, once the state and the layout are known.
  useEffect(() => {
    resetAutoscroll()
    scrollOffsetRef.current = 0
    restoredRef.current = null
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [songId, resetAutoscroll])

  const changeAutoscrollSpeed = (next: number): void => {
    const value = clampAutoscrollSpeed(next)
    setAutoscrollChoice((current) => ({ ...current, speed: value }))
    persistReaderPatch({ autoscrollSpeed: value })
  }

  const changeAutoscrollDelay = (next: AutoscrollDelay): void => {
    setAutoscrollChoice((current) => ({ ...current, delay: next }))
    persistReaderPatch({ autoscrollDelay: next })
  }

  // One tap back to the song's own key, no capo and the top of the lyrics; also
  // forgets the saved resume point (#4).
  const resetView = (): void => {
    setTuning({ songId: songId ?? "", playKey: chosenPlayKey, semitones: 0, capo: 0 })
    restoredRef.current = songId
    scrollOffsetRef.current = 0
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    persistReaderPatch({ semitones: 0, capo: 0, scrollRatio: 0 })
  }

  // The lyrics scroll through one `ScrollView` per layout (regular or stage):
  // its measurements tell the transport where the song ends, and the reading
  // position where it should resume (#4).
  const reportPosition = useReadingPosition(profile?.uid ?? null, songId)
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const offset = event.nativeEvent.contentOffset.y
      scrollOffsetRef.current = offset
      reportScroll(offset)
      reportPosition(offset, contentHeight, viewportHeight)
    },
    [reportScroll, reportPosition, contentHeight, viewportHeight],
  )

  const handleContentSize = useCallback(
    (_width: number, height: number): void => {
      setContentHeight(height)
    },
    [setContentHeight],
  )

  const handleScrollLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      setViewportHeight(event.nativeEvent.layout.height)
    },
    [setViewportHeight],
  )

  // Rubber-stamp the saved position once the state and the layout have both
  // arrived. A position the reader reached by hand first wins, so the restore
  // never yanks the lyrics from under them.
  useEffect(() => {
    if (!songId || savedAutoscroll?.songId !== songId) return
    if (restoredRef.current === songId) return
    if (contentHeight <= 0 || viewportHeight <= 0) return
    restoredRef.current = songId
    if (maxScrollOffset(contentHeight, viewportHeight) <= 0) return
    const target =
      scrollOffsetRef.current > 8
        ? scrollOffsetRef.current
        : scrollOffsetForRatio(savedAutoscroll.scrollRatio ?? 0, contentHeight, viewportHeight)
    scrollRef.current?.scrollTo({ y: target, animated: false })
  }, [songId, savedAutoscroll, contentHeight, viewportHeight])

  const autoscrollRunning = autoscroll.status === "playing" || autoscroll.status === "waiting"
  const autoscrollTransportLabel = autoscrollRunning
    ? t("songs.autoscrollPause")
    : autoscroll.status === "paused"
      ? t("songs.autoscrollResume")
      : t("songs.autoscrollPlay")

  // Stage mode announces itself with a short slide: swapping modes is the most
  // abrupt step in the reader, so the bar drops in instead of appearing. The
  // value is recreated on every entry, which restarts the spring without ever
  // mutating it by hand.
  const stageBarY = useMemo(() => new Animated.Value(immersive ? -24 : 0), [immersive])
  useEffect(() => {
    if (!immersive) return
    Animated.spring(stageBarY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 90 }).start()
  }, [immersive, stageBarY])

  // Stage mode keeps the screen awake unless the reader turned it off (#2).
  useWakeLock(immersive && preferences.keepAwake)

  const enterImmersive = (): void => {
    writeImmersiveMode(true)
    setImmersive(true)
  }

  const exitImmersive = (): void => {
    writeImmersiveMode(false)
    setImmersive(false)
  }

  const handleBodyTouchStart = (): void => {
    touchStoppedScrollRef.current = autoscrollRunning
    pauseAutoscroll()
  }

  /**
   * A tap on the song body is the toggle for the whole presentation layer: with
   * the tray open it closes the tray first (that tap was aimed at dismissing
   * the controls, not at going fullscreen), and otherwise it enters or leaves
   * stage mode. A tap that just paused a running scroll only pauses it — that
   * is a documented gesture of its own — so it is consumed before any of this.
   */
  const handleBodyPress = (): void => {
    if (!immersive && controlsOpen) {
      setControlsOpen(false)
      return
    }
    if (touchStoppedScrollRef.current) {
      touchStoppedScrollRef.current = false
      return
    }
    if (immersive) exitImmersive()
    else enterImmersive()
  }

  const saveDisplayPreference = (patch: Partial<UserPreferences>): void => {
    updateCachedPreferences(patch)
    if (profile?.uid) {
      void updatePreferences(profile.uid, patch).catch(() => undefined)
    }
  }

  /**
   * Pins (or clears) the favourite guitar voicing for the chord currently open
   * in the play guide (roadmap #23). The pin is stored per chord on the user's
   * preferences, never on the song, so it follows them across songs.
   */
  const pinVoicing = (id: string | null): void => {
    if (!chordHelp) return
    const key = voicingPrefKey("guitar", chordHelp)
    const next = { ...(preferences.voicings ?? {}) }
    if (id === null) delete next[key]
    else next[key] = id
    saveDisplayPreference({ voicings: next })
  }

  // Text size (#5). A pinch previews the size while the fingers move and
  // commits once they lift; the buttons and the desktop shortcuts commit right
  // away. The pick is remembered per song, and also becomes the profile default
  // so a song nobody resized opens at the last size the reader chose.
  const previewFontSize = (size: number): void => {
    setFontSizeChoice((current) => ({ ...current, size }))
  }

  const commitFontSize = (size: number): void => {
    const value = clampReaderFontSize(size)
    setFontSizeChoice((current) => ({ ...current, size: value }))
    persistReaderPatch({ fontSize: value })
    saveDisplayPreference({ songFontSize: value })
  }

  const resetFontSize = (): void => commitFontSize(preferences.songFontSize)
  const nudgeFontSize = (delta: number): void => commitFontSize(fontSize + delta)

  const pinchHandlers = useFontSizePinch(fontSize, previewFontSize, commitFontSize)
  useFontSizeShortcuts(nudgeFontSize, resetFontSize)

  // The transposed key in letters — the reference Nashville numbers are measured
  // against, and the input to the notation display below.
  const transposedKey = useMemo(
    () => (song ? transposeKey(song.key, semitones) : ""),
    [song, semitones],
  )

  const displayKey = useMemo(
    () => (transposedKey ? spellKey(transposedKey, notation) : ""),
    [transposedKey, notation],
  )

  // Ctrl/Cmd+K (roadmap #29) reaches everywhere the app does, but the key the
  // band is playing in is the one thing it cannot know — so the reader
  // contributes its own transpose, with the key each step lands on as the hint.
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    if (!song) return []
    const at = (delta: number): string => transposeKey(song.key, semitones + delta)
    return [
      {
        id: "reader.transposeUp",
        title: t("palette.transposeUp"),
        group: t("palette.group.song"),
        hint: at(1),
        run: () => changeSemitones(semitones + 1),
      },
      {
        id: "reader.transposeDown",
        title: t("palette.transposeDown"),
        group: t("palette.group.song"),
        hint: at(-1),
        run: () => changeSemitones(semitones - 1),
      },
      {
        id: "reader.transposeReset",
        title: t("palette.transposeReset"),
        group: t("palette.group.song"),
        hint: song.key,
        run: () => changeSemitones(0),
      },
    ]
  }, [t, song, semitones, changeSemitones])
  usePaletteCommands(paletteCommands, song !== null)

  // Corner arrows to walk the running order: only for songs opened from a
  // setlist screen, and only when that list really belongs to a live event —
  // never for the general songbook or a draft list.
  const step = useMemo(
    () => (song && eventSetlist ? setlistStep(song.id, eventSetlist.songs) : null),
    [eventSetlist, song],
  )

  // Stepping opens the next reader screen and tells the stack which way to
  // animate: "pop" when walking back, "push" when walking forward.
  const openSong = (targetId: string): void => {
    setReaderDirection(step?.previousId === targetId ? "pop" : "push")
    router.replace(setlistId ? `/songs/${targetId}?setlist=${setlistId}` : `/songs/${targetId}`)
  }

  // Keyboard + Bluetooth page-turner pedals (roadmap #8). Desktop only: the
  // web hook handles arrows, space and PageUp/PageDown (which is exactly what a
  // pedal sends), transposing, `f` for stage mode and `p` for autoscroll. It is
  // muted while a sheet or dialog is open so the keys never fight the overlay.
  const nextSongId = step?.nextId ?? null
  const previousSongId = step?.previousId ?? null
  useReaderKeys({
    enabled: chordHelp === null && !notesOpen && !confirmDelete && !mergeOpen && !metronomeOpen && !addToCollection,
    onNext: nextSongId ? () => openSong(nextSongId) : null,
    onPrevious: previousSongId ? () => openSong(previousSongId) : null,
    onTranspose: (delta) => changeSemitones(semitones + delta),
    onToggleStage: () => (immersive ? exitImmersive() : enterImmersive()),
    onExitStage: exitImmersive,
    onToggleAutoscroll: autoscroll.toggle,
  })

  const copyLyrics = async (): Promise<void> => {
    if (!song) return
    await Clipboard.setStringAsync(
      songLyricsText(song.sections, (_section, index) => sectionLabelFor(song.sections, index, t)),
    )
    toast.showSuccess(t("songs.lyricsCopied"))
  }

  /**
   * Toggle the star (roadmap #33). The icon itself is driven by the
   * subscription snapshot, so a rejected write (rules not deployed yet) simply
   * leaves the star as it was — the error is only surfaced when it can actually
   * be acted on.
   */
  const toggleFavorite = (): void => {
    if (!song) return
    const favorite = !isFavorite(song.id)
    setFavorite(song.id, favorite).catch((cause: unknown) => {
      toast.showError(toFriendlyError(cause, t("songs.favoriteFailed")))
    })
  }

  /** Hands the song off as a ChordPro file (roadmap #18). */
  const exportChordPro = async (): Promise<void> => {
    if (!song) return
    const content = serializeChordPro({
      title: song.title,
      artist: song.artist,
      key: song.key,
      capo: song.capo,
      sections: song.sections,
    })
    const slug = song.title.trim().replace(/[^\w\-. ]+/g, "").replace(/\s+/g, "-")
    const ok = await exportTextFile({
      fileName: `${slug || "song"}.cho`,
      content,
      mimeType: "text/plain",
      dialogTitle: t("songs.exportChordPro"),
    })
    if (ok) toast.showSuccess(t("songs.exportDone"))
    else toast.showError(t("songs.exportFailed"))
  }

  // Roadmap #31: "delete" moves the song to the trash — it can be restored
  // from there, and only the trash's "delete forever" really removes it.
  const remove = async (): Promise<void> => {
    if (!song) return
    setDeleting(true)
    try {
      await trashSong(organizationId ?? "", song.id, {
        id: profile?.uid ?? "",
        name: profile?.displayName || "An admin",
      })
      setConfirmDelete(false)
      toast.showSuccess(t("songs.trashedToast", { title: song.title }))
      router.replace("/songs")
    } catch (error) {
      toast.showError(toFriendlyError(error, t("songs.couldNotDelete")))
    } finally {
      setDeleting(false)
    }
  }

  // Roadmap #32 — a copy under a fresh id, then straight into its editor so
  // the variant can be renamed and reshaped right away.
  const duplicate = async (): Promise<void> => {
    if (!song || duplicating) return
    setDuplicating(true)
    try {
      const id = await duplicateSong(organizationId ?? "", song.id, t("songs.copySuffix"), {
        id: profile?.uid ?? "",
        name: profile?.displayName || "An admin",
      })
      toast.showSuccess(t("songs.duplicated"))
      router.push(`/songs/${id}/edit`)
    } catch (error) {
      toast.showError(toFriendlyError(error, t("songs.duplicateFailed")))
    } finally {
      setDuplicating(false)
    }
  }

  // The dialog owns its spinner: success closes it here, a failure is shown
  // here and re-thrown so it clears the spinner and stays open for a retry.
  const runMerge = async (masterId: string, loserId: string): Promise<void> => {
    try {
      await mergeSongs(
        organizationId ?? "",
        { masterId, loserId },
        {
          id: profile?.uid ?? "",
          name: profile?.displayName || "An admin",
        },
      )
    } catch (error) {
      toast.showError(toFriendlyError(error, t("songs.mergeFailed")))
      throw error
    }

    const master = masterId === song?.id ? song : songs.find((item) => item.id === masterId)
    const loser = loserId === song?.id ? song : songs.find((item) => item.id === loserId)
    setMergeOpen(false)
    toast.showSuccess(t("songs.merged", { master: master?.title ?? "", loser: loser?.title ?? "" }))
    // When the song on screen is the one that went away, follow the keeper.
    if (loserId === song?.id) router.replace(`/songs/${masterId}`)
  }

  if (!songId) {
    return (
      <ScreenContainer back title={t("songs.song")}>
        <EmptyState title={t("songs.songNotFound")} message={t("songs.songNotFoundDescription")} />
      </ScreenContainer>
    )
  }

  if (!song) {
    return (
      <View style={styles.host}>
        <AppBackground />
        <PageHeader title={t("songs.song")} back elevated />
        <View style={[styles.loading, { paddingHorizontal: gutter }]}>
          {loading ? (
            <View style={{ gap: Theme.spacing.m }}>
              <Skeleton height={26} width="60%" />
              <Skeleton height={16} width="40%" />
              <Skeleton height={220} />
            </View>
          ) : (
            <EmptyState
              title={t("songs.songNotFound")}
              message={t("songs.songNotFoundDescription")}
              actionLabel={t("songs.backToSongs")}
              onAction={() => router.replace("/songs")}
            />
          )}
        </View>
      </View>
    )
  }

  const lyrics =
    song.sections.length === 0 ? (
      <EmptyState
        compact
        title={t("songs.noLyrics")}
        message={isAdmin ? t("songs.noLyricsAdmin") : t("songs.noLyricsMember")}
        actionLabel={isAdmin ? t("songs.openEditor") : undefined}
        onAction={isAdmin ? () => router.push(`/songs/${song.id}/edit`) : undefined}
      />
    ) : (
      <SongContent
        sections={song.sections}
        fontSize={fontSize}
        view={chordView}
        semitones={semitones}
        songKey={transposedKey}
        notation={notation}
        columns={readerColumns}
        markers={currentAnnotations?.markers ?? []}
        onMarkerPress={openAnnotations}
        onChordPress={setChordHelp}
      />
    )

  // “How to play” sheet: piano keys or every guitar voicing for the tapped
  // chord, with the current capo applied to the guitar shapes and the pinned
  // favourite (roadmap #23) opening first.
  const chordSheet = (
    <ChordShapeSheet
      visible={chordHelp !== null}
      chord={chordHelp}
      capo={capo}
      notation={notation}
      keyName={transposedKey}
      instrument={preferences.chordInstrument ?? "guitar"}
      onInstrumentChange={(next) => saveDisplayPreference({ chordInstrument: next })}
      preferredVoicingId={
        chordHelp
          ? (preferences.voicings ?? {})[voicingPrefKey("guitar", chordHelp)] ?? null
          : null
      }
      onPinVoicing={(id) => pinVoicing(id)}
      onClose={() => setChordHelp(null)}
    />
  )

  // Everything that used to stand above the lyrics — transpose, capo, text
  // size, view, notation and the whole autoscroll bar — now lives inside the
  // bottom tray, off until asked for.
  const controlsPanel = (
    <>
      <SongControls
        semitones={semitones}
        onSemitonesChange={changeSemitones}
        displayKey={displayKey}
        originalKey={spellKey(song.key, notation)}
        capo={capo}
        onCapoChange={changeCapo}
        fontSize={fontSize}
        onFontSizeChange={commitFontSize}
        view={chordView}
        onViewChange={(next) => saveDisplayPreference({ chordView: next })}
        notation={notation}
        onNotationChange={(next) => saveDisplayPreference({ chordNotation: next })}
        canResetView={
          semitones !== 0 || capo !== 0 || clampScrollRatio(savedAutoscroll?.scrollRatio) > 0
        }
        onResetView={resetView}
      />

      <AutoscrollBar
        status={autoscroll.status}
        countdown={autoscroll.countdown}
        progress={autoscroll.progress}
        remainingSeconds={autoscroll.remainingSeconds}
        canScroll={autoscroll.canScroll}
        speed={autoscrollSpeed}
        onSpeedChange={changeAutoscrollSpeed}
        delay={autoscrollDelay}
        onDelayChange={changeAutoscrollDelay}
        onToggle={autoscroll.toggle}
        onReset={() => {
          resetAutoscroll()
          scrollRef.current?.scrollTo({ y: 0, animated: false })
        }}
      />
    </>
  )

  // Stage mode: only the song, the exit control and the current key.
  if (immersive) {
    return (
      <View style={[styles.host, { paddingHorizontal: gutter }]} {...pinchHandlers}>
        <AppBackground />
        <Animated.View
          style={[styles.immersiveBar, { transform: [{ translateY: stageBarY }] }]}
        >
          <View style={styles.immersiveHeading}>
            <View style={styles.immersiveHeadingText}>
              <AppText
                variant="bodyStrong"
                numberOfLines={1}
                style={styles.immersiveHeadingTitle}
              >
                {song.title}
              </AppText>
              {entryNote ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {entryNote}
                </AppText>
              ) : null}
            </View>
            <View style={styles.immersiveKey}>
              <MusicIcon size={13} color={Theme.colors.primary} />
              <AppText variant="caption" tone="primary" numberOfLines={1}>
                {displayKey || song.key}
              </AppText>
            </View>
          </View>
          <View style={styles.immersiveActions}>
            <IconButton
              label={autoscrollTransportLabel}
              variant="secondary"
              size={36}
              disabled={!autoscroll.canScroll && autoscroll.status === "idle"}
              onPress={autoscroll.toggle}
              icon={
                autoscrollRunning ? (
                  <PauseIcon size={16} color={Theme.colors.primary} />
                ) : (
                  <PlayFilledIcon size={16} color={Theme.colors.primary} />
                )
              }
            />
            <Pressable
              onPress={() => saveDisplayPreference({ keepAwake: !preferences.keepAwake })}
              accessibilityRole="switch"
              accessibilityState={{ checked: preferences.keepAwake }}
              accessibilityLabel={t("songs.keepAwakeA11y")}
              style={({ pressed }) => [
                styles.keepAwakeChip,
                preferences.keepAwake && styles.keepAwakeChipOn,
                pressed && styles.pressed,
              ]}
            >
              <KeepAwakeIcon
                size={18}
                color={preferences.keepAwake ? Theme.colors.primary : Theme.colors.textMuted}
              />
            </Pressable>
            <IconButton
              label={t("songs.exitStageMode")}
              variant="secondary"
              size={36}
              onPress={exitImmersive}
              icon={<FullscreenExitIcon size={16} color={Theme.colors.text} />}
            />
          </View>
        </Animated.View>
        {eventSetlist && liveIndex >= 0 ? (
          <LiveShowBar
            setlistId={eventSetlist.id}
            entries={liveEntries}
            index={liveIndex}
            estimatedSec={liveEstimated}
          />
        ) : null}
        <ScrollView
          ref={scrollRef}
          style={styles.immersiveScroll}
          contentContainerStyle={[
            styles.immersiveContent,
            step ? styles.stageNavPadding : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={pauseAutoscroll}
          onTouchStart={handleBodyTouchStart}
          onContentSizeChange={handleContentSize}
          onLayout={handleScrollLayout}
        >
          {/* No display title here: the bar already carries it, so the song
              starts at the first line instead of a screenful of heading. A tap
              on the song leaves stage mode, symmetric with entering it the same
              way; chords and markers are their own responders and win the
              responder negotiation first, so they still open their sheets. */}
          <Pressable
            onPress={tourActive ? undefined : handleBodyPress}
            accessible={false}
          >
            {lyrics}
          </Pressable>
        </ScrollView>

        {step ? (
          <SongNavArrows previousId={step.previousId} nextId={step.nextId} onNavigate={openSong} />
        ) : null}
        {chordSheet}
      </View>
    )
  }

  // What the control tray shows at a glance: the key the band plays in, plus
  // the capo when one is clamped on.
  const tuningSummary =
    capo > 0 ? `${displayKey || song.key} · ${t("songs.capo")} ${capo}` : displayKey || song.key

  const details = [
    // The artist moves down here (one line, scrolls away) so the header stays
    // a single row and the song starts as high on the screen as it can.
    song.artist || null,
    song.bpm ? `${song.bpm} BPM` : null,
    song.durationSec ? formatDuration(song.durationSec) : null,
    song.genre || null,
  ].filter((value): value is string => Boolean(value))
  const hasNotes = song.notes.trim().length > 0

  return (
    <View style={styles.host} {...pinchHandlers}>
      <AppBackground />
      <PageHeader
        title={song.title}
        dense
        back
        elevated
        // Only edit lives in the header. Stage mode is a tap on the song and a
        // button in the tray, so a second entry point here would just be one
        // more thing in the header's way.
        right={
          isAdmin ? (
            <IconButton
              label={t("songs.editSong")}
              onPress={() => router.push(`/songs/${song.id}/edit`)}
              icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
            />
          ) : null
        }
      />

      {eventSetlist && liveIndex >= 0 ? (
        <LiveShowBar
          setlistId={eventSetlist.id}
          entries={liveEntries}
          index={liveIndex}
          estimatedSec={liveEstimated}
        />
      ) : null}

      <ScreenContainer
        scroll
        padded={false}
        style={[styles.scrollBody, { paddingHorizontal: gutter }]}
        scrollRef={scrollRef}
        scrollProps={{
          onScroll: handleScroll,
          scrollEventThrottle: 16,
          onScrollBeginDrag: pauseAutoscroll,
          onTouchStart: handleBodyTouchStart,
          onContentSizeChange: handleContentSize,
          onLayout: handleScrollLayout,
        }}
      >
        <Pressable
          onPress={tourActive ? undefined : handleBodyPress}
          // Children (chords, markers) take precedence in the responder
          // negotiation, and an ungrouped tree keeps them individually
          // focusable — this is a convenience gesture, not a control.
          accessible={false}
          style={[styles.content, step ? styles.withNavPadding : null]}
        >
          {tourActive ? (
            <TourHint
              steps={READER_TOUR}
              doneLabel={t("onboarding.tourOpenEditor")}
              onDone={() => {
                setTourActive(false)
                router.replace(`/songs/${song.id}/edit?tour=editor`)
              }}
              onSkip={() => setTourActive(false)}
            />
          ) : null}

          {entryNote ? (
            <View style={styles.setlistNote}>
              <NoteIcon size={14} color={Theme.colors.accent} />
              <AppText variant="caption" tone="muted" style={styles.flex}>
                {entryNote}
              </AppText>
            </View>
          ) : null}

          {details.length > 0 ? (
            <AppText variant="caption" tone="faint">
              {details.join("  ·  ")}
            </AppText>
          ) : null}

          {hasNotes ? (
            <Pressable
              onPress={() => setNotesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("songs.performanceNotes")}
              style={({ pressed }) => [styles.notes, pressed && styles.pressed]}
            >
              <BookIcon size={16} color={Theme.colors.primary} />
              <View style={styles.flex}>
                <AppText variant="caption" tone="muted">
                  {t("songs.performanceNotes")}
                </AppText>
                <AppText variant="caption" tone="faint" numberOfLines={1}>
                  {song.notes}
                </AppText>
              </View>
              <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
            </Pressable>
          ) : null}

          <SongLinks links={song.links} />

          {lyrics}

          {currentAnnotations ? (
            <AnnotationsBlock
              annotation={currentAnnotations}
              sections={song.sections}
              songTitle={song.title}
              onOpen={openAnnotations}
            />
          ) : null}

          {isAdmin ? null : (
            <Button
              label={t("songs.suggestChange")}
              variant="secondary"
              icon={<SuggestIcon size={15} color={Theme.colors.text} />}
              onPress={() => router.push(`/songs/${song.id}/suggest`)}
            />
          )}

          <View style={styles.footer}>
            {song.tags.length > 0 ? (
              <View style={styles.badges}>
                {song.tags.map((tag) => (
                  <Badge key={tag} label={tag} />
                ))}
              </View>
            ) : null}

            <AppText variant="caption" tone="faint">
              Added by {song.createdByName || "an admin"} · updated {formatRelativeTime(toDate(song.updatedAt))}
            </AppText>

            <View style={styles.footerActions}>
              <Pressable
                onPress={toggleFavorite}
                accessibilityRole="button"
                accessibilityState={{ selected: isFavorite(song.id) }}
                accessibilityLabel={
                  isFavorite(song.id) ? t("songs.unfavoriteA11y") : t("songs.favoriteA11y")
                }
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                {isFavorite(song.id) ? (
                  <StarFilledIcon size={15} color={Theme.colors.primary} />
                ) : (
                  <StarIcon size={15} color={Theme.colors.textMuted} />
                )}
                <AppText variant="caption" tone={isFavorite(song.id) ? "primary" : "muted"}>
                  {t("songs.favorite")}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => setAddToCollection(true)}
                accessibilityRole="button"
                accessibilityLabel={t("songs.addToCollectionA11y", { title: song.title })}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <LibraryIcon size={15} color={Theme.colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {t("songs.addToCollection")}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => void copyLyrics()}
                accessibilityRole="button"
                accessibilityLabel={t("songs.copyA11y")}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <CopyIcon size={15} color={Theme.colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {t("songs.copyLyrics")}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => void exportChordPro()}
                accessibilityRole="button"
                accessibilityLabel={t("songs.exportChordProA11y")}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <ExportIcon size={15} color={Theme.colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {t("songs.exportChordPro")}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => setPrintOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("songs.printA11y")}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <PrintIcon size={15} color={Theme.colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {t("songs.print")}
                </AppText>
              </Pressable>

              {isAdmin ? (
                <>
                  <Pressable
                    onPress={() =>
                      router.push(`/songs/${song.id}/history?title=${encodeURIComponent(song.title)}`)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t("songs.historyA11y", { title: song.title })}
                    style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
                  >
                    <ClockIcon size={15} color={Theme.colors.textMuted} />
                    <AppText variant="caption" tone="muted">
                      {t("songs.history")}
                    </AppText>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (!duplicating) void duplicate()
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("songs.duplicateA11y")}
                    accessibilityState={{ disabled: duplicating }}
                    style={({ pressed }) => [
                      styles.footerLink,
                      duplicating && { opacity: 0.5 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <CopyIcon size={15} color={Theme.colors.textMuted} />
                    <AppText variant="caption" tone="muted">
                      {t("songs.duplicate")}
                    </AppText>
                  </Pressable>

                  <Pressable
                    onPress={() => setMergeOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("songs.mergeA11y")}
                    style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
                  >
                    <SwapIcon size={15} color={Theme.colors.textMuted} />
                    <AppText variant="caption" tone="muted">
                      {t("songs.mergeWith")}
                    </AppText>
                  </Pressable>

                  <Pressable
                    onPress={() => setConfirmDelete(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("songs.moveToTrash")}
                    style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
                  >
                    <TrashIcon size={15} color={Theme.colors.danger} />
                    <AppText variant="caption" tone="danger">
                      {t("songs.moveToTrash")}
                    </AppText>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </Pressable>
      </ScreenContainer>

      {/* Order matters: the arrows are painted *before* the tray, so the tray
          is what sits on top of them. With the panel open it grows over the
          corner arrows and hides them, instead of the arrows floating over the
          controls — later siblings paint above earlier ones on Android. */}
      {step ? (
        <SongNavArrows
          previousId={step.previousId}
          nextId={step.nextId}
          onNavigate={openSong}
          bottomOffset={READER_DOCK_HEIGHT}
        />
      ) : null}

      <ReaderDock
        open={controlsOpen}
        onToggle={() => setControlsOpen((current) => !current)}
        summary={tuningSummary}
        summaryAccessibilityLabel={t("songs.controlsA11y", { tuning: tuningSummary })}
        autoscrollRunning={autoscrollRunning}
        autoscrollDisabled={!autoscroll.canScroll && autoscroll.status === "idle"}
        autoscrollLabel={autoscrollTransportLabel}
        autoscrollProgress={
          autoscrollRunning || autoscroll.status === "paused" ? autoscroll.progress : null
        }
        onAutoscrollToggle={autoscroll.toggle}
        metronomeActive={metronome.running}
        metronomeLabel={t("songs.metronome")}
        onMetronome={() => setMetronomeOpen(true)}
        stageLabel={t("songs.stageMode")}
        onStage={enterImmersive}
      >
        {controlsPanel}
      </ReaderDock>

      <Dialog
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        title={t("songs.performanceNotes")}
        confirmLabel={t("common.close")}
        onConfirm={() => setNotesOpen(false)}
      >
        <AppText variant="body" tone="muted">
          {song.notes}
        </AppText>
      </Dialog>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("songs.moveToTrashConfirm", { title: song.title })}
        description={t("songs.moveToTrashDescription")}
        confirmLabel={t("songs.moveToTrash")}
        tone="danger"
        confirmLoading={deleting}
        onConfirm={() => void remove()}
      />

      {mergeOpen && song ? (
        <MergeSongsDialog
          visible={mergeOpen}
          current={song}
          songs={songs}
          setlists={setlists}
          suggestions={suggestions}
          onClose={() => setMergeOpen(false)}
          onMerge={runMerge}
        />
      ) : null}

      <PrintSheet
        visible={printOpen}
        onClose={() => setPrintOpen(false)}
        title={song.title}
        render={(options) => songPrintHtml(song, options)}
      />

      <AddToCollectionSheet
        visible={addToCollection}
        onClose={() => setAddToCollection(false)}
        song={song}
      />

      <MetronomeSheet
        visible={metronomeOpen}
        onClose={() => setMetronomeOpen(false)}
        bpm={metronome.bpm}
        beatsPerMeasure={metronome.beatsPerMeasure}
        accent={metronome.accent}
        countIn={metronome.countIn}
        running={metronome.running}
        beat={metronome.beat}
        onTap={metronome.tap}
        onBpmChange={metronome.changeBpm}
        onBeatsPerMeasureChange={metronome.changeBeatsPerMeasure}
        onAccentChange={metronome.changeAccent}
        onCountInChange={metronome.changeCountIn}
        onToggle={metronome.toggle}
      />
      {chordSheet}
    </View>
  )
}

/**
 * Autoscroll settings chosen by hand during one visit of the reader. `null`
 * means "no choice yet", so the saved per-song state (or the default) applies.
 */
interface AutoscrollChoice {
  songId: string
  speed: number | null
  delay: AutoscrollDelay | null
}

const NO_AUTOSCROLL_CHOICE: AutoscrollChoice = { songId: "", speed: null, delay: null }

/**
 * Transpose and capo chosen by hand during one visit of the reader (roadmap
 * #4). `null` means "no choice yet", so the setlist's chosen key (or the saved
 * per-song value, or the song's own capo) applies. `playKey` tracks the key the
 * band chose so a live change re-applies while the reader is on screen.
 */
interface TuningChoice {
  songId: string
  playKey: string
  semitones: number | null
  capo: number | null
}

const NO_TUNING: TuningChoice = { songId: "", playKey: "", semitones: null, capo: null }

/**
 * Text size chosen by hand during one visit of the reader (roadmap #5). `null`
 * means "no choice yet", so the profile default applies.
 */
interface FontSizeChoice {
  songId: string
  size: number | null
}

const NO_FONT_SIZE_CHOICE: FontSizeChoice = { songId: "", size: null }

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1 },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    loading: { flex: 1, padding: Theme.spacing.l },
    scrollBody: { paddingTop: Theme.spacing.l },
    // The tray floats over the bottom of the lyrics, so the scroll needs room
    // for it (and, in a running order, for the corner arrows above it).
    content: { gap: Theme.spacing.l, paddingBottom: Theme.spacing.huge + READER_DOCK_HEIGHT },
    notes: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.lg,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    /**
     * The setlist entry's own note (roadmap #43) — a wash of the accent so it
     * reads as a sticky note pinned to this performance, not as song metadata.
     */
    setlistNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.xs,
      backgroundColor: Theme.colors.accentSoft,
      borderRadius: Theme.radii.s,
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: Theme.spacing.xs,
    },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    footer: {
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.m,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    footerActions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xl },
    footerLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    immersiveScroll: { flex: 1 },
    // One slim row: title + key on the left, the three stage actions on the
    // right. Nothing else competes with the song on a small display.
    immersiveBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.s,
      paddingBottom: Theme.spacing.m,
    },
    immersiveHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      flex: 1,
      minWidth: 0,
    },
    immersiveKey: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 8,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    immersiveActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      flexShrink: 0,
    },
    // Always carries a rounded background so Android never paints it square
    // when the on-state colour appears.
    keepAwakeChip: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    keepAwakeChipOn: {
      backgroundColor: Theme.colors.primarySoft,
      borderColor: Theme.colors.primary,
    },
    immersiveContent: {
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.s,
      paddingBottom: Theme.spacing.huge,
    },
    immersiveHeadingTitle: { flexShrink: 1 },
    /** Title stacked over the entry's note (only when the list has one). */
    immersiveHeadingText: { flex: 1, minWidth: 0, gap: 1 },
    // Room for the corner arrows, which are lifted over the tray, so they never
    // cover the last lines.
    withNavPadding: {
      paddingBottom: Theme.spacing.huge + READER_DOCK_HEIGHT + 56,
    },
    // Same job in stage mode, where there is no tray under the arrows.
    stageNavPadding: { paddingBottom: Theme.spacing.huge + 56 },
  })
