// Metro configuration for Stage Book.
//
// db/firebaseConfig.ts imports @react-native-firebase/*, which only ships
// native code. On the web platform we redirect those imports to lightweight
// shims (shims/*.web.ts) that wrap the Firebase JS SDK, so the same typed
// service layer runs on Android and Web without touching the config file.
//
// `firebase/auth` is also redirected because its browser build does not export
// `getReactNativePersistence`, which db/firebaseConfig.ts calls on import.
const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

const SHIMS_DIR = path.resolve(__dirname, "shims") + path.sep

const WEB_SHIMS = {
  "@react-native-firebase/app": path.resolve(SHIMS_DIR, "firebase-app.web.ts"),
  "@react-native-firebase/auth": path.resolve(SHIMS_DIR, "firebase-auth.web.ts"),
  "@react-native-firebase/firestore": path.resolve(SHIMS_DIR, "firebase-firestore.web.ts"),
  "@react-native-firebase/storage": path.resolve(SHIMS_DIR, "firebase-storage.web.ts"),
  "firebase/auth": path.resolve(SHIMS_DIR, "firebase-auth-persistence.web.ts"),
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = WEB_SHIMS[moduleName]
  // Shims themselves must resolve the real Firebase JS SDK, so never redirect
  // a request that originates from inside the shims directory.
  if (platform === "web" && shim && !context.originModulePath.startsWith(SHIMS_DIR)) {
    return { type: "sourceFile", filePath: shim }
  }
  // Fall through to the default resolver (never re-enters this function).
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config