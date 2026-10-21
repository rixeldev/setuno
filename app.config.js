// Staging builds (roadmap #80 / P0.7) select the staging Firebase project:
// APP_ENV=staging swaps the native config files (the JS half comes from
// db/firebaseConfig.ts, generated from the FIREBASE_STAGING_* variables —
// both halves must flip together). On EAS the staging files ride as file-type
// environment variables; locally the gitignored *-staging files sit beside
// the production ones.
// App Links and the app's identity (roadmap #76) live in `app-links.json`:
// the hosts the app claims, the paths it answers on, and the SHA-256
// fingerprints of the signing keys. `scripts/generate-app-links.mjs` reads the
// same file to write the verification files the web deploy serves, so a host
// claimed by the app and a host served by the deploy can never drift.
import { readFileSync } from "node:fs"

const appLinks = JSON.parse(
  readFileSync(new URL("./app-links.json", import.meta.url), "utf8"),
)

const stagingEnv = process.env.APP_ENV === "staging"

// Firebase Hosting serves the email-link sign-in handler (#67) on the
// project's own hosts — `<project>.firebaseapp.com`, mirrored on `<project>
// .web.app`. A phone with the app installed opens those URLs straight from the
// email as **Android App Links**, which is what routes them into
// `app/email-link.tsx`; everywhere else the same URL is an ordinary page that
// hands the one-time code to the continue URL in the browser. The hosts track
// the selected environment, exactly like the config files below do.
const projectId = stagingEnv ? "setuno-be01d-staging" : "setuno-be01d"
const authHosts = [`${projectId}.firebaseapp.com`, `${projectId}.web.app`]
const authLinkData = authHosts.flatMap((host) => [
  { scheme: "https", host, pathPrefix: "/__/auth/links" },
  // The older handler path, still minted by some regions — claiming both costs
  // nothing and keeps the flow alive if Firebase switches one off.
  { scheme: "https", host, pathPrefix: "/__/auth/action" },
])

// The app's own hosts (#76): a link to a song, a setlist or a share on one of
// them opens the app when it is installed, and the web app when it is not.
// `autoVerify` asks Android to check `assetlinks.json` on those hosts; the
// file is written by `scripts/generate-app-links.mjs` into the web export.
const appLinkData = appLinks.hosts.flatMap((host) =>
  appLinks.paths.map((path) => ({ scheme: "https", host, pathPrefix: path })),
)

export default {
  expo: {
    owner: "rikirilis",
    name: "Setuno",
    slug: "setuno",
    scheme: "setuno",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icons/mipmap-xxxhdpi/ic_launcher.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    platforms: ["android", "web"],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0B0B14",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: appLinks.bundleId,
      // "Sign in with Apple" (roadmap #66): the entitlement Apple's button
      // needs. The EAS project also needs the capability turned on, and iOS
      // does not build yet — this is here so the day it does, the entitlement
      // is already there.
      entitlements: {
        "com.apple.developer.applesignin": ["Default"],
      },
      // Inert while iOS is not in `platforms` below, and the exact twin of the
      // Android intent filter: Universal Links are what make an emailed
      // sign-in link open the app on an iPhone (#67) and a link to a song
      // open the song (#76). Declared now so iOS ships with the deep-link
      // plumbing instead of without it.
      associatedDomains: [...authHosts, ...appLinks.hosts].map(
        (host) => `applinks:${host}`,
      ),
      googleServicesFile: stagingEnv
        ? (process.env.GOOGLE_SERVICES_PLIST_STAGING ??
          "./GoogleService-Info-staging.plist")
        : "./GoogleService-Info.plist",
      buildNumber: "1",
    },
    android: {
      package: appLinks.packageName,
      versionCode: 2,
      version: "1.1.0",
      minSdkVersion: 24,
      ndkVersion: "29.0.14206865",
      targetSdkVersion: 36,
      googleServicesFile: stagingEnv
        ? (process.env.GOOGLE_SERVICES_JSON_STAGING ??
          "./google-services-staging.json")
        : "./google-services.json",
      // Deep links (#67 and #76): claim two families of URL as **Android App
      // Links**, so a tap opens the app instead of a browser tab —
      //
      //   • the Firebase Hosting auth handler, which is where an emailed
      //     sign-in link points;
      //   • the app's own hosts, where a song, a setlist or a share lives.
      //
      // `autoVerify` asks Android to check `assetlinks.json` on those hosts
      // (written into the web export by `scripts/generate-app-links.mjs`);
      // until the project's **SHA-256** is registered the check fails and
      // Android falls back to the link chooser, where the app is still listed
      // — the flow works either way, it just loses the silent hand-off until
      // the fingerprint is added (see README §Deep links).
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          category: ["BROWSABLE", "DEFAULT"],
          data: [...authLinkData, ...appLinkData],
        },
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0B0B14",
        backgroundImage: "./assets/icon-background.png",
      },
      icon: "./assets/icons/mipmap-xxxhdpi/ic_launcher.png",
      predictiveBackGestureEnabled: true,
      softwareKeyboardLayoutMode: "pan",
      enableProguardInReleaseBuilds: true,
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/favicon.png",
      // The installable web app (roadmap #77): the description and the theme
      // colour the browser shows on the install prompt and in its own UI.
      description:
        "Songs, setlists and gigs for your band: chords, lyrics, a stage reader and a tuner, offline and on every platform.",
      themeColor: "#0B0B14",
    },
    plugins: [
      // Keeps the Gradle daemon on JDK 17 (AGP's native tasks abort on 24+).
      // Local plugin: see `plugins/withGradleJdk17.js`.
      "./plugins/withGradleJdk17",
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      "@react-native-firebase/app-check",
      "expo-router",
      "expo-font",
      "@react-native-google-signin/google-signin",
      // Playback stays background-free (`enableBackgroundPlayback: false` is
      // deliberate — a practice tool that stops when the app leaves the
      // foreground needs no service), but the tuner spike (#13) needs the
      // microphone: the permission strings are declared here so a dev build
      // can request them at runtime; nothing asks for the mic until the tuner
      // screen opens. The tuner ship decision lives in
      // `docs/tuner_spike_memo.md`.
      [
        "expo-audio",
        {
          microphonePermission:
            "Allow $(PRODUCT_NAME) to listen to your microphone while the tuner is open.",
          recordAudioAndroid: true,
          enableBackgroundPlayback: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "The game accesses your photos to let you pick an image for your profile picture.",
        },
      ],
      // Push (#52): the small icon is a pure-alpha glyph tinted with the ember
      // accent, and the plugin's default channel is the very id
      // `services/notifications.ts` creates at registration time — messages
      // that arrive before the app ever opens still have a channel to land on.
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#EA580C",
          defaultChannel: "default",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#0B0B14",
          dark: {
            image: "./assets/splash-icon.png",
            backgroundColor: "#0B0B14",
          },
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
          },
          android: {
            targetSdkVersion: 36,
            compileSdkVersion: 36,
            ndkVersion: "29.0.14206865",
          },
        },
      ],
      [
        "react-native-google-mobile-ads",
        {
          android_app_id: "ca-app-pub-5333671658707378~1730333220",
          androidAppId: "ca-app-pub-5333671658707378~1730333220",
          ios_app_id: "ca-app-pub-5333671658707378~8729932405",
          iosAppId: "ca-app-pub-5333671658707378~8729932405",
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: "dd8d3677-ef3a-463a-b2dd-faa1012f920a",
      },
    },
  },
}
