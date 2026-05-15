import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connectivity check is disabled by default to avoid noise on cold starts/offline states.
// Use this manually when sycing features are implemented.
export async function testConnection() {
  try {
    // We check a non-existent doc to test auth/connectivity without needing a specific collection
    await getDocFromServer(doc(db, '_internal_', 'heartbeat'));
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes('permission-denied')) {
      // This is expected if not signed in, but confirms we REACHED the server
      return true;
    }
    if (errorMsg.includes('network-error') || errorMsg.includes('not reach')) {
      console.warn("Firestore backend unreachable. Operating in offline mode.");
      return false;
    }
  }
  return true;
}
