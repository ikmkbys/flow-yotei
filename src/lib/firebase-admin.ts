import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
}

function getAdminDb() {
  return getFirestore(getAdminApp());
}

function getAdminAuth() {
  return getAuth(getAdminApp());
}

export { getAdminDb, getAdminAuth };
