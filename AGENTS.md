This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

The app ships on **Android, iOS and Web** from one codebase. Anything you write must work on all three unless you are explicitly handling a platform difference.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Project facts (this repo)

- Package manager is **pnpm** (`pnpm-lock.yaml` present). Use `pnpm <script>` / `pnpm exec <tool>`.
- `pnpm-workspace.yaml` pins `nodeLinker: hoisted` (flat `node_modules`). Keep it: Windows Android builds break on pnpm's nested `.pnpm/<pkg>@<hash>` paths (>250-char CMake object paths). After changing that setting, wipe `node_modules` before reinstalling.
- Expo SDK 57, React Native 0.86, React 19, TypeScript ~6 in **strict** mode.
- Lint is **ESLint 9 flat config** (`eslint.config.js`) — do not upgrade to ESLint 10, `eslint-config-expo` is not compatible with it.
- Routes live in **`app/`** (not `src/app/`). There is no `src/` directory.
- Native `ios/` and `android/` directories do not exist (Continuous Native Generation) — see *Building with EAS*.
- Local Gradle/CMake builds need **JDK 17**: on JDK 24+ Android Gradle Plugin aborts the native tasks with `WARNING: A restricted method in java.lang.System has been called`. In Android Studio set *Settings → Build, Execution and Deployment → Build Tools → Gradle → Gradle JDK* to 17 (its bundled JBR is often newer, e.g. 25); CLI builds pick it up from `JAVA_HOME`. Leave *Gradle user home* **empty** — a JDK path there puts `wrapper/dists` inside `Program Files` and every sync fails. A successful AS sync writes `android/gradle/gradle-daemon-jvm.properties` with the selected JDK version, and that file also forces the JVM of plain `gradlew` runs (`toolchainVersion=25` reintroduces the CMake failure); delete it or re-sync with the IDE's Gradle JDK at 17.

## Commands

```bash
pnpm install            # install deps (never npm/yarn/bun add — pnpm lockfile)
npx expo install <pkg>  # add a dep with an SDK-compatible version
pnpm start              # dev server
pnpm web                # run on web
pnpm android            # run on Android
pnpm ios                # run on iOS simulator (macOS only)
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm lint:fix           # eslint --fix
pnpm test               # vitest unit tests
pnpm test:integration   # vitest against the Firebase emulator
pnpm export:web         # production web export
pnpm deploy:rules       # publish firestore.rules to the pinned project
pnpm deploy:indexes     # publish firestore.indexes.json
pnpm assets:store [es|en] # Play Store graphics from docs/images captures
npx expo-doctor         # diagnose dependency and config issues
```

**Definition of done:** `pnpm typecheck` and `pnpm lint` must both exit 0 before you declare a task finished. For changes touching routes or navigation, also run `pnpm test` — a unit test asserts every href maps to a real route file.

## Code style

- **No semicolons** at end of statements (`semi: never` is enforced by ESLint).
- **No `console.*`** in app code — `no-console` is a warning. Use the error/telemetry paths that already exist.
- **No `any`** — strict TypeScript; define real types in `interfaces/`.
- Keep the `@/` path alias (`@/components`, `@/services`, `@/libs`, …).
- Screens under `app/` export **only** a default component. Any extra component, hook or helper goes in `components/`, `hooks/`, `libs/` or `services/`.
- Prefer plain `useState`/`useMemo` over `useRef(initial).current` when creating non-primitive state (`useState(() => new X())[0]`) — React lint flags the ref form.
- Never mutate a module-level `Animated.Value` across renders; create it once with the lazy `useState` initializer.

## Navigation & routing

