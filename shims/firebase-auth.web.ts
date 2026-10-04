// Web shim for `@react-native-firebase/auth`.
//
// React Native Firebase mirrors the firebase-js-sdk modular Auth API, so the
// shim simply re-exports the JS SDK implementation. Metro only resolves this
// file for the web platform.
export * from "firebase/auth"