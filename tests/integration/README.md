# Integration tests

These exercise the real Firestore/Auth services — including the security rules in
`firestore.rules` — against the Firebase emulator. They are opt-in because the
emulator is not part of the normal test run.

## Prerequisites

1. Install and start the emulators (requires the Firebase CLI and Java 11+):

   ```bash
   firebase emulators:start --only auth,firestore,storage
   ```

2. Point the app at the emulator:

   ```bash
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
   pnpm test:integration
   ```

## What belongs here

The administrator/member restrictions from docs §47, in particular:

- a member cannot create, edit or delete songs, setlists or performances;
- a member can create a suggestion but cannot resolve it;
- only an admin can invite, change a role or remove a member;
- nobody can accept an invitation addressed to a different email;
- a signed-in user cannot read another user's profile document.

Each test needs its own emulator run, so keep them serial and always create fresh
organizations with `createId("org")` style ids.