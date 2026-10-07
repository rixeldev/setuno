<p align="center">
  <img src="assets/icon.png" alt="Stage Book" width="96" height="96" />
</p>

<h1 align="center">Stage Book</h1>

<p align="center">
  <strong>The band's songbook, setlists and gigs — in one place.</strong>
</p>

<p align="center">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black">
  <img alt="i18n" src="https://img.shields.io/badge/i18n-EN%20%7C%20ES-8A2BE2">
</p>

---

Stage Book is a cross-platform app for musicians and bands: build a shared songbook with a
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
| **Bands (organizations)** | Create a band, rename it, set a logo, delete it, switch between bands |
| **Members & roles** | Invite by email, accept/decline invitations, admins & members, promote/demote, remove; profiles stay in sync per band |
| **Songbook** | Create, edit and delete songs with lyrics, chords, tags, genre, BPM, capo and duration; paste a lyric block and section headers are detected |
| **Chord editor** | Position chords freely over any lyric line, snap to words, move by character, custom section headers |
| **Transposition** | Move any song up/down by semitones — the stored song is never mutated |
| **Play guide** | Tap any chord while reading to see how to play it: every guitar position (capo-aware) or the piano keys |
| **Stage mode** | Full-screen reading with adjustable font size and chord visibility that survives stepping to the next song |
| **Setlist running order** | Open a song from an event's setlist and step through it with corner arrows |
| **Suggestions** | Members propose changes, admins accept/reject them with a note |
| **Setlists** | Build running orders, reorder songs, estimate duration; lists live under their events |
| **Performances** | Schedule gigs with venue, times, status and attached setlists |
| **Calendar** | Month view of upcoming and past shows |
| **Dashboard** | Next show, quick actions, library stats, recent activity feed |
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
- **Chord play guide**: guitar voicings from the open [chords-db](https://github.com/tombatossals/chords-db) dataset (MIT, bundled) plus piano notes derived from the chord spelling
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

Web additionally resolves `@react-native-firebase/*` through Metro shims (see
[Architecture](#architecture)), so the same code runs unmodified in the browser.

### 3. Security rules

```bash
pnpm deploy:rules      # firestore.rules → the project pinned in .firebaserc
pnpm deploy:indexes    # firestore.indexes.json (keep the file in sync first)
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
| `pnpm assets:generate` | Regenerate the launcher icons/splash from `scripts/generate-assets.mjs` |
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
libs/                   Pure helpers: chords, chordShapes, songUtils, setlistNavigation, validation, format, songSearch, navigation, username
interfaces/             Shared TypeScript domain models
constants/              Theme.ts — Stage Book design tokens
locales/                en.json, es.json (kept structurally identical)
scripts/                ensure-firebase-config.mjs (CI Firebase config), generate-assets.mjs (icons/splash)
shims/                  Web implementations for native-only modules
firestore.rules         Production security rules
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

**Design system.** `constants/Theme.ts` holds the Stage Book tokens (colors, spacing, radii).
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
