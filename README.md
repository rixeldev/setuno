<p align="center">
  <img src="assets/icon.png" alt="Stage Book" width="96" height="96" />
</p>

<h1 align="center">Stage Book</h1>

<p align="center">
  <strong>The band's songbook, setlists and gigs — in one place.</strong>
</p>

<p align="center">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black">
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
- [Documentation](#documentation)

---

## Features

| Area | What you can do |
| --- | --- |
| **Authentication** | Register, sign in, sign out, password reset, persistent sessions |
| **Bands (organizations)** | Create a band, rename it, set a logo, delete it, switch between bands |
| **Members & roles** | Invite by email, accept/decline invitations, admins & members, promote/demote, remove |
| **Songbook** | Create, edit and delete songs with lyrics, chords, tags, genre, BPM, capo and duration |
| **Chord editor** | Position chords freely over any lyric line, snap to words, section headers, paste import |
| **Transposition** | Move any song up/down by semitones — the stored song is never mutated |
| **Performance mode** | Full-screen stage view with adjustable font size, hidden chrome, chord visibility toggle |
| **Suggestions** | Members propose changes, admins accept/reject them with a note |
| **Setlists** | Build running orders, reorder songs, estimate duration |
| **Performances** | Schedule gigs with venue, times, status and an attached setlist |
| **Calendar** | Month view of upcoming and past shows |
| **Dashboard** | Next show, quick actions, library stats, recent activity feed |
| **Settings** | Profile, appearance (light/dark/accent), band settings, danger zone |
| **i18n** | Full English and Spanish translations |
| **Realtime** | Live Firestore listeners keep every device in sync |

---

## Tech stack

- **Expo SDK 57** + **React Native 0.81** (Continuous Native Generation — no hand-written `ios/`/`android/`)
- **Expo Router** for file-based navigation
- **TypeScript** (strict) — `any` is avoided throughout
- **Firebase**: Firestore, Auth, Storage, Cloud Functions
- **i18next** + `react-i18next` for localization
- **Vitest** for unit and integration tests
- **ESLint** (flat config) + Prettier

---

## Getting started

### Requirements

- Node 20+ and **pnpm** (the lockfile is `pnpm-lock.yaml`)
- A Firebase project with Firestore, Auth (email/password) and Storage enabled
- Expo Go on your phone, or an Android emulator / iOS simulator

### 1. Install

```bash
pnpm install
```

### 2. Configure Firebase

The Firebase config lives in `db/firebaseConfig.ts`. **Do not create a second config file** — every
service imports the shared app from `db/Fire.ts`.

Web additionally resolves `@react-native-firebase/*` through Metro shims (see
[Architecture](#architecture)), so the same code runs unmodified in the browser.

### 3. Security rules

```bash
firebase deploy --only firestore:rules
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
| `pnpm export:web` | Production web export to `dist/` |

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
    members.tsx         Members, invitations, roles
    organizations/      Switch band, create band
    settings/           Profile, band, appearance
    more.tsx            Mobile overflow menu
components/             UI kit (ui/), screen widgets (app/), domain (songs/, setlists/, performances/)
hooks/                  useAuth, useOrganization, useOrgData, useThemedStyles
services/               Firebase data layer (songs, setlists, performances, suggestions, auth, users…)
db/                     Fire.ts (single Firebase entry point) + firebaseConfig.ts
libs/                   Pure helpers: chords, songUtils, validation, format, songSearch, navigation
interfaces/             Shared TypeScript domain models
constants/              Theme.ts — Stage Book design tokens
locales/                en.json, es.json
shims/                  Web implementations for native-only modules
firestore.rules         Production security rules
docs/                   app_implementation.md — full product spec
tests/                  unit/ and integration/
```

---

## Architecture

**One Firebase entry point.** All Firestore/Auth/Storage access is funnelled through `db/Fire.ts`,
which re-exports the configured app, helpers and path builders. Services (`services/*.ts`) are the
only code that talks to Firestore, and screens only talk to services.

**Web via Metro shims.** `metro.config.js` maps `@react-native-firebase/app|auth|firestore|storage`
and `firebase/auth` to `shims/*.web.ts`, so the identical service layer runs in the browser against
the web SDK. Validated with `pnpm export:web`.

**Single source of truth for org data.** `hooks/useOrgData.tsx` opens one live listener per
collection (songs, setlists, performances, suggestions, members, invitations, activity) and shares
the snapshot with every screen through context. The snapshot is tagged with the active organization
id, so switching bands never shows the previous band's data.

**Design system.** `constants/Theme.ts` holds the Stage Book tokens (colors, spacing, radii).
Styles are built with `useThemedStyles(createStyles)`, which rebuilds once per palette change.
Reusable primitives live in `components/ui/` (`Button`, `Input`, `Card`, `Dialog`, `Toast`,
`States`, `PageHeader`, `Icons`…).

**Transposition is presentation-only.** `libs/chords.ts` and `libs/songUtils.ts` transpose for
display; the stored song document is never rewritten by a viewer changing their local key.

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
- Nobody can change their own role, admins included.
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

**Keep both locale files in sync** — every new user-facing string needs a key in `en.json` *and*
`es.json`. Interpolation uses `{{variable}}`; plurals use `_one` / `_other` suffixes.

---

## Testing

Unit tests cover the pure domain logic: chord parsing/transposition, song document manipulation,
validation, formatting, search/facets, error mapping, and a structural guard that every navigation
href resolves to a route file with a default export.

```bash
pnpm test            # unit
pnpm test:integration  # requires the Firebase emulator (see tests/integration/README.md)
```

Manual QA checklist for permissions and flows lives in `docs/app_implementation.md` §47.

---

## Documentation

- **[`docs/app_implementation.md`](./docs/app_implementation.md)** — the authoritative 52-section
  product spec (data model, sections per screen, permissions, definition of done).
- **[`AGENTS.md`](./AGENTS.md)** — conventions for contributors and coding agents.
- **[`firestore.rules`](./firestore.rules)** — security rules with inline rationale.
