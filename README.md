<p align="center">
  <img src="assets/icon.png" alt="Setuno" width="96" height="96" />
</p>

<h1 align="center">Setuno</h1>

<p align="center">
  <strong>The band's songbook, setlists and gigs — in one place.</strong>
</p>

<p align="center">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black">
  <img alt="i18n" src="https://img.shields.io/badge/i18n-EN%20%7C%20ES-8A2BE2">
  <a href="https://github.com/rixeldev/setuno/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/rixeldev/setuno/actions/workflows/ci.yml/badge.svg"></a>
</p>

---

Setuno is a cross-platform app for musicians and bands: build a shared songbook with a
chord/lyric editor, arrange setlists, schedule performances, and manage who gets to edit what.
Everything runs on a **real Firebase backend** — no mocks, no stubs.

Runs on **Android**, **iOS** and **Web** from a single codebase, with a bottom tab bar on phones and
a sidebar layout on the web.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Security rules](#security-rules)
- [Internationalization](#internationalization)
- [Testing](#testing)
- [Deploy](#deploy)
- [Documentation](#documentation)

---

## Features

| Area | What you can do |
| --- | --- |
| **Authentication** | Register, sign in (email or Google), sign out, password reset, persistent sessions |
| **Usernames** | Unique, case-insensitive username per account; one rename every 3 months |
| **Your data, your call** | Take everything Setuno stores about you with you: one JSON export (profile, bands, songs, your personal data) handed to the share sheet or downloaded. Or delete the account for good behind a password or Google re-confirmation — you walk out of every band (a band left with nobody in it goes too; one left without an admin promotes its most senior member), your username is freed and your private data is erased, while the band keeps what it made together |
| **Bands (organizations)** | Create a band, rename it, set a logo, delete it, switch between bands |
| **Members & roles** | Invite by email, accept/decline invitations, admins & members, promote/demote, remove; profiles stay in sync per band |
| **Songbook** | Create, edit and delete songs with lyrics, chords, tags, genre, BPM, capo and duration; paste a lyric block (section headers, inline `[C]` chords and other apps' metadata are handled) with a live preview |
| **Advanced search** | Instant search across title, artist, genre, tags and key, plus a filter panel: artist/genre/key/tag chips, tempo (slow / medium / fast / sprint) and length (short / standard / long) buckets, and a chord-progression search that matches `Am F C G` as a run of chords on one lyric line |
| **Usage history** | Every song the band has played says so — "played 12 times · last played 3 events ago" in the reader, derived from the setlists of completed events (nothing extra is stored) — the filter panel can show only what has never been played or has not been played recently, and the setlist picker's **"Not played in 3 gigs"** switch turns its list into a rotation: the most neglected songs first, so the next setlist refreshes the repertoire |
| **Band stats & year recap** | Derived top songs, average set length, music minutes and activity per member, plus a shareable year-in-review card (captured as a PNG on Android, iOS and web) |
| **Your last view, remembered** | The songbook reopens with the filters you left on and the order you chose — stored separately for every band and every member, offline included — and can sort by title, artist, recency, tempo or length, with anything unmeasured listed last |
| **Chord editor** | Position chords freely over any lyric line, snap to words, move by character, custom section headers |
| **Chord autocomplete & validation** | Suggest chords live while you type (key-aware, from your recents and the common palette); unrecognised or foreign-notation chords are flagged and warned about before saving |
| **Undo/redo** | Undo and redo in the chord editor with toolbar buttons, plus Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y on the desktop (in memory, per editing session) |
| **Section blocks** | Insert a standard block (intro, verse, pre-chorus, chorus, bridge, outro, instrumental) after any section, duplicate or reorder sections, and tag a section with an optional bar count |
| **Duplicate warning** | Creating a song whose title (and artist) the band already has opens a dialog first — open the existing song, or create yours anyway |
| **Duplicate & merge** | Admins can duplicate a song straight into a variant's editor, or fold two copies together: pick which one survives, see how many setlists and suggestions move across, and the other is deleted in one step |
| **Version history** | Every save keeps the version it replaced (up to 20 per song): open the history from the reader, compare any version with the song as it is now — struck text is what was lost, highlighted text what was gained — and restore it behind a confirmation; the current state is saved first, so a restore can itself be undone |
| **Song status** | Mark a song as **draft**, **active** or **retired** from its editor; the songbook badges the exceptions, and retired songs stay searchable everywhere while being skipped when you build a setlist — until you switch on "Include retired" in the picker |
| **Trash and recovery** | Deleting a song from the reader moves it to the **trash** instead of destroying it: restore it anytime, or an admin can delete it — and its version history — forever. Songs left 30 days in the trash are then cleaned up automatically. Trashed songs vanish from the songbook, search and setlist pickers |
| **Unread activity** | The band's activity feed now knows what you have seen: the Home tab carries an unread badge and opening the dashboard clears it. Each member's marker is private — the band never learns who read what |
| **Push notifications** | Your phone buzzes when something happens in the band: new suggestions, a verdict on yours, a new event, an invitation or a membership change. Each of the five types can be switched off per account in Settings, and each device has its own on/off switch — the app never asks for permission until you flip it (native builds only; the web app keeps the preferences) |
| **Favourite voicings** | Pin a preferred guitar position per chord; the play guide opens on it from then on (stored on your profile, not the song) |
| **Transposition** | Move any song up/down by semitones — the stored song is never mutated |
| **Play guide** | Tap any chord while reading to see how to play it: every guitar or ukulele position (capo-aware), the root position on a 5-string bass diagram, or the piano keys — and hear the exact voicing on screen, synthesized on the device (no samples, works offline) |
| **Chord notation & layout** | Spell chords as letters (C F#m), solfège (Do Fa#m) or Nashville numbers (1 4 5, relative to the song's key); show chords above the lyrics, lyrics only, or a chords-only chart |
| **Stage mode** | Full-screen reading with adjustable font size and chord visibility that survives stepping to the next song; holds a screen wake lock (toggleable) so the display never sleeps mid-show |
| **Autoscroll** | Hands-free reading with a start delay, a speed in lyric lines per minute and a resume button; manual scrolling pauses it, and each song remembers its own speed (per user) |
| **Metronome** | Practice at the song's tempo without leaving the reader: BPM from the song (or tapped by ear), bar size, downbeat accent, count-in and a beat pulse you feel in your pocket |
| **Section loops** | Tap any section's header to drill it: a count-in bar and then the section on repeat at the current tempo — pass and bar on screen — until you stop. It rides the metronome's own click grid, so it never drifts; needs the section's bar count (set it in the editor) |
| **Tuner** | Chromatic tuner for any instrument: the note in your own chord notation, a plain-language verdict ("Sharp — lower it 4 cents") over a ±50-cent gauge with a green in-tune band, and a tap of confirmation the moment you hit it. The analysis runs entirely on the device (~2.5 ms per reading, no network) |
| **Personal notes** | Private cues per song ("I come in here", "second chorus only") — a free-form notes block plus inline notes anchored to a section/line, visible only to you and synced across your devices |
| **Favourites & collections** | Star the songs you always want in the setlist from the reader footer and filter the songbook to favourites only; file songs into private collections only you can see, then turn one into a real band setlist in a single step |
| **Resume where you left off** | Each song reopens at the spot, key and capo you left it in (per user, synced across devices); the refresh button is a one-tap reset to the top, original key and no capo |
| **Per-song text size** | Pinch the lyrics to resize (or Ctrl/Cmd +/- on the desktop); each song remembers its own size, synced across your devices |
| **Keyboard & pedal** | On web/desktop the reader answers the keyboard: arrows/space/PageUp/PageDown turn the page (Bluetooth page-turner pedals send these same keys), up/down transpose, `f` toggles stage mode, `p` autoscroll |
| **Live show mode** | While reading from an event's setlist: position in the running order, elapsed vs estimated time, a peek at the next song and a break countdown — the clock survives stepping song to song. Mark each song **played / skipped / improvised** while the show runs, then review the night in the **post-gig report**: the real time per song against the estimate, a note per song, and the skips feeding the usage history and the year recap |
| **Tablet & landscape** | On tablets, desktop and a phone in landscape the song flows down two balanced columns (sections are never split); phones stay single-column, and stage mode keeps working in landscape |
| **Reference links** | Optional YouTube / Spotify / Apple Music links per song, edited under “More details” and opened in the matching app from the reader (no embedding) |
| **ChordPro import/export** | Paste a ChordPro document into the song form to load its lyrics and chords, and export any song back to a `.cho` file from the reader |
| **Print & PDF** | Print a song or a whole setlist — with chords or lyrics only, at three text sizes — and share it as a PDF or send it straight to a printer; a setlist prints each song in the key the band actually plays it in |
| **Share by link or QR** | Hand a song or a whole setlist to anyone: mint a public read-only link — no account needed — shown as a QR code plus a copyable URL, optionally expiring (7 or 30 days) and revocable anytime by its creator or an admin. The link opens a clean public page: the song's lyrics and chords, or the setlist's running order with its dividers, notes and play keys. Share a gig's setlist and flip **Public live setlist** on: fans watching the link see a LIVE banner with the song the band is playing right now and where in the set it sits, moving as the show runs and settling into “this is how the night ran” once the position goes quiet |
| **Setlist running order** | Open a song from an event's setlist and step through it with corner arrows |
| **Suggestions** | Members propose changes, admins accept/reject them with a note, and every suggestion carries an open comment thread (removed comments stay visible as "removed") |
| **Setlists** | Build running orders — with **Set 1 / Break / Encore dividers**, a per-song note the band reads in the reader ("tune Eb") and a **goal**: target minutes with breaks counted inside, plus a live "5m left / 6m over" readout while you edit. Lists live under their events, and any list can be duplicated or saved as a **template** (45-min, acoustic, wedding) that lives outside events |
| **Performances** | Schedule the band's events — **gigs and rehearsals**: the type is picked when creating one, a rehearsal carries its own **goals** instead of notes, both filter lists (and the calendar) by type, and only rehearsals wear the badge |
| **RSVP & gig tasks** | Answer any event (going / maybe / can't) and see who's coming at a glance; the event also carries a live **"who brings what"** checklist — assign each task to a member or to anyone, tick it off together, and the whole band sees it update |
| **Date polls** | Propose candidate dates and let the band tick the nights they can make; an admin closes the poll on the winner (most votes, ties to the earliest date) and turns it into a real event in one tap |
| **Reusable checklists** | Save your per-type lists once — gear, setup, payments or anything custom — and stamp any of them onto an event from its task card in one tap, where they become ordinary tasks anyone can tick |
| **Calendar** | Month, week and agenda views of upcoming and past events, filtered by status and by gig/rehearsal |
| **Calendar export** | Save the band calendar or a single event as an `.ics` file — share sheet on mobile, download on web — with stable UIDs so re-imports update instead of duplicating |
| **Dashboard** | Next show, quick actions, library stats, recent activity feed |
| **Onboarding** | A four-slide welcome for brand-new accounts, then a step-by-step tour of the real reader and chord editor, with the sample song as the playground |
| **Settings** | Profile, theme (dark/light/system), language (EN/ES), band settings, danger zone |
| **Modals** | Members, suggestions, the band switcher, profile and the chord play guide open as modal sheets over the current screen |
| **Ads** | Google Mobile Ads banner under the navigation (native builds; hidden when there is no fill) |
| **i18n** | Full English and Spanish translations, guarded by a structural test |
| **Realtime** | Live Firestore listeners keep every device in sync |
| **Offline** | Writes are stored on the device and synchronized automatically when the connection returns |

---

## Tech stack

- **Expo SDK 57** + **React Native 0.86** (Continuous Native Generation — no hand-written `ios/`/`android/`)
- **Expo Router** for file-based navigation
- **TypeScript** (strict) — `any` is avoided throughout
- **Firebase**: Firestore, Auth, Storage, Cloud Functions
- **Google Sign-In** (native SDK on Android/iOS, Firebase popup on web) and **Google Mobile Ads** (native)
- **Chord play guide**: guitar voicings from the open [chords-db](https://github.com/tombatossals/chords-db) dataset (MIT, bundled) plus piano notes derived from the chord spelling; slash chords (`C/G`) resolve to their dedicated voicing, and when the dataset lacks it the plain shape is shown with a clear label
- **Custom translucent overlays** (`SheetSurface`): dialog, bottom sheet and modal screens share one spring entrance
- **i18next** + `react-i18next` for localization (EN/ES, parity guarded by tests)
- **JetBrains Mono** bundled for the chord/lyric grids, **Onest** for the UI
- **Vitest** for unit and integration tests
- **ESLint** (flat config) + Prettier

---

## Getting started

### Requirements

- Node 20+ and **pnpm** (the lockfile is `pnpm-lock.yaml`)
- A Firebase project with Firestore, Auth (email/password + Google) and Storage enabled
- A **development build** (`npx expo run:android|ios` or `eas build --profile development`) — the app uses native modules (Google Sign-In, Mobile Ads) that Expo Go does not include

### 1. Install

```bash
pnpm install
```

### 2. Configure Firebase

The Firebase config lives in `db/firebaseConfig.ts`. **Do not create a second config file** — every
service imports the shared app from `db/Fire.ts`. On CI (Vercel), the file is generated by
`scripts/ensure-firebase-config.mjs` from `FIREBASE_*` environment variables, so it stays out of git.

For Android Google Sign-In, copy `.env.example` to `.env` and set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
(Firebase Console → Authentication → Google → Web client ID), and register the app's SHA-1 in Firebase.

For **native builds**, also set `EXPO_PUBLIC_WEB_BASE_URL` to the deployed web address (for example
`https://setuno.vercel.app`): share links point at the public `/share/<token>` page, the browser
knows its own origin but a phone build does not. Without it the share sheet still opens and
explains that this build cannot mint a link.

Web additionally resolves `@react-native-firebase/*` through Metro shims (see
[Architecture](#architecture)), so the same code runs unmodified in the browser.

### 3. Security rules

```bash
pnpm deploy:rules      # firestore.rules → the project pinned in .firebaserc
pnpm deploy:indexes    # firestore.indexes.json (keep the file in sync first)
pnpm deploy:storage    # storage.rules (avatar and band-logo uploads)
```

Rules live in [`firestore.rules`](./firestore.rules) and are documented in
[Security rules](#security-rules).

### 4. Run it

```bash
pnpm web        # browser
pnpm android    # Android device/emulator
pnpm ios        # iOS simulator (macOS)
pnpm start      # Expo dev server, pick a target from the menu
```

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm start` | Start the Expo dev server |
| `pnpm web` | Run on the web |
| `pnpm android` | Run on Android |
| `pnpm ios` | Run on iOS |
| `pnpm typecheck` | TypeScript check (`tsc --noEmit`) |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint with autofix |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm test:integration` | Integration tests (Firebase emulator required) |
| `pnpm test:all` | All tests |
| `pnpm export:web` | Production web export to `dist/` (generates `db/firebaseConfig.ts` when missing) |
| `pnpm deploy:rules` | Publish `firestore.rules` to the pinned Firebase project |
| `pnpm deploy:indexes` | Publish `firestore.indexes.json` |
| `pnpm deploy:storage` | Publish `storage.rules` |
| `pnpm assets:generate` | Regenerate the launcher icons in `assets/icons` from the brand masters |
| `pnpm assets:store [es\|en]` | Build the Play Store graphics (feature graphic + 5 screenshots) from the captures in `docs/images/` |

> **Before declaring any task done:** `pnpm typecheck` and `pnpm lint` must both pass.

---

## Project structure

```
app/                    Expo Router — every file here is a screen
  _layout.tsx           Root: fonts, appearance, providers, i18n
  index.tsx             Entry redirect
  (auth)/               Welcome, sign in, sign up, password reset
  (app)/                Authenticated area inside AppShell
    index.tsx           Dashboard
    songs/              Songbook + editor + reader + suggest
    suggestions/        Suggestion list, composer, review
    setlists/           Setlists list, create, detail, edit
    performances/       Gigs list, create, detail, edit
    calendar.tsx        Month calendar
    members.tsx         Members, invitations, roles (modal)
    organizations/      Switch band, create band (modals)
    settings/           Settings hub (language + theme sheets), profile modal, band
    more.tsx            Mobile overflow menu
components/             UI kit (ui/), screen widgets (app/), domain widgets (songs/ incl. chord diagrams + play-guide sheet, setlists/, performances/), settings sheets
hooks/                  useAuth, useOrganization, useOrgData, useThemedStyles, useTabNavigation, useReaderSession, useBottomChrome
services/               Firebase data layer (songs, setlists, performances, suggestions, organizations, usernames, auth, users…)
db/                     Fire.ts (single Firebase entry point) + firebaseConfig.ts (generated on CI)
functions/              Cloud Functions workspace (Node 22, pnpm member): the scheduled trash purge
libs/                   Pure helpers: chords, chordShapes, songUtils, setlistNavigation, validation, format, songSearch, navigation, username
interfaces/             Shared TypeScript domain models
constants/              Theme.ts — Setuno design tokens
locales/                en.json, es.json (kept structurally identical)
scripts/                ensure-firebase-config.mjs (CI Firebase config), generate-assets.mjs (assets/icons)
shims/                  Web implementations for native-only modules
firestore.rules         Production security rules
storage.rules           Cloud Storage rules (avatars and band logos)
vercel.json             Web deploy config (build command, SPA rewrites, asset caching)
docs/                   app_implementation.md — full product spec
tests/                  unit/ and integration/ (includes the routes, i18n and RNW guard tests)
```

---

## Architecture

**One Firebase entry point.** All Firestore/Auth/Storage access is funnelled through `db/Fire.ts`,
which re-exports the configured app, helpers and path builders. Services (`services/*.ts`) are the
only code that talks to Firestore, and screens only talk to services.

**Web via Metro shims.** `metro.config.js` maps `@react-native-firebase/app|auth|firestore|storage`
and `firebase/auth` to `shims/*.web.ts`, so the identical service layer runs in the browser against
the web SDK. Validated with `pnpm export:web`.

**Offline-first.** Firestore keeps every write in the on-device cache first and replays the queue by
itself when the connection returns (native persistence is on by default; the web build enables an
IndexedDB `persistentLocalCache` in `db/firestoreInstance.web.ts`, so a reload does not lose pending
writes). `services/sync.ts` watches connectivity and the queue, and `components/app/SyncBanner.tsx`
tells the user what is happening: saved on the device → syncing → everything up to date.

**Single source of truth for org data.** `hooks/useOrgData.tsx` opens one live listener per
collection (songs, setlists, performances, suggestions, members, invitations, activity) and shares
the snapshot with every screen through context. The snapshot is tagged with the active organization
id, so switching bands never shows the previous band's data.

**Design system.** `constants/Theme.ts` holds the Setuno tokens (colors, spacing, radii).
Styles are built with `useThemedStyles(createStyles)`, which rebuilds once per palette change — the
theme follows dark, light or the device scheme (`"system"`). The palette is derived from six accents
(`libs/appearance.ts`): dark surfaces get a subtle tint of the accent, and light mode darkens the
accent itself so text and icons keep AA contrast. Reusable primitives live in
`components/ui/` (`Button`, `Input`, `Card`, `Dialog`, `BottomSheet`, `Toast`, `States`,
`PageHeader`, `Icons`…). The chord/lyric grids are drawn in a bundled **JetBrains Mono** (imported
per weight, so only the faces in use ship), which keeps every padded chord column aligned on every
platform. Every screen carries an accessible go-back button in its header
(`PageHeader` shows it automatically when the router can go back).

**Modals & bottom sheets.** Screens that interrupt the current task — `members`, the suggestions
inbox, `settings/profile`, the band switcher and *New band* — are registered with
`presentation: "transparentModal"` in `app/(app)/_layout.tsx` and rendered through
`components/app/ModalScreen.tsx`: a spring-animated panel floating on a **translucent** backdrop
(bottom sheet on phones, centred dialog on web). Short option pickers (language, theme) use the same
`components/ui/SheetSurface.tsx` primitive, so every overlay animates and dims identically.

**Editing flows are protected.** While a song, setlist or show form is open, `AppShell` hides the
bottom bar/sidebar (`isFocusRoute()`), and every form runs `useUnsavedChanges()` with
`DiscardChangesDialog` so back gestures, tab presses or closing the browser ask before throwing the
draft away.

**Transposition is presentation-only.** `libs/chords.ts` and `libs/songUtils.ts` transpose for
display; the stored song document is never rewritten by a viewer changing their local key.

**Tabs never stack.** The shell is a single stack: pressing a tab collapses it to `[Home, currentTab]`
(`hooks/useTabNavigation.ts`), so the native back button from any tab root lands on the dashboard
instead of walking through the visited tabs. Tab roots switch instantly (`animation: "none"`), and the
*More* tab stays lit while one of its hosted routes is open.

**The reader plays the show.** Opening a song from a setlist screen arms corner arrows that step
through exactly that running order (`libs/setlistNavigation.ts`), in the right direction
(`animationTypeForReplace`), keeping stage mode across songs. Tapping any chord opens the play guide:
every guitar position (from the bundled MIT chords-db dataset) or the piano keys derived from the
chord spelling — with the current capo applied to the guitar shapes.

**Floating UI follows the chrome.** The shell reports the measured height of the tab bar + ad banner
(`hooks/useBottomChrome.ts`) so the toast always anchors right above whatever is on screen, and the
banner keeps one persistent slot under the navigation instead of appearing and disappearing with
each tab.

---

## Security rules

[`firestore.rules`](./firestore.rules) enforces:

- Only **members** can read anything inside their band.
- Only **admins** can create/edit songs, setlists and performances; **any member** can create a
  suggestion but nobody can resolve their own.
- Membership is granted only through an **email-keyed invitation** that the matching authenticated
  account accepts in the same batch that creates the membership — nobody can add another person's
  account for them.
- **`users/{uid}` is private**: no client can look up another account by email, which is what keeps
  invite-by-email honest.
- **Usernames** are claimed atomically in the public `usernames/{name}` registry (case-insensitive);
  renaming claims the new key and releases the old one, limited to one change every 90 days.
- Nobody can change their own role, admins included. A band's admins may only sync the mirrored
  `role` of a member's private band index (or remove that mirror when removing them), and every user
  keeps their own name/email/photo copy in step with their profile.
- `activity` is append-only; organizations are deletable only by their owner.

---

## Internationalization

Translations live in `locales/en.json` and `locales/es.json`, loaded by `services/i18next.ts` at
startup. Use the hook anywhere in the tree:

```tsx
import { useTranslation } from "react-i18next"

const { t } = useTranslation()
t("songs.newSong")
t("toasts.suggestionSent")
```

The app starts in the **device language**. The Settings → Language sheet offers **English / Español**;
choosing one stores it on the device (`services/i18next.ts`) and it is restored before the first frame.

**Keep both locale files in sync** — every new user-facing string needs a key in `en.json` *and*
`es.json`. Interpolation uses `{{variable}}`; plurals use `_one` / `_other` suffixes.
`tests/unit/i18n.test.ts` enforces the parity and that every statically referenced key exists.

---

## Testing

Unit tests cover the pure domain logic: chord parsing/transposition, chord shapes (guitar lookup,
piano notes, capo), song document manipulation, setlist stepping, username rules, validation,
formatting, search/facets and error mapping. Structural guards keep the tree honest:
`routes.test.ts` (every navigation href resolves to a route file), `i18n.test.ts` (locale parity +
static keys) and `rnwDeprecations.test.ts` (no `pointerEvents` props).

```bash
pnpm test            # unit
pnpm test:integration  # requires the Firebase emulator (see tests/integration/README.md)
```

Manual QA checklist for permissions and flows lives in `docs/app_implementation.md` §47.

---

## Deploy

- **Web**: `vercel.json` is ready — it runs `pnpm export:web`, serves `dist`, rewrites every route to
  `index.html` (Expo Router single-page export) and caches hashed assets immutably. Deploy with
  `npx vercel --prod` or import the repo in Vercel (set the `FIREBASE_*` environment variables there;
  `db/firebaseConfig.ts` is generated at build time). Add the production domain in Firebase →
  Authentication → **Authorized domains** or browser Google sign-in fails with
  `auth/unauthorized-domain`.
- **Android / iOS**: EAS (`eas build`, `eas submit`, `eas update`) from this same repo — the native
  projects are generated on the fly, nothing to keep in git.

---

## Documentation

- **[`docs/app_implementation.md`](./docs/app_implementation.md)** — the authoritative 52-section
  product spec (data model, sections per screen, permissions, definition of done).
- **[`AGENTS.md`](./AGENTS.md)** — conventions for contributors and coding agents.
- **[`firestore.rules`](./firestore.rules)** — security rules with inline rationale.
