export default {
  expo: {
    owner: "rikirilis",
    name: "Stage Book",
    slug: "stage-book",
    scheme: "stagebook",
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
      bundleIdentifier: "com.rixeldev.stagebook",
      googleServicesFile: "./GoogleService-Info.plist",
      buildNumber: "1",
    },
    android: {
      package: "com.rixeldev.stagebook",
      versionCode: 1,
      version: "1.0.0",
      minSdkVersion: 24,
      ndkVersion: "29.0.14206865",
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
          android_app_id: "ca-app-pub-5333671658707378~7040773765",
          androidAppId: "ca-app-pub-5333671658707378~7040773765",
          ios_app_id: "ca-app-pub-5333671658707378~6877122232",
          iosAppId: "ca-app-pub-5333671658707378~6877122232",
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
