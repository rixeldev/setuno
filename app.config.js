// Staging builds (roadmap #80 / P0.7) select the staging Firebase project:
// APP_ENV=staging swaps the native config files (the JS half comes from
// db/firebaseConfig.ts, generated from the FIREBASE_STAGING_* variables —
// both halves must flip together). On EAS the staging files ride as file-type
// environment variables; locally the gitignored *-staging files sit beside
// the production ones.
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

export default {
  expo: {
    owner: "rikirilis",
    name: "Setuno",
    slug: "setuno",
    scheme: "setuno",
    version: "1.0.0",
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
      bundleIdentifier: "com.rixeldev.setuno",
      // Inert while iOS is not in `platforms` below, and the exact twin of the
      // Android intent filter: Universal Links are what make an emailed
      // sign-in link open the app on an iPhone (#67). Declared now so iOS ships
      // with the deep-link plumbing instead of without it.
      associatedDomains: authHosts.map((host) => `applinks:${host}`),
      googleServicesFile: stagingEnv
        ? (process.env.GOOGLE_SERVICES_PLIST_STAGING ?? "./GoogleService-Info-staging.plist")
        : "./GoogleService-Info.plist",
      buildNumber: "1",
    },
    android: {
      package: "com.rixeldev.setuno",
      versionCode: 1,
      version: "1.0.0",
      minSdkVersion: 24,
      ndkVersion: "29.0.14206865",
      targetSdkVersion: 36,
      googleServicesFile: stagingEnv
        ? (process.env.GOOGLE_SERVICES_JSON_STAGING ?? "./google-services-staging.json")
        : "./google-services.json",
      // Email-link sign-in (#67): claim the Firebase Hosting auth handler as an
      // Android App Link, so a tap in the inbox opens the app instead of a
      // browser tab. `autoVerify` asks Android to check `assetlinks.json` on
      // those hosts; until the project's **SHA-256** is registered the check
      // fails and Android falls back to the link chooser, where the app is
      // still listed — the flow works either way, it just loses the silent
      // hand-off until the fingerprint is added (see README §Email link).
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          category: ["BROWSABLE", "DEFAULT"],
          data: authLinkData,
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
    },
    plugins: [
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
