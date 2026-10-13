import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import rawConfig from '../firebase-applet-config.json';

// Resolves configuration supporting both Vercel/production environment variables and local json config
const env = import.meta.env;

const effectiveConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId,
  appId: env.VITE_FIREBASE_APP_ID || rawConfig.appId,
  apiKey: env.VITE_FIREBASE_API_KEY || rawConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || rawConfig.firestoreDatabaseId || '(default)',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId,
};

const app = !getApps().length ? initializeApp(effectiveConfig) : getApp();

export const db = effectiveConfig.firestoreDatabaseId && effectiveConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, effectiveConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Connection test as required by Firebase skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase está operando em modo offline/cache.');
    }
  }
}

testConnection();
export default app;
