export default {
  expo: {
    name: "StageBook",
    slug: "stage-book",
    scheme: "stagebook",
    version: "1.0.0",
    orientation: "default",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    platforms: ["android", "web"],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#14100E",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.rixeldev.stagebook",
      buildNumber: "1",
    },
    android: {
      package: "com.rixeldev.stagebook",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#E2592B",
        backgroundImage: "./assets/adaptive-icon.png",
      },
      icon: "./assets/icon.png",
      predictiveBackGestureEnabled: true,
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: "resize",
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
          image: "./assets/icons/mipmap-xxxhdpi/ic_launcher.png",
          backgroundColor: "#000B0A",
          dark: {
            image: "./assets/icons/mipmap-xxxhdpi/ic_launcher.png",
            backgroundColor: "#000B0A",
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
          android_app_id: "",
          androidAppId: "",
          ios_app_id: "",
          iosAppId: "",
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: "",
      },
    },
  },
}