- **Expo Router** for all navigation. Routes live in `app/` — every file is a screen, `_layout.tsx` files define navigators.
- Import `Link`, `router`, `useLocalSearchParams` from `expo-router`.
- The authenticated shell is `app/(app)/_layout.tsx` → `components/app/AppShell.tsx` (sidebar on web/desktop, bottom tabs on mobile). Add new screens to the `Stack` registry there.
- **Modal routes** are registered with `options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }}` in that same `Stack` and render inside `components/app/ModalScreen.tsx` — a spring-animated panel floating on a translucent backdrop (bottom sheet on phones, dialog on web) instead of `ScreenContainer`. Current modals: `organizations/index`, `organizations/new`, `settings/profile`, `settings/organization`, `members`, `suggestions/index`, `suggestions/new`, `suggestions/[id]`, `setlists/new`, `setlists/[id]/edit`, `performances/new`, `performances/[id]/edit`. The create/edit forms (`PerformanceForm`, `SetlistForm`) render `ModalScreen` directly; full-screen editors (`songs/*`) keep `ScreenContainer`.
- **Bottom sheets** are for short option pickers: flip `visible` on `components/ui/BottomSheet.tsx` (`BottomSheet` + `SheetOptionRow`). `Dialog`, `BottomSheet` and `ModalScreen` all share `components/ui/SheetSurface.tsx` (translucent backdrop + spring entrance), so never build a new overlay from scratch. The language and theme pickers live in `components/settings/`.
- **Every screen exposes an accessible go-back button** (never rely on the OS gesture alone). `PageHeader` renders it automatically when the router can go back — pass `back` to force it or `back={false}` to hide it — and `ModalScreen` / `AuthLayout` place the same control at the top-left. The label comes from `common.goBack`.
- **Tabs never stack**: the shell is one `Stack`; pressing a tab root runs `goToTab` (`hooks/useTabNavigation.ts`), which collapses the stack to `[Home, currentTab]`, so the native back button from any tab root lands on the dashboard. Tab roots are registered with `animation: "none"` (switching is instant); the anchor is `unstable_settings.anchor = "index"`. `isTabActive` also lights the *More* tab while one of its hosted routes (settings, members, suggestions…) is open.
- **The reader steps through an event's setlist**: opening a song from a setlist screen passes `?setlist=`; only then does the reader show the corner arrows, walking exactly that list (`setlistStep` in `libs/setlistNavigation.ts`). Steps animate by direction through `animationTypeForReplace` (`hooks/useReaderSession.ts`), and stage (fullscreen) mode survives the swap. The general songbook never shows the arrows.
- **Auth gates**: `app/(auth)/_layout.tsx` bounces signed-in users back into the app (heals the sign-in/redirect race), and `app/index.tsx` only waits for auth — never for the band list, which loads behind the dashboard's own states.
- **Editing flows take over the app**: `isFocusRoute()` in `libs/navigation.ts` lists the create/edit/suggest routes and `AppShell` hides the bottom bar/sidebar there, so no stray tap can abandon the work. Every form with unsaved state must additionally call `useUnsavedChanges()` and render `components/app/DiscardChangesDialog.tsx`, so back, Android back, tab presses and browser close ask for confirmation instead of silently losing the draft.
- **Never import `@react-navigation/*`** in app code (SDK 56+): Expo Router ships its own copy, so the app packages were removed from `package.json` on purpose and the bundler errors out if they come back. Import from `expo-router` or, for React Navigation APIs such as `usePreventRemove`, from `expo-router/react-navigation`.
- Docs: https://docs.expo.dev/router/introduction.md

## Firebase

