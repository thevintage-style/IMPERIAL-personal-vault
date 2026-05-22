import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Define the custom operation types for logging and developer debugging
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let firebaseAvailable = false;
let appInstance: any = null;
let authInstance: any = null;
let dbInstance: any = null;

// Check if credentials are placeholders or dummy keys
const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("PlaceHolder");

if (!isPlaceholder) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    authInstance = getAuth(appInstance);
    firebaseAvailable = true;
    console.log("🔥 Firebase cloud connected successfully!");
  } catch (error) {
    console.warn("⚠️ Firebase initialization failed - defaulting to local sandbox mode:", error);
    firebaseAvailable = false;
  }
} else {
  console.log("ℹ️ Running in UPSC Safe-Vault Local Sandbox Storage. Complete Firestore terms to enable cloud sync.");
}

export const isLocalSandbox = !firebaseAvailable;
export const app = appInstance;
export const db = dbInstance;
export const auth = authInstance;

// Error wrapper according to firestore-integration metadata instructions
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = authInstance;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid || 'anonymous_sandbox',
      email: currentAuth?.currentUser?.email || 'sandbox@upscvault.com',
      emailVerified: currentAuth?.currentUser?.emailVerified || false,
      isAnonymous: currentAuth?.currentUser?.isAnonymous || false,
      tenantId: currentAuth?.currentUser?.tenantId || null,
      providerInfo: currentAuth?.currentUser?.providerData?.map((p: any) => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[UPSC Firestore Secure Error Logger]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Global connectivity checking routine
export async function testConnection() {
  if (isLocalSandbox || !dbInstance) return;
  try {
    await getDocFromServer(doc(dbInstance, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}

// Initialise validation
testConnection();
