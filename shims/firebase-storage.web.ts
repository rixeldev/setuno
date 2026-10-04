// Web shim for `@react-native-firebase/storage`.
//
// React Native Firebase mirrors the firebase-js-sdk modular Storage API, so
// the shim re-exports the JS SDK implementation. Metro only resolves this file
// for the web platform.
export * from "firebase/storage"