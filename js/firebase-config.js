// Paste your Firebase web-app config here (Firebase console > Project settings > Your apps > Web app).
// These values are not secrets: access is enforced by firestore.rules, not by hiding this config.
// While apiKey is empty the site runs in demo mode (data stays in this browser).

export const firebaseConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
};

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
