// Web shim for `@react-native-firebase/firestore`.
//
// React Native Firebase mirrors the firebase-js-sdk modular Firestore API, so
// the shim re-exports the JS SDK implementation. Metro only resolves this file
// for the web platform.
export * from "firebase/firestore"