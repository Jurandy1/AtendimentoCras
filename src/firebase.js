import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA7NcglEdJwmT5rDEL40s_RupMbjYQoCQ8",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "crasatendimento-35796.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "crasatendimento-35796",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "crasatendimento-35796.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "441213432664",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:441213432664:web:151552f03416dc0e3eab2d",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
} catch (err) {
  console.warn("Falha ao inicializar cache local do Firestore. Usando modo padrão.", err);
  db = getFirestore(app);
}
const storage = getStorage(app);

export { app, auth, db, storage };
