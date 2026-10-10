// Paste your Firebase web-app config here (Firebase console > Project settings > Your apps > Web app).
// These values are not secrets: access is enforced by firestore.rules, not by hiding this config.
// While apiKey is empty the site runs in demo mode (data stays in this browser).

export const firebaseConfig = {
    apiKey: "AIzaSyA2jp4PtKejGhXgJ8w3gWsZtMp9UzJTX_M",
  authDomain: "tasker-ab487.firebaseapp.com",
  projectId: "tasker-ab487",
  storageBucket: "tasker-ab487.firebasestorage.app",
  messagingSenderId: "729164460024",
  appId: "1:729164460024:web:286869e5d03583c4f2b00d"
};

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