- **Never create a second Firebase config.** `db/firebaseConfig.ts` is the only one. `db/Fire.ts` is the single entry point that re-exports the configured app, auth, storage and path builders.
- **All Firestore access goes through `services/*.ts`**, which use `db/Fire.ts`. Screens never import Firebase directly.
- Batching: use `batch.set(ref, data, { merge: true })`. Rules that must see post-batch state use `getAfter()`, since `get()` sees pre-batch state.
- Web compatibility: `metro.config.js` `resolveRequest` maps `@react-native-firebase/*` and `firebase/auth` to `shims/*.web.ts`. If you add a native-only module, you must add a web shim or guard it with `Platform.OS`.
- Membership is **invitation-only**: `addMemberByEmail` always creates an invitation. Do not reintroduce email→profile lookups — `firestore.rules` deliberately forbids reading other users' profiles.
- **Google sign-in is platform-split**: `services/googleAuth.ts` (native, `@react-native-google-signin/google-signin`) and `services/googleAuth.web.ts` (browser, Firebase popup → redirect fallback). Metro picks `<name>.web.ts` for `platform=web`, so never import a native-only SDK from a shared file — give the platform its own file instead. Android needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Firebase Console → Authentication → Google → Web client ID) and the app's SHA-1 registered in Firebase. The native flow tries the ID token from the sign-in response and always falls back to the classic `getTokens()` exchange, so it also works with the access token alone; native Google status codes are decoded in `services/errors.ts` (`GOOGLE_MESSAGES`).
- **Unique usernames live in a public registry**: claiming `usernames/{lowercased name}` is an atomic create (`services/usernames.ts`, `libs/username.ts`), with a `Name-1234` suffix on collision (Google sign-up). Renames are one batch that claims the new key and releases the old one, and the rules enforce one change every 90 days through `usernameChangedAt` + `getAfter`. The profile's `displayName` mirrors the claimed username and is never overwritten from the auth account.
- **Band membership mirrors**: `users/{uid}/organizations/{org}` is each user's private band index. The user writes it when accepting an invitation; admins of that band may only sync the mirrored `role` (or delete the mirror when removing someone) — `services/organizations.ts#syncMemberProfile`/`updateMemberRole`/`removeMember` and `firestore.rules` must stay in step. `hooks/useOrganization.tsx` self-heals the caller's copy (name, email, photo) against their profile, so the members list never shows stale rows.
- **The band list is cache-aware**: `subscribeMyOrganizations` subscribes with `includeMetadataChanges` and a cache-only empty snapshot must never be treated as “no bands”. `hooks/useOrganization.tsx` retries dropped listeners with backoff, shows a retry after a deadline and recovers with a one-shot `getDocsFromServer`.
- **Cold start never blocks on Firestore**: `useAuth` subscribes the profile (cache-first) and backfills `ensureUserProfile` in the background; the splash waits for auth + the first band slice only.
- `firestore.rules` must stay in sync with the write shapes in `services/`. If you change a write, update the rules and re-read `docs/app_implementation.md` §23.
- **Writes are offline-first**: Firestore stores every write in the on-device cache and replays the queue by itself (native persistence is on by default; on web `db/firestoreInstance.web.ts` enables IndexedDB via `persistentLocalCache`). Never bypass `db/Fire.ts`, and never assume a write needs connectivity to succeed.
- Connectivity + queue state live in `services/sync.ts` (`useSyncState()`), rendered only by `components/app/SyncBanner.tsx`. Keep the banner a pure render of that state — do not add connectivity checks (or timers) to screens.

## Ads

- Google Mobile Ads is native-only and platform-split like `googleAuth`: `services/ads.ts` + `components/ads/BannerAdSlot.tsx` for native, with `.web.ts` shims that no-op so web never imports the SDK.
- The mobile banner is **one persistent slot under the navigation** (`AppShell` renders it below `BottomBar`), full width via the anchored-adaptive unit; the old end-of-list banners are gone. It collapses to zero height until an ad loads, so it is invisible when there is no fill (offline, blocker, web), and it hides with the navigation on focus routes. `hooks/useBottomChrome.ts` reports the measured bar + banner height so the toast anchors above it.
- Dev builds use the SDK's official test unit; release builds use `adBannerId` from `db/firebaseConfig.ts` (override with `EXPO_PUBLIC_ADMOB_BANNER_ID`). Ads require a development build (not Expo Go).

## Firebase rules deploy

- The Firestore project is pinned in `.firebaserc` (`stage-book-477a6`); `firebase.json` maps `firestore.rules` and `firestore.indexes.json`. Publish with `npx firebase-tools login` (once) then `pnpm deploy:rules` and/or `pnpm deploy:indexes`.
- Collection-group queries (invitations) need BOTH the recursive-wildcard rule in `firestore.rules` and the collection-group index in `firestore.indexes.json`; deploy both together with app changes that rely on them.
- `firebase deploy --only firestore:indexes` replaces the remote index set with the file, so keep `firestore.indexes.json` up to date before deploying (otherwise unlisted composite indexes are removed).

