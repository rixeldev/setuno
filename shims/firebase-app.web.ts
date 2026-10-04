// Web shim for `@react-native-firebase/app`.
// Re-exports the Firebase JS SDK equivalents so db/firebaseConfig.ts can stay
// platform agnostic. Metro only resolves this file for the web platform.
export {
  deleteApp,
  getApp,
  getApps,
  initializeApp,
  registerVersion,
  setLogLevel,
  SDK_VERSION,
} from "firebase/app"
export type { FirebaseApp, FirebaseOptions } from "firebase/app"