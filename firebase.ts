import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, setLogLevel, type Firestore } from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch {}

// 1. Read Firebase configuration safely from Vite environment variables (VITE_FIREBASE_*)
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyARDLfFHtmKiC8gsGBNZhvdnn3u-weXr7E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "excellent-runway-4wlzs.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "excellent-runway-4wlzs",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "excellent-runway-4wlzs.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "410463710828",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:410463710828:web:90f7cd91e3d1dc87e9b249",
};

const databaseId: string =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  "ai-studio-khawreenlibrary-b985de53-1084-4171-88e8-3ffd832bd40d";

// 2. Initialize or retrieve existing Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Initialize Firestore with specific database ID safely
export const firestore: Firestore = getFirestore(app, databaseId);
export const db: Firestore = firestore;

export default app;