## Internationalization

- i18next is configured in `services/i18next.ts`; locale bundles are `locales/en.json` and `locales/es.json`.
- The app starts in the **device language** (`libs/deviceLanguage.ts` native / `.web.ts` browser) unless the user picked one in the language bottom sheet (`components/settings/LanguageSheet.tsx`, reachable from Settings). The sheet offers only **English / Español**; the choice lives in AsyncStorage and is restored by `hydrateLanguage()` from `app/_layout.tsx` before the first frame.
- Supported languages are declared once in `libs/language.ts` (`SUPPORTED_LANGUAGES`, `LANGUAGE_NAMES`, `resolveLanguage`).
- Every user-facing string comes from `t("namespace.key")` via `useTranslation()` from `react-i18next`.
- **Adding a string means editing both locale files.** Keep `en.json` and `es.json` structurally identical — `tests/unit/i18n.test.ts` fails otherwise, and it also asserts that every statically referenced `t("…")` key exists in English (plural `_one`/`_other` forms included).
- Interpolation: `{{variable}}`. Plurals: `key_one` / `key_other`.
- Domain error messages are mapped centrally in `services/errors.ts` (`toFriendlyError`) — extend that instead of hardcoding user-facing error text.
- **Section labels are derived, not stored**: a song persists `section.type` + its ordinal position, and the UI renders the label with `sectionLabelFor(sections, index, t)` (`libs/songUtils.ts`), so every member reads “Verse 1” / “Estrofa 1” regardless of who created the song. Only `custom` sections use their stored text.

## Preferences & storage

- Anything the user configures must survive a restart: theme/accent (`services/themeManager.ts`), language (`services/i18next.ts`) and reader settings — font size, chords visible, motion (`services/prefs.ts`).
- The reader also stores `chordNotation` (`"letters" | "solfege"`): chords and keys are always **stored** in american letters, and the reader spells them through `displayChord` / `displayKey` (`libs/chords.ts`). The editor and the chord pad always stay in letters (that is what gets saved).
- The theme mode is `"dark" | "light" | "system"` (`interfaces/user.ts`, `libs/appearance.ts`). `"system"` is collapsed by `resolveAppearanceMode()` and `hydrateAppearance()` subscribes to OS colour-scheme changes, so the palette follows the device without rewriting the stored preference.
- All three are hydrated together in `app/_layout.tsx` before the first frame, so nothing flashes with default values.
- `services/users.ts` mirrors the profile's `preferences` into the local cache (and back), so settings are available offline and before the profile loads. Writes are local first, then Firestore.

## Design system & UI

