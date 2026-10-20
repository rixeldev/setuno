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
- [App Check](#app-check)
- [Email link sign-in](#email-link-sign-in)
- [Deep links](#deep-links)
- [Installable web app](#installable-web-app)
- [Android home-screen widget](#android-home-screen-widget)
- [The Pro plan](#the-pro-plan)
- [Backups](#backups)
- [Staging](#staging)
- [Internationalization](#internationalization)
- [Testing](#testing)
- [E2E](#e2e)
- [Deploy](#deploy)
- [Documentation](#documentation)

---

## Features

| Area | What you can do |
| --- | --- |
| **Authentication** | Register, sign in (email, **a one-time email link**, or Google), sign out, password reset, persistent sessions |
| **Usernames** | Unique, case-insensitive username per account; one rename every 3 months |
| **Your data, your call** | Take everything Setuno stores about you with you: one JSON export (profile, bands, songs, your personal data) handed to the share sheet or downloaded. Or delete the account for good behind a password or Google re-confirmation — you walk out of every band (a band left with nobody in it goes too; one left without an admin promotes its most senior member), your username is freed and your private data is erased, while the band keeps what it made together |
| **Bands (organizations)** | Create a band, rename it, set a logo, delete it, switch between bands |
| **Members & roles** | Invite by email (as admin, member or **guest**), accept/decline invitations, promote/demote, remove; profiles stay in sync per band. A **guest** is read-only, made for substitutes and techs: they read the songs, setlists and events but never write, suggest or see the activity feed |
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
| **Push notifications** | Your phone buzzes when something happens in the band: new suggestions, a verdict on yours, a mention in a comment, a suggestion assigned to you, a new event, an invitation or a membership change. Each of the seven types can be switched off per account in Settings, and each device has its own on/off switch — the app never asks for permission until you flip it (native builds only; the web app keeps the preferences) |
| **Sessions & devices** | Settings lists every phone and tablet signed in to this account — platform, when it was last seen, and which row is this device — and **Sign out everywhere** ends every session on every device, browsers included, in one step. Browser sessions aren't listed individually: Firebase keeps them private, so the screen says so instead of pretending to be a full session manager |
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
| **Attachments** | Give a song its paperwork next to the lyrics: PDFs stored in the band's private storage (a chart, a lead sheet — up to 20 files of 10 MB each) and any link (rehearsal recording, reference track), every entry with its own note. Edited under “More details”, read as chips in the reader that open with a tap — removing a chip never deletes the file, since a duplicated song can share it |
| **ChordPro import/export** | Paste a ChordPro document into the song form to load its lyrics and chords, and export any song back to a `.cho` file from the reader |
| **Print & PDF** | Print a song or a whole setlist — with chords or lyrics only, at three text sizes — and share it as a PDF or send it straight to a printer; a setlist prints each song in the key the band actually plays it in |
| **Share by link or QR** | Hand a song or a whole setlist to anyone: mint a public read-only link — no account needed — shown as a QR code plus a copyable URL, optionally expiring (7 or 30 days) and revocable anytime by its creator or an admin. The link opens a clean public page: the song's lyrics and chords, or the setlist's running order with its dividers, notes and play keys. Share a gig's setlist and flip **Public live setlist** on: fans watching the link see a LIVE banner with the song the band is playing right now and where in the set it sits, moving as the show runs and settling into “this is how the night ran” once the position goes quiet |
| **Setlist running order** | Open a song from an event's setlist and step through it with corner arrows |
| **Suggestions** | Members propose changes, admins accept/reject them with a note, and every suggestion carries an open comment thread (removed comments stay visible as "removed"). In the thread, `@` a bandmate to mention them — the handle lights up and they get a push — and any member can assign the suggestion to whoever should fix it (unassigning is just as easy) |
| **Setlists** | Build running orders — with **Set 1 / Break / Encore dividers**, a per-song note the band reads in the reader ("tune Eb") and a **goal**: target minutes with breaks counted inside, plus a live "5m left / 6m over" readout while you edit. Lists live under their events, and any list can be duplicated or saved as a **template** (45-min, acoustic, wedding) that lives outside events. A **repertoire assistant** drafts a running order for you: it fills the slot with the songs the band has played least and arranges them from warm-up to peak and back down — deterministic, and yours to rearrange |
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
| **In-app rating** | Once you have read through setlists three times, the app asks for your App Store / Play rating at a quiet moment — after you leave the reader, never mid-song or at launch — at most three times a year and at least 90 days apart. The browser version skips it: ratings belong to the stores |
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
explains that this build cannot mint a link. The same address is where an emailed sign-in link
comes back to — see [Email link sign-in](#email-link-sign-in).

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
| `pnpm backup:status` | List the Firestore backup schedule(s) and backups ([Backups](#backups)) |
| `pnpm backup:wait` | Poll until the first scheduled backup is READY |
| `pnpm backup:drill` | Restore the newest backup into a scratch database and delete it again |
| `pnpm backup:cleanup` | Remove the scratch drill database left by `backup:drill -- --keep` |
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
`PageHeader`, `Icons`…). Contrast is **CI-pinned, never tuned by eye**:
`tests/unit/themeContrast.test.ts` asserts WCAG AA for every semantic pair across all six accents
× light/dark against the real palette derivation, and decorative images, focus order, dynamic
type and screen-reader labels follow the spec's §53 accessibility checklist. The chord/lyric
grids are drawn in a bundled **JetBrains Mono** (imported
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

- Any roster member can read their band's music and logistics, the read-only **guest** role
  included — while suggestions, their comments, the activity feed, date polls and the checklist
  library stay plain-member: a guest reads the night, not the band's conversation.
- Only **admins** can create/edit songs, setlists and performances; **any member** can create a
  suggestion but nobody can resolve their own — and a guest can create nothing at all. A member
  may also flip a pending suggestion's assignee and nothing else with it (one field, one update).
- An open song editor stamps a **presence dot** of its own (`songs/{id}/presence/{uid}`): only the
  editor who owns that dot may write it (never a guest), the whole band may read it, and it is a
  soft "somebody is editing" hint that goes dark by itself — never a lock.
- Membership is granted only through an **email-keyed invitation** that the matching authenticated
  account accepts in the same batch that creates the membership — nobody can add another person's
  account for them. A **join request** can only ever mint that invitation: approving never grants
  membership directly, and the requester can never approve themselves.
- A band can opt into a **discoverable directory**: the top-level `discoverable/{orgId}` entry
  carries the band's **name only** (never emails, uids or rosters), may exist only while the band's
  own flag says so — both move in one batch or the write is denied — and reads are exact-name
  searches pinned through `nameKey` and capped at ten, so the list can never be paged.
- **`users/{uid}` is private**: no client can look up another account by email, which is what keeps
  invite-by-email honest.
- **Usernames** are claimed atomically in the public `usernames/{name}` registry (case-insensitive);
  renaming claims the new key and releases the old one, limited to one change every 90 days.
- Nobody can change their own role, admins included. A band's admins may only sync the mirrored
  `role` of a member's private band index (or remove that mirror when removing them), and every user
  keeps their own name/email/photo copy in step with their profile.
- `activity` is append-only; organizations are deletable only by their owner.

---

## App Check

Every Firestore/Storage/callable request can carry an **App Check attestation** token, so a leaked
API key cannot burn the project's bill. `services/appCheck.ts` — initialized once from
`app/_layout.tsx` before the data providers mount; `services/appCheck.web.ts` no-ops — picks
**Play Integrity** on Android and **App Attest with DeviceCheck fallback** on Apple in release
builds, and the **debug** provider in development. Attestation is anti-abuse protection, not
telemetry: it is deliberately *not* gated on the analytics consent, because once enforcement is
on, a client that never fetches tokens simply stops working. No security rule changes with it.

### Rollout (console work, in order)

1. Firebase console → Project settings → **App Check**: enroll the Android app (Play Integrity;
   register the package name + SHA-1/SHA-256) and the iOS app (App Attest/DeviceCheck; the bundle
   id).
2. Leave **enforce off** (monitor mode) for Firestore, Storage and callable functions, and watch
   the App Check metrics until the unattested traffic is understood.
3. **Web is not enrolled yet** — the browser provider needs a reCAPTCHA Enterprise site key — so
   enforcement must stay in monitor mode until it is (or until the owner decides web stays
   unattested on purpose).
4. Flip **enforce** per product once the metrics look clean.

### Debug flow (development builds)

Dev builds attest through the **debug** provider, whose token must be allow-listed once in the
console (Project settings → App Check → *Manage debug tokens*):

- **Ad-hoc**: run the dev build and read the temporary secret from the device logs —
  `adb logcat | grep DebugAppCheckProvider` on Android, the Xcode console on iOS — then paste it
  into *Manage debug tokens*.
- **Pinned** (CI/EAS): generate a token in that same dialog and bake it into the development
  profile's `env` as `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN` in `eas.json`, then rebuild the dev
  client. Never add it to a release profile.

A device that already passed App Check keeps passing whether the token is rebuilt in or not —
uninstall the app to reset it. Until the console enrolls anything, `initializeAppCheck` failing is
harmless by design: the band keeps playing, because monitor mode tolerates unattested traffic.

---

## Email link sign-in

Setuno can sign a member in **without a password**: the app asks Firebase for a one-time link, the
member opens it, and the code is redeemed on the spot. The flow is one route — `app/email-link.tsx`
— serving both the request form and the completion.

How the link travels:

- **On a phone** (Android): the mail points at Firebase's own Hosting handler
  (`<project>.firebaseapp.com/__/auth/links?…`). The app claims that URL as an **Android App Link**
  (`app.config.js` → `android.intentFilters`, with `autoVerify` and the project's two hosts), and
  `app/+native-intent.tsx` rewrites it onto the completion route. iOS gets the same declaration
  through `ios.associatedDomains` (Universal Links) and ships with it.
- **Everywhere else** (a desktop browser, a phone without the app): the same URL is an ordinary
  page that hands the one-time code to the **continue URL**, which is the app's own `/email-link`
  route. The web build finishes the sign-in there.

The continue URL is the live browser origin on web, `EXPO_PUBLIC_WEB_BASE_URL` on a phone build,
and the project's `authDomain` as a last resort — always an authorized domain, so a build with no
web address configured can still *send* the link. Set `EXPO_PUBLIC_WEB_BASE_URL` to the deployed
address anyway: it is also what the share links use.

### Owner step: register the SHA-256

Android only opens a link straight into the app (no chooser) once Firebase can verify the app owns
the host, and that needs the build's **SHA-256** fingerprint:

1. Firebase Console → **Project settings** → *Your apps* → the Android app → *App integrity*.
2. Add the SHA-256 of the signing key the build uses (the EAS keystore's, for a release build).
3. Firebase serves `assetlinks.json` on `<project>.firebaseapp.com` from then on.

Until that is done the link still works — Android shows the link chooser, which still lists the app
— but it no longer opens silently. Verifying the hand-off on a device needs a **development build**
(Expo Go cannot open an App Link) and a physical phone.

**No rules, no functions, no deploy.** The feature is entirely client-side.

---

## Deep links

A link to the app's own web address opens **Setuno itself** when the app is installed, and the web
app when it is not. Three public shapes answer:

| Link | What it opens |
| --- | --- |
| `/song/<id>` | that song in the band |
| `/setlist/<id>` | that setlist in the band |
| `/share/<token>` | the public snapshot (read-only, no account needed) |

The first two are the app's own screens under **stable, public names** — they never move with the
app's internal routing — and they only ever point at something inside your band. The third is the
public share link, which anybody can open.

Inside the app, the reader's footer and the setlist's overflow menu have a **Copy link** action
that puts the band's own link on the clipboard; that is the link to send to a bandmate. The public
snapshot is a different thing and is minted by the **Share** action.

### How it is wired

- `app-links.json` (repo root) is the **single source of truth**: the app's identity, the hosts it
  claims and the paths it answers on. `app.config.js` reads it for the Android intent filter (and
  the iOS `associatedDomains` twin) and `scripts/generate-app-links.mjs` reads it to write the
  verification files — so a host the app claims can never stop being a host the deploy serves.
- The verification files are written at **build time** (`pnpm export:web` ends with the generator):
  - `dist/.well-known/assetlinks.json` — Android. The local **debug** keystore's SHA-256 is picked
    up automatically, so a development build verifies without any setup; the **release** (EAS)
    fingerprint goes in `app-links.json` (see below).
  - `dist/.well-known/apple-app-site-association` — iOS, written **only** when `APPLE_TEAM_ID` is
    set. The app does not build for iOS yet, and a placeholder would be worse than none: iOS
    rejects the file and says nothing about why.
- The web deploy serves them from its own origin; `vercel.json` pins the content type and the SPA
  rewrite never touches them (Vercel serves real files before it rewrites).

### Owner step: add the release fingerprint

The shipped build is signed with the **EAS keystore**, whose SHA-256 nobody has written down yet:

1. Get the fingerprint of the keystore EAS uses (EAS → *Credentials* → Android keystore, or
   `keytool -list -v -keystore <keystore>`).
2. Put it in `app-links.json` → `sha256Fingerprints`.
3. Rebuild the web deploy — the file is generated, not committed.

Until then a release build opens the link in the browser (or in the chooser); the *development*
build on this machine already verifies.

---

## Installable web app

The web build is a **PWA**: browsers offer it in the install prompt and it opens in its own window,
like a native app.

- `public/manifest.json` describes it (name, colours, standalone display, icons).
- `public/icons/` holds the three icons it names — 192, 512 and a maskable one — generated by
  `pnpm assets:generate` from the same brand sources as the Android launcher.
- `public/index.html` is the export's **template** (Expo picks a `public/index.html` up as one), so
  it carries the manifest link, the apple touch icon and the service-worker registration.

### The offline shell, and what it must not touch

`public/sw.js` caches the app's **own** files: the HTML shell and the hashed assets. Navigations are
**network first** (a fresh shell whenever the network answers, the cached one only when it does
not), and the hashed assets are cached first — their file name carries a content hash, so a cached
asset can never be stale.

The worker **never touches the API**. The app's offline writes live in Firestore's own IndexedDB
cache, and a worker that cached or replayed API responses would corrupt that queue. Everything on
another origin — Firestore, Auth, Functions — is handed straight back to the browser.

That is the evaluation the roadmap asks for: the single-page export is one HTML shell plus one
hashed bundle, so a worker can hold the shell and the assets and nothing else. The *data* was
already offline-first, and the worker's job is to keep its hands off it.

The rules are **run**, not read, in `tests/unit/pwa.test.ts`: the worker is executed against
stubbed `caches`/`fetch`, and the suite proves that a navigation is answered while the API and
every write are not.

---

## Android home-screen widget

Android users can put the band's **next gig** on their home screen: when it is, where, and which
setlist they will play. Tapping it opens Setuno on that gig.

The widget is a **local Expo module** (`modules/setuno-widget`) — the `modules/` directory the
roadmap pointed at. It is autolinked through `package.json`:

```json
"expo": { "autolinking": { "nativeModulesDir": "./modules" } }
```

How the content gets there:

- The widget cannot read the band's data, and it should not: the **app pushes** what it already
  knows (`hooks/useHomeWidget.ts` → the module → the shared preferences → the launcher draws it).
- The payload is **already localized** by the app, so the launcher never needs the app's
  translations. The widget's own name and description are Android resources, translated per
  language.
- The content is as fresh as the last time the app was open — a widget that woke the app on every
  draw would cost more than it is worth.

`libs/homeWidget.ts` holds the pure part (which gig the widget shows, and what it says about it);
`tests/unit/homeWidget.test.ts` checks it.

Building it locally needs the native project (`npx expo prebuild --platform android`) and a JDK
(17 or 21). The iOS half of the roadmap's item — WidgetKit and the Live Activity — is a separate
piece of work: it needs an EAS build and a config plugin, and iOS does not ship yet.

---

## The Pro plan

Setuno has a **free plan** and a **Pro plan**. Pro removes the ads, opens the band's statistics
and lifts the free limits (one band and a base songbook). **Reading and playing are never gated.**

The plan is decided **on the server**. The phone tells the callable which token the store gave it,
the callable asks Google whether that token is a real paid purchase, and only then is the
entitlement written. The client has no way to write it — the security rules allow the owner to
*read* their entitlement and nothing else — so a phone can never grant itself the plan.

| Piece | Where |
| --- | --- |
| The shapes, the free limits and the product ids | `functions/src/entitlements.ts` (pure — the app reads it through the `@/functions` alias) |
| The store check | `functions/src/playBilling.ts` (the Google Play Developer API) |
| The callables | `getMyEntitlement` and `syncProPurchase` in `functions/src/index.ts` |
| The document | `users/{uid}/entitlements/pro`, server-written only |
| The app | `hooks/useEntitlement.ts`, `hooks/usePlanPurchase.ts` (+ its `.web.ts` twin) and the plan screen in Settings |

### The web buys the plan from Stripe

The mobile build buys the plan from **Google Play**; the web build buys the same plan from **Stripe
Checkout**, because Play Billing has no web implementation. Both paths write the **same** entitlement
document, so the plan belongs to the account and not to the device: buy it on Android and the web is
Pro too.

How it works:

- `hooks/usePlanPurchase.ts` (native) talks to `expo-iap`; `hooks/usePlanPurchase.web.ts` (web) talks
  to the same callables the webhook settles the entitlement with. The seam keeps `expo-iap` — a
  native-only module — out of the web bundle.
- The server's half is `functions/src/stripe.ts`: Stripe's REST API is called with a plain `fetch` (no
  SDK), the **webhook signature is verified against the raw body** (with a replay guard), and the
  member's uid comes from the **metadata Stripe stored with the subscription**, never from the
  browser.
- The configuration — the API key, the webhook signing secret, the two price ids and the web origin
  — is one JSON blob in **Secret Manager** (`STRIPE_CONFIG`).

**Owner steps** (in the Stripe dashboard):

1. **The prices** — two recurring prices with the same amounts as the Play plans, and note their
   price ids (`price_…`).
2. **The API key** — a secret key (`sk_test_…` for the test mode, `sk_live_…` for the real one).
3. **The webhook endpoint** — point it at
   `https://us-central1-setuno-be01d.cloudfunctions.net/stripeWebhook` and subscribe it to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated` and `customer.subscription.deleted`; the endpoint's **signing
   secret** (`whsec_…`) is the fourth value.
4. **The billing portal** — enable it in Stripe's *Settings → Billing → Portal* (a member cancels
   and changes their card there).

All four values go into the secret, and the agent publishes it:
`firebase functions:secrets:set STRIPE_CONFIG` (one JSON blob) and `pnpm deploy:functions`.

**The state right now**: the two Stripe prices exist and are active — **$3.99/monthly and
$34.99/yearly** ✓ — the key, the webhook secret and the price ids are in **Secret Manager**
(`STRIPE_CONFIG`) ✓, the four endpoints are deployed and `ACTIVE` ✓, and a Checkout session was
opened against the real API to prove the whole path ✓ (it returns `checkout.stripe.com` with the
right amount ✓). The Play prices, meanwhile, still read **$30.99/$340.99** through the Play
Developer API even though the console shows $3.99 — a pending price change on Play's side, most
likely. A purchase with a **license tester** account settles which number Play really charges ✓.

**The web cannot take the payment yet** (the store's company details are still being set up), so
the plan screen there **disables the buy buttons** and points at the Android app instead — the plan
follows the **account**, so buying it on Android turns the web into Pro too ✓.

### The tip

**Settings → Support Setuno** offers a small tip for the person who made the app. It is a
**consumable** and it **grants nothing** — no feature, no limit, no badge — and the screen says so
in as many words. There is no external payment link anywhere: the tip goes through the store the
app already uses, and the server confirms it, consumes it (so it can be tipped again) and records
that it happened. A tip never touches the plan, so a member who already has Pro keeps it.

**Owner step**: create the one-time product `setuno_tip` in the Play Console with a fixed price (a
store never takes a custom amount) and pick the amount.

Without the service account the callable refuses every purchase: a missing credential must never
fall back to "probably fine". Until the products exist, the plan screen says the plan is not
offered in this build yet rather than offering a button that cannot work.

---

## Backups

The band's data lives in one Firestore database, so it gets **managed backups**: a daily
scheduled backup of the whole `(default)` database into Google's backup storage in the database's
own region, kept for 30 days. Backups are immutable — a retention policy locks them, so not even
an owner can delete one before its window expires, which is what makes them the trustworthy last
line of defense (schedule created 2026-10-18; at this data size it costs cents per month).

Managed backups are **schedule-driven**: the v1 API exposes no "create a backup now" call, so the
first backup lands within ~24 h of enabling a schedule and every later one at the daily window
Google picks.

### Driving them

`scripts/firestoreBackup.mjs` drives everything through the owner's own `firebase-tools` login —
no credentials live in the repo, and `npx firebase-tools login` is the only prerequisite:

| Command | What it does |
| --- | --- |
| `pnpm backup:status` | List the schedule(s) and the backups that exist |
| `pnpm backup:wait` | Poll until the first READY backup shows up (after enabling a schedule) |
| `pnpm backup:drill` | Restore the newest backup into a scratch database, watch its restore operation to completion, verify no rules are bound to the copy, delete it again |
| `pnpm backup:drill -- --keep` | Same, but leaves the restored database around for inspection |

### Restore runbook

A restore never overwrites `(default)` — it materializes the backup as a **new** database, and
then the data gets home deliberately:

1. **Pick a restore point**: `pnpm backup:status` — backups are immutable; choose the newest one
   from before the incident.
2. **Restore into a fresh database** (this is what the drill automates):
   `npx firebase-tools firestore:databases:restore -d setuno-restore-20261018 -b <backup-name> --project setuno-be01d`,
   then wait for the operation to finish — `firestore:databases:get -d setuno-restore-20261018`
   carries a `sourceInfo.operation` while it runs and an `earliestVersionTime` once it settles
   (the database resource exposes no `state` field; the drill does this wait itself).
3. **Post-restore checklist** (the copy starts deliberately bare):
   - **Rules**: a fresh database id has no rules of its own, so every web/mobile client read and
     write is denied — deploy the current `firestore.rules`
     before any client touches the copy.
   - **IAM**: a restore copies data, not memberships — re-add whoever needs the restored
     database.
   - **TTL policies**: re-create any field configurations the console had.
4. **Get the data home**, shaped by the incident:
   - *Some documents lost* — re-import just those collections from the restored copy into
     `(default)` (`exportDocuments`/`importDocuments` or the console).
   - *Whole database gone* — re-import everything into a fresh `(default)`, or point the app's
     config at the restored database. Google also offers an
     [in-place restore](https://firebase.google.com/docs/firestore/restore-in-place) that
     rewrites a database from a backup directly; read its caveats before touching production.
5. **Delete the scratch database** when done (`pnpm backup:cleanup` if it was left with
   `--keep`) — it bills for storage while it exists.

### Restore drill

A backup nobody has restored is a hope, not a plan. `pnpm backup:drill` proves the whole path —
backup readable, restore accepted, the restore operation running to completion, and **no
security rules bound to the copy's database id** — **without touching production**: the
restored copy is a separate scratch database (`setuno-restore-drill`), deleted again at the
end. That rules check deliberately goes through the **Rules API** and not the data plane: the
CLI's Google OAuth token is not a Firebase client, and `listCollectionIds` only reports which
root collections *exist* (a control against live production caught both traps — the drill's
first probes were vacuous or misread). Backups carry no rules (Google's docs), a database id
that never had a release denies all web/mobile client reads by default, and the drill fails if
one ever appears bound to the scratch id. Re-run it after major data-shape changes and before
any release that migrates data; once the staging project exists, run it there instead (it
does — see [Staging](#staging)). Measured on the first full drill (2026-10-18): the restore
took **~11 minutes**, the scratch id stays tombstoned **~2 minutes** after deletion, and a
database still settling a restore refuses deletion — the script already waits out all three.

### What backups do not cover

- **Firebase Auth users** — export them from the console (Authentication → Users → *Export
  users*) or through the Identity Toolkit API.
- **Storage files** (avatars, band logos) — small and re-uploadable; a lifecycle or transfer job
  is possible future work.
- **Config and secrets** — they all live in the repo (`app.config.js`, `eas.json`, `firebase.json`,
  `firestore.rules`).

---

## Staging

Roadmap #80. A second Firebase project — **`setuno-be01d-staging`** ("Setuno Staging") — so every
Phase 0+ feature lands on staging before production. Same app, same code; only the Firebase
project behind it changes.

### What is provisioned (all agent-run, 2026-10-18)

- Firestore `(default)` in **nam5**, the same multi-region as production.
- `firestore.rules` + `firestore.indexes.json` deployed — rules and indexes are per project:
  `npx firebase-tools deploy --only firestore --project setuno-be01d-staging`.
- Apps registered in the project (web, Android + iOS, both `com.rixeldev.setuno`) and their
  config pulled as `google-services-staging.json` / `GoogleService-Info-staging.plist`
  (gitignored like the production files).
- Cloud Functions: **not deployed** — staging is on the Spark plan (see the owner steps below).

### How the app selects an environment

`APP_ENV=staging` is the single switch, honored in the two places that must move together:

- **JS config** — `scripts/ensure-firebase-config.mjs` reads the `FIREBASE_STAGING_*` variables
  (the same six required names) instead of `FIREBASE_*` and stamps the generated
  `db/firebaseConfig.ts` with `firebaseEnvironment`. A config generated for one environment is
  never reused for the other: flipping validates the new variables **first**, backs the old file
  up to `db/firebaseConfig.ts.bak` and only then overwrites, so a half-set flip can never
  destroy the working config. Staging leaves `APP_VERSION_ID` and the `ADMOB_*` units empty on
  purpose — no update gate, no ads.
- **Native config** — `app.config.js` points `googleServicesFile` at
  `google-services-staging.json` / `GoogleService-Info-staging.plist`, or at the
  `GOOGLE_SERVICES_JSON_STAGING` / `GOOGLE_SERVICES_PLIST_STAGING` file-type EAS variables on
  cloud builds.

### Running against staging

Local (web, dev server or a native run): the gitignored `.env.staging` beside the repo root
carries the staging values (regenerate them any time with
`npx firebase-tools apps:sdkconfig web --project setuno-be01d-staging`), then run with the
variable set:

```powershell
$env:APP_ENV = "staging"; pnpm export:web   # or: pnpm web / pnpm android
```

EAS builds: the `development-staging` and `preview-staging` profiles set `APP_ENV=staging`
themselves and read the `FIREBASE_STAGING_*` values from the EAS **preview** environment
(`npx eas-cli env:set --name FIREBASE_STAGING_PROJECT_ID --value … --environment preview` — six
names, listed in `.env.example`), plus the two google-services files as file-type variables
(`GOOGLE_SERVICES_JSON_STAGING`, `GOOGLE_SERVICES_PLIST_STAGING`). The `eas-build-pre-install`
script runs the config generator on the build machine, so the JS half needs no checked-in file.
Plain `development` / `preview` / `production` profiles keep pointing at production; their
values belong in the matching EAS environment (`development` / `preview` / `production`).

### Owner steps (console, in order)

1. **Authentication → Sign-in method** on the staging project: enable *Email/Password* and
   *Google* (new projects ship with providers off). The Google flow also needs the staging web
   client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for staging runs.
2. **Storage → Get Started**: staging has no billing account, so the default bucket cannot be
   provisioned through the API (403 `accountDisabled`); the console flow creates it under the
   Spark free tier.
3. **Blaze plan**, only when staging needs Cloud Functions (share/export callables, push):
   console → Upgrade. Everything else — Auth, Firestore, rules, web builds — runs on Spark.

### Policy

Every Phase 0+ feature deploys to staging first — rules and functions included (pass
`--project setuno-be01d-staging`). Staging data is disposable; production keeps its backups
(§Backups), and restore drills and migration rehearsals run against staging instead of
production's scratch database from now on.

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

The app starts in the **device language**. The Settings → Language sheet offers
**English / Español / Português (Brasil) / Français**; choosing one stores it on the device
(`services/i18next.ts`) and it is restored before the first frame.

**Keep every locale file in sync** — every new user-facing string needs a key in `en.json` *and*
in each of `es.json`, `pt-BR.json` and `fr.json`. Interpolation uses `{{variable}}`; plurals use
`_one` / `_other` suffixes. `tests/unit/i18n.test.ts` enforces the parity **for every shipped
language** and that every statically referenced key exists — including the `{{placeholders}}` of
each value, so a translation can never silently drop one.

Two things a translation must not touch: the **CSV column names** in `backup.csvHint` (they are
the literal headers `libs/bandBackup.ts#parseSongsCsv` matches) and anything inside `{{ }}`.

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

## E2E

The Maestro journey (`e2e/journey.yaml`) walks the core against **staging**: sign-in → create song
→ create setlist → create event → open reader. Every run clears app state, signs in with a
dedicated runner account and creates its own `E2E … ${RUN_ID}` data, so runs never collide and the
duplicate-song warning (#39) never trips.

**One-time setup**

1. **Provision Authentication on staging** (console, once): staging Firebase console →
   Authentication → *Get started* → Sign-in method → **Email/Password**. An API-created project
   has no auth configuration at all — `accounts:signUp` answers `CONFIGURATION_NOT_FOUND` and
   there is no REST path around it, which is why this is the only console step.
2. Put the runner credentials in the gitignored `.env.e2e` (`E2E_EMAIL=`, `E2E_PASSWORD=` —
   `.env.example` has the block) or export them.
3. `pnpm e2e:setup` — creates the account **through the public client APIs under the same rules a
   signed-in user gets** (username claim + profile with `onboarded: true` + the `E2E Band`
   organization + membership + profile mirror, one `batchWrite` because the rules evaluate them
   with `getAfter()`). Idempotent: re-running signs in and fills in what is missing. It refuses to
   run against anything that is not a `*-staging` project — never point it at production.

**Running locally**: install the app on a device/emulator (development build, `pnpm android` with
Metro, or the same release APK CI builds), then `pnpm e2e` (= `maestro test e2e/journey.yaml --env
E2E_EMAIL=… --env E2E_PASSWORD=… --env RUN_ID=local-$(date +%s)`). Selectors: on Android Maestro's
`id` matches resource-id, content-desc or text — the tab bar is tapped through its `tab-*`
testIDs (never by label: the dashboard prints "Songs" too), forms through the `Input` accessibility
labels and buttons through their labels; the emulator must run **English**.

**CI** (`.github/workflows/e2e.yml`): nightly 03:17 UTC plus `workflow_dispatch` (Actions → Run
workflow — the quickest first validation). Enables KVM, writes the staging config from secrets
(`FIREBASE_STAGING_*` ×6, `GOOGLE_SERVICES_JSON_STAGING`, `E2E_EMAIL`, `E2E_PASSWORD` — all in the
Actions environment), seeds the account, builds a standalone **release** APK with a throwaway CI
keystore (`expo prebuild` + injected signing, no Metro), installs it on an API 34 emulator and
runs the journey; failure uploads `~/.maestro/tests` (flow output + screenshots) as an artifact.

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
