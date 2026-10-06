This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

The app ships on **Android, iOS and Web** from one codebase. Anything you write must work on all three unless you are explicitly handling a platform difference.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Project facts (this repo)

- Package manager is **pnpm** (`pnpm-lock.yaml` present). Use `pnpm <script>` / `pnpm exec <tool>`.
- Expo SDK 57, React Native 0.86, React 19, TypeScript ~6 in **strict** mode.
- Lint is **ESLint 9 flat config** (`eslint.config.js`) — do not upgrade to ESLint 10, `eslint-config-expo` is not compatible with it.
- Routes live in **`app/`** (not `src/app/`). There is no `src/` directory.
- Native `ios/` and `android/` directories do not exist (Continuous Native Generation) — see *Building with EAS*.

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
- **Editing flows take over the app**: `isFocusRoute()` in `libs/navigation.ts` lists the create/edit/suggest routes and `AppShell` hides the bottom bar/sidebar there, so no stray tap can abandon the work. Every form with unsaved state must additionally call `useUnsavedChanges()` and render `components/app/DiscardChangesDialog.tsx`, so back, Android back, tab presses and browser close ask for confirmation instead of silently losing the draft.
- **Never import `@react-navigation/*`** in app code (SDK 56+): Expo Router ships its own copy, so the app packages were removed from `package.json` on purpose and the bundler errors out if they come back. Import from `expo-router` or, for React Navigation APIs such as `usePreventRemove`, from `expo-router/react-navigation`.
- Docs: https://docs.expo.dev/router/introduction.md

## Firebase

- **Never create a second Firebase config.** `db/firebaseConfig.ts` is the only one. `db/Fire.ts` is the single entry point that re-exports the configured app, auth, storage and path builders.
- **All Firestore access goes through `services/*.ts`**, which use `db/Fire.ts`. Screens never import Firebase directly.
- Batching: use `batch.set(ref, data, { merge: true })`. Rules that must see post-batch state use `getAfter()`, since `get()` sees pre-batch state.
- Web compatibility: `metro.config.js` `resolveRequest` maps `@react-native-firebase/*` and `firebase/auth` to `shims/*.web.ts`. If you add a native-only module, you must add a web shim or guard it with `Platform.OS`.
- Membership is **invitation-only**: `addMemberByEmail` always creates an invitation. Do not reintroduce email→profile lookups — `firestore.rules` deliberately forbids reading other users' profiles.
- **Google sign-in is platform-split**: `services/googleAuth.ts` (native, `@react-native-google-signin/google-signin`) and `services/googleAuth.web.ts` (browser, Firebase popup → redirect fallback). Metro picks `<name>.web.ts` for `platform=web`, so never import a native-only SDK from a shared file — give the platform its own file instead. Android needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Firebase Console → Authentication → Google → Web client ID) and the app's SHA-1 registered in Firebase.
- `firestore.rules` must stay in sync with the write shapes in `services/`. If you change a write, update the rules and re-read `docs/app_implementation.md` §23.
- **Writes are offline-first**: Firestore stores every write in the on-device cache and replays the queue by itself (native persistence is on by default; on web `db/firestoreInstance.web.ts` enables IndexedDB via `persistentLocalCache`). Never bypass `db/Fire.ts`, and never assume a write needs connectivity to succeed.
- Connectivity + queue state live in `services/sync.ts` (`useSyncState()`), rendered only by `components/app/SyncBanner.tsx`. Keep the banner a pure render of that state — do not add connectivity checks (or timers) to screens.

## Ads

- Google Mobile Ads is native-only and platform-split like `googleAuth`: `services/ads.ts` + `components/ads/BannerAdSlot.tsx` for native, with `.web.ts` shims that no-op so web never imports the SDK.
- Banners live in a few strategic spots only: the dashboard (bottom, above the navigation) and the end of the songbook and events lists. The slot collapses to zero height until an ad loads, so it is invisible when there is no fill (offline, blocker, web).
- Dev builds use the SDK's official test unit; release builds use `adBannerId` from `db/firebaseConfig.ts` (override with `EXPO_PUBLIC_ADMOB_BANNER_ID`). Ads require a development build (not Expo Go).

## Firebase rules deploy

- The Firestore project is pinned in `.firebaserc` (`stage-book-477a6`) and `firebase.json` points at `firestore.rules`; publish with `npx firebase-tools login` (once) then `pnpm deploy:rules`. Collection-group queries (invitations) only work with the recursive-wildcard rule in that file, so deploy rules together with app changes that rely on them.

## Internationalization

- i18next is configured in `services/i18next.ts`; locale bundles are `locales/en.json` and `locales/es.json`.
- The app starts in the **device language** (`libs/deviceLanguage.ts` native / `.web.ts` browser) unless the user picked one in the language bottom sheet (`components/settings/LanguageSheet.tsx`, reachable from Settings). The sheet offers only **English / Español**; the choice lives in AsyncStorage and is restored by `hydrateLanguage()` from `app/_layout.tsx` before the first frame.
- Supported languages are declared once in `libs/language.ts` (`SUPPORTED_LANGUAGES`, `LANGUAGE_NAMES`, `resolveLanguage`).
- Every user-facing string comes from `t("namespace.key")` via `useTranslation()` from `react-i18next`.
- **Adding a string means editing both locale files.** Keep `en.json` and `es.json` structurally identical.
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
- Use `Dialog` for confirmations, `BottomSheet` for short option lists, and `ModalScreen` for screens presented as modals. Destructive actions always ask for confirmation.
- **Do not use `@react-native-community/datetimepicker` directly** — use `components/ui/DateField`.
- Clipboard: `import * as Clipboard from "expo-clipboard"`.
- Every list needs loading / empty / error states, and every destructive action needs a confirmation `Dialog`.

## Testing

- `vitest.config.mts` defines two projects: `unit` and `integration`. Put pure-logic tests in `tests/unit/`, Firestore-rules tests in `tests/integration/`.
- Tests that would import React Native must read the source file as text instead (see `tests/unit/routes.test.ts`).
- Integration tests run against the Firebase emulator — see `tests/integration/README.md`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- `ios/` and `android/` do not exist (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` / `app.config.js` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Spec

`docs/app_implementation.md` is the authoritative 52-section product spec. Sections worth checking before you implement anything: §22 data model, §23 security rules, §47 manual test checklist, §52 definition of done.
