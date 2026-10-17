// Web shim for `@react-native-firebase/functions`.
//
// React Native Firebase mirrors the firebase-js-sdk modular Functions API, so
// the shim simply re-exports the JS SDK implementation — callable requests on
// the web attach the browser session's ID token exactly like the native module
// does. Metro only resolves this file for the web platform.
export * from "firebase/functions"