- `constants/Theme.ts` is the token source (colors, spacing `xxs, xs, s, m, l, xl, xxl, xxxl, huge`, radii `xs, s, m, lg, xl, xxl, pill`, typography). Note the keys are `s`/`m`/`l` — **not** `sm`/`md`/`lg`.
- The palette is derived, never hand-written per screen: `services/themeManager.ts` tints the dark surfaces towards the active accent, and in light mode it darkens the accent (flipping `onPrimary` to white) so text/icons keep AA contrast. Resolve colours **inside** components/factories (`Theme.colors[...]` at render or in `createStyles`) — never capture them in module-level constants, or the value goes stale on theme switch.
- Build styles with `useThemedStyles<T>(factory)`; the factory receives the palette version so style memoization invalidates correctly.
- Reuse `components/ui/` primitives before writing new ones: `AppText`, `Button`, `Input`, `Card`, `Dialog`, `BottomSheet`, `Toast`, `States`, `PageHeader`, `Avatar`, `Icons`, `DateField`.
- Use `Dialog` for confirmations, `BottomSheet` for short option lists, and `ModalScreen` for screens presented as modals. Destructive actions always ask for confirmation. A dialog whose body brings its own scrolling list must pass `bodyScroll={false}` (nesting a virtualized list inside the body ScrollView warns and stacks two scrollers).
- **The toast anchors above the real bottom chrome**: `hooks/useBottomChrome.ts` measures the bar + banner and `components/ui/Toast.tsx` sits 12 points above it (or near the bottom edge when there is no chrome). `pointerEvents` is only ever declared in `style` (a unit test bans the prop, react-native-web deprecation), and the overlay is `box-none` so its controls stay tappable.
- **The chord/lyric grids are monospaced and bundled**: `Theme.fonts.mono` points at JetBrains Mono, registered with per-weight deep imports in `app/_layout.tsx` (importing from the package root bundles all 27 weights). Never set `fontWeight` on a mono grid row — Android can fall back to a proportional face and every padded column drifts. `buildChordSegments` keeps the exact grid while making each chord tappable; `buildChordRow` is its joined text.
- On Android, an element whose rounded background appears only in a different state can paint square: keep a background defined from the start (`BottomBar`'s `tabIcon` is transparent until active) and remount the view when the state flips.
- **Do not use `@react-native-community/datetimepicker` directly** — use `components/ui/DateField`.
- Clipboard: `import * as Clipboard from "expo-clipboard"`.
- Every list needs loading / empty / error states, and every destructive action needs a confirmation `Dialog`.

## Reader & chord shapes

- The reader (`app/(app)/songs/[id]/index.tsx`) keeps its display state in preferences: font size, chords visible, notation and the preferred **instrument** (`chordInstrument: "guitar" | "piano"`). Transposition (`semitones`), capo and stage mode are per session.
- **Tapping a chord opens the “how to play” sheet** (`components/songs/ChordShapeSheet.tsx`), only in the reader (`SongContent` receives `onChordPress`). Guitar voicings come from the bundled MIT `chords-db` dataset (`libs/chordShapes.ts`, several positions paged with arrows); piano notes are derived from the chord spelling. With a capo set, the guitar side shows the shape to finger (displayed chord minus the capo) and labels it; piano shows the written chord.
- The arrow/page controls, the sheet's instrument tabs and the diagrams (`FretboardDiagram`, `PianoChord`) are plain views — no native modules — and every diagram exposes an accessible label.

## Testing

- `vitest.config.mts` defines two projects: `unit` and `integration`. Put pure-logic tests in `tests/unit/`, Firestore-rules tests in `tests/integration/`.
- Tests that would import React Native must read the source file as text instead. The existing guards: `routes.test.ts` (every nav href maps to a route module with a default export), `i18n.test.ts` (locale parity + static keys exist) and `rnwDeprecations.test.ts` (no `pointerEvents` props).
- Integration tests run against the Firebase emulator — see `tests/integration/README.md`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Deploying the web (Vercel)

`vercel.json` at the repo root is ready for the static export: it runs
`pnpm export:web`, serves `dist`, adds the SPA rewrite Expo Router needs for
deep links and caches the hashed assets immutably. Deploy with `npx vercel`
(preview) or `npx vercel --prod` (production), or import the repository in the
Vercel dashboard (framework: Other; the file already defines the build command
and output directory).

After the first deploy, add the production domain in the Firebase Console
(Authentication > Settings > Authorized domains) or the browser Google popup
sign-in fails with `auth/unauthorized-domain`. The Firebase config itself is
not in git (`db/firebaseConfig.ts`): `pnpm export:web` first runs
`scripts/ensure-firebase-config.mjs`, which generates it from the
`FIREBASE_*`/`ADMOB_*`/`APP_VERSION_ID` environment variables when the file is
absent — set those in the Vercel project (Production and Preview). Locally the
script is a no-op because the real file exists. No other environment variables
are required for the web build.

## Rules

- `ios/` and `android/` do not exist (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` / `app.config.js` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Spec

`docs/app_implementation.md` is the authoritative 52-section product spec. Sections worth checking before you implement anything: §22 data model, §23 security rules, §47 manual test checklist, §52 definition of done.
