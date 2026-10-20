// Sign in with Apple — **web** (roadmap #66).
//
// The browser keeps its current flows: email/password and Google. Apple's
// button is a native affordance, and the web build does not pull in a
// native-only SDK (the same seam as `googleAuth.web.ts`).
//
// The iOS implementation is `appleAuth.ts`; Metro picks this file for the web
// bundle.

/** The web build never offers Apple's button. */
export const isAppleSignInAvailable = async (): Promise<boolean> => false

/** Nothing to do here: the web signs in with email or Google. */
export const signInWithApple = async (): Promise<boolean> => false
