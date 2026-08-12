/* ============================================================
   Firebase configuration
   ------------------------------------------------------------
   Fill this in with your own project's web-app config, then
   reload the page. Until it is filled in, IPO Monitor keeps
   storing everything in localStorage only.

   Where to get these values:
     1. https://console.firebase.google.com → create/open a project
     2. Project settings → Your apps → Web app (</>) → Register app
     3. Copy the `firebaseConfig` object shown and paste it below
     4. Build → Firestore Database → Create database
     5. Build → Authentication → Sign-in method → enable
        "Anonymous" (required) and "Email/Password" (optional,
        needed only if you want the same data on several devices)
     6. Publish the rules in firestore.rules

   These values are not secrets — they identify the project, they
   don't grant access. Access is controlled by firestore.rules,
   which limits every user to their own document.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyC_KqExR3rMfAqbljkL8f69dFMzYNyhbEY",
  authDomain: "ipomonitor-8cd6c.firebaseapp.com",
  projectId: "ipomonitor-8cd6c",
  storageBucket: "ipomonitor-8cd6c.firebasestorage.app",
  messagingSenderId: "112421196604",
  appId: "1:112421196604:web:f51ea8f7adc94b5e494439",
  measurementId: "G-ZR78BRJLBT"
};
