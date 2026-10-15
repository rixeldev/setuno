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
      googleServicesFile: "./GoogleService-Info.plist",
      buildNumber: "1",
    },
    android: {
      package: "com.rixeldev.setuno",
      versionCode: 1,
      version: "1.0.0",
      minSdkVersion: 24,
      ndkVersion: "29.0.14206865",
      targetSdkVersion: 36,
      googleServicesFile: "./google-services.json",
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
