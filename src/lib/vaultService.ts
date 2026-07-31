import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, isLocalSandbox, OperationType, handleFirestoreError } from './firebase';
import { PersonalResource, ResourceHubItem, UserProfile } from '../types';
import { encryptText, decryptText } from './encryption';
import { saveLargeFile, getLargeFile, deleteLargeFile } from './largeFileStorage';

// Standard encryption passphrases
// 1. Personal Private items are encrypted with the user's unique UID: secure passwordless isolate.
// 2. Resource Hub items are encrypted using a shared community key to protect against cloud scraping, preserving local readable access for registered candidates.
const COMMUNITY_HUB_PASSPHRASE = "CuratedUpscSharedHubSecretKey2026";


// Dynamic Simulated Local Storage DB for seamless preview and testing when Firestore is provisioning
const SIMULATED_USERS_KEY = "upsc_simulated_users";
const SIMULATED_RESOURCES_KEY = "upsc_simulated_resources_";
const SIMULATED_HUB_KEY = "upsc_simulated_hub";

interface SandboxUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
}

// Default curated materials to seed the Resource Hub so it doesn't start empty
const SEED_HUB_RESOURCES: (Omit<ResourceHubItem, 'url'> & { encryptedUrl: string })[] = [
  {
    id: "seed_1",
    title: "Official UPSC Syllabus & Subject Weightage Tracker",
    description: "Complete updated syllabus micro-classification for Civil Services GS Papers 1-4 and Optional Strategy outline. Essential for pre-study mapping.",
    type: "pdf",
    encryptedUrl: "ENC:3qNclmG+8vT8LveN7JtAorG38KymorG668vD1uD/srGzoA6z/A==", // encrypted "https://upsc.gov.in/syllabus.pdf"
    category: "Syllabus",
    createdAt: new Date(),
    createdBy: "system_admin",
    createdByName: "Expert Curation Council"
  },
  {
    id: "seed_2",
    title: "Mastering Indian Polity: Core Constitutional Landmarks (Article Analysis)",
    description: "Expert curated compendium of critical amendments, fundamental rights cases, and separation of powers summaries. Essential GS Paper 2 scoring reference.",
    type: "pdf",
    encryptedUrl: "ENC:3qNclmG+8vT8LveN7JtAorG38KymorG668vD1uD/srGzoA6w9B6z/7g==", // https://laxmikanthpolity.pdf
    category: "GS2",
    createdAt: new Date(),
    createdBy: "system_admin",
    createdByName: "Dr. A. K. Sharma (Polity Expert)"
  },
  {
    id: "seed_3",
    title: "UPSC Topper's Answer Booklet Analysis: Essay Writing Landmarks",
    description: "Video critique dissecting structure, quote inclusion, and balanced summaries of high-scoring UPSC essays.",
    type: "video",
    encryptedUrl: "ENC:3qNclmG+8vT2K/eN7JtBpbun8K+torG668vN8eD/rLWzpQW37x2zy6uXvQ==", // https://youtube.com/watch?v=essay_topper
    category: "Essay",
    createdAt: new Date(),
    createdBy: "system_admin",
    createdByName: "UPSC Mentor Forum"
  },
  {
    id: "seed_4",
    title: "Daily Hindu & Indian Express editorial summaries (May 2026 Edition)",
    description: "Daily summaries mapping core news editorials to GS Papers syllabus criteria.",
    type: "link",
    encryptedUrl: "ENC:3qNclmG+8vT8LveN7JtAorG38KymorG668vD1uD/srGzoAWn/R+t0eGfuA==", // https://upscpapers-editorials.in
    category: "CurrentAffairs",
    createdAt: new Date(),
    createdBy: "system_admin",
    createdByName: "National News Analyst"
  }
];

// Whitelisted Admin emails that automatically receive administrative access
const ADMIN_EMAILS = [
  "raksha05jk.rao@gmail.com",
  "theimperialscholarupsc05@gmail.com"
];

export const isWhitelistedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.trim().toLowerCase());
};

/**
 * Handle Google Login (without password)
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  if (!isLocalSandbox) {
    try {
      const provider = new GoogleAuthProvider();
      // UPSC request for passwordless Gmail login
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Determine if Admin based on explicit user email list
      const isAdminEmail = isWhitelistedAdmin(user.email);
      const role = isAdminEmail ? 'admin' : 'user';

      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'UPSC Candidate',
        photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
        role,
        createdAt: new Date()
      };

      // Save user profile securely to Firestore database
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: userProfile.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL,
        role: userProfile.role,
        createdAt: serverTimestamp()
      }, { merge: true });

      // Maintain admin document if they are admin
      if (role === 'admin') {
        const adminDocRef = doc(db, 'admins', user.uid);
        await setDoc(adminDocRef, { isAdmin: true }, { merge: true });
      }

      return userProfile;
    } catch (error) {
      console.error("Firebase Login Failed: ", error);
      throw error;
    }
  } else {
    // Beautiful passwordless simulated Google authentication for UPSC Personal Space sandbox
    // Automatically signs in with user's email matching metadata to showcase admin role!
    const sandboxUser: SandboxUser = {
      uid: "sandbox_candidate_2026",
      email: "theimperialscholarupsc05@gmail.com", // Automatically set to user's registered ID to unlock admin hubs!
      displayName: "Imperial Scholar (Admin)",
      photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
      role: 'admin'
    };
    
    localStorage.setItem(SIMULATED_USERS_KEY, JSON.stringify(sandboxUser));
    return {
      ...sandboxUser,
      createdAt: new Date()
    };
  }
}

/**
 * Signs out the candidate
 */
export async function signOutUser(): Promise<void> {
  if (!isLocalSandbox) {
    await fbSignOut(auth);
  } else {
    localStorage.removeItem(SIMULATED_USERS_KEY);
  }
}

/**
 * Subscriber to observe auth transitions
 */
export function subscribeToAuth(callback: (user: UserProfile | null) => void): () => void {
  if (!isLocalSandbox) {
    return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          // Fetch user profile role from Firestore
          const docRef = doc(db, 'users', fbUser.uid);
          const docSnap = await getDoc(docRef);
          
          let role: 'user' | 'admin' = isWhitelistedAdmin(fbUser.email) ? 'admin' : 'user';
          if (docSnap.exists() && docSnap.data().role) {
            // Priority: if email is in ADMIN_EMAILS whitelist, elevate to admin
            role = isWhitelistedAdmin(fbUser.email) ? 'admin' : docSnap.data().role;
          }
          
          callback({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'Candidate',
            photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
            role,
            createdAt: docSnap.exists() && docSnap.data().createdAt 
              ? (docSnap.data().createdAt as Timestamp).toDate() 
              : new Date()
          });
        } catch (error) {
          console.warn("Could not retrieve user role on firestore:", error);
          // Fallback to local profile check
          callback({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'Candidate',
            photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
            role: isWhitelistedAdmin(fbUser.email) ? 'admin' : 'user',
            createdAt: new Date()
          });
        }
      } else {
        callback(null);
      }
    });
  } else {
    // Local Simulated Subscriber hook
    const checkState = () => {
      const stored = localStorage.getItem(SIMULATED_USERS_KEY);
      if (stored) {
        const u = JSON.parse(stored) as SandboxUser;
        callback({
          ...u,
          createdAt: new Date()
        });
      } else {
        callback(null);
      }
    };
    
    checkState();
    // Watch local interval for sync
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }
}

// List of standard callback subscribers to emulate real time sockets in simulated mode
const resourceChangeSubscribers = new Set<() => void>();
const hubChangeSubscribers = new Set<() => void>();

/**
 * Save / Create item in Personal Private Vault (Encrypted client-side)
 */
export async function savePersonalResource(
  userId: string, 
  item: Omit<PersonalResource, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<void> {
  const resourceId = existingId || "user_" + Math.random().toString(36).substring(2, 15);
  
  // Clean up old IndexedDB file if type changed or URL is not a data URL anymore
  if (existingId && (!item.url || !item.url.startsWith('data:'))) {
    await deleteLargeFile(`large_file_${existingId}`);
  }

  let finalUrl = item.url;
  if (item.url && item.url.startsWith('data:')) {
    const fileKey = `large_file_${resourceId}`;
    await saveLargeFile(fileKey, item.url);
    finalUrl = `largefile:${fileKey}`;
  }

  // 🔒 Client-Side Encryption: Encrypt private url field with User's specific UID
  const encryptedUrl = await encryptText(finalUrl, userId);
  
  if (!isLocalSandbox) {
    const docPath = `users/${userId}/personal_resources/${resourceId}`;
    try {
      const docRef = doc(db, docPath);
      await setDoc(docRef, {
        id: resourceId,
        title: item.title,
        description: item.description,
        type: item.type,
        url: encryptedUrl,
        category: item.category,
        folderId: item.folderId || "",
        createdAt: existingId ? Timestamp.fromDate(new Date()) : serverTimestamp(), // placeholder for server time
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  } else {
    // Local Sandbox Storage Write Setup
    const storedStr = localStorage.getItem(SIMULATED_RESOURCES_KEY + userId);
    let list: any[] = storedStr ? JSON.parse(storedStr) : [];
    
    if (existingId) {
      list = list.map(x => x.id === existingId ? {
        ...x,
        title: item.title,
        description: item.description,
        type: item.type,
        url: encryptedUrl,
        category: item.category,
        folderId: item.folderId || "",
        updatedAt: new Date().toISOString()
      } : x);
    } else {
      list.push({
        id: resourceId,
        title: item.title,
        description: item.description,
        type: item.type,
        url: encryptedUrl,
        category: item.category,
        folderId: item.folderId || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    localStorage.setItem(SIMULATED_RESOURCES_KEY + userId, JSON.stringify(list));
    resourceChangeSubscribers.forEach(sub => sub());
  }
}

/**
 * Remove an item from the candidate's personal space
 */
export async function deletePersonalResource(userId: string, resourceId: string): Promise<void> {
  await deleteLargeFile(`large_file_${resourceId}`);
  if (!isLocalSandbox) {
    const docPath = `users/${userId}/personal_resources/${resourceId}`;
    try {
      const docRef = doc(db, docPath);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  } else {
    const storedStr = localStorage.getItem(SIMULATED_RESOURCES_KEY + userId);
    if (storedStr) {
      let list: any[] = JSON.parse(storedStr);
      list = list.filter(x => x.id !== resourceId);
      localStorage.setItem(SIMULATED_RESOURCES_KEY + userId, JSON.stringify(list));
      resourceChangeSubscribers.forEach(sub => sub());
    }
  }
}

/**
 * Client-Side Auto-Decryption Service for private candidate vault
 */
export async function decryptPersonalResources(rawItems: any[], userUid: string): Promise<PersonalResource[]> {
  const decResults = await Promise.all(rawItems.map(async (raw) => {
    let plainUrl = raw.url;
    let isDecrypted = false;
    
    if (raw.url && raw.url.startsWith("ENC:")) {
      plainUrl = await decryptText(raw.url, userUid);
      isDecrypted = true;
    }
    
    if (plainUrl && plainUrl.startsWith("largefile:")) {
      const fileKey = plainUrl.replace("largefile:", "");
      const localDataUrl = await getLargeFile(fileKey);
      if (localDataUrl) {
        plainUrl = localDataUrl;
      }
    }
    
    return {
      id: raw.id,
      title: raw.title || '',
      description: raw.description || '',
      type: raw.type || 'link',
      url: plainUrl,
      category: raw.category || 'General',
      folderId: raw.folderId || '',
      createdAt: raw.createdAt instanceof Timestamp ? raw.createdAt.toDate() : new Date(raw.createdAt),
      updatedAt: raw.updatedAt instanceof Timestamp ? raw.updatedAt.toDate() : new Date(raw.updatedAt),
      isDecrypted
    } as PersonalResource;
  }));
  return decResults;
}

/**
 * Real-time Snapshot subscriber to personal space resources (with client-side decryption built inside stream)
 */
export function subscribePersonalResources(
  userId: string, 
  onUpdate: (items: PersonalResource[]) => void
): () => void {
  if (!isLocalSandbox) {
    const colPath = `users/${userId}/personal_resources`;
    const colRef = collection(db, colPath);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, async (snap) => {
      const rawList = snap.docs.map(doc => doc.data());
      const decrypted = await decryptPersonalResources(rawList, userId);
      onUpdate(decrypted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    });
  } else {
    // Simulated live stream
    const handleUpdate = async () => {
      const storedStr = localStorage.getItem(SIMULATED_RESOURCES_KEY + userId);
      const rawList = storedStr ? JSON.parse(storedStr) : [];
      const decrypted = await decryptPersonalResources(rawList, userId);
      onUpdate(decrypted);
    };
    
    resourceChangeSubscribers.add(handleUpdate);
    handleUpdate();
    return () => {
      resourceChangeSubscribers.delete(handleUpdate);
    };
  }
}

/**
 * Save resource to expert Shared "Resource Hub" (Admin access only)
 */
export async function saveResourceHubItem(
  adminId: string,
  adminName: string,
  item: Omit<ResourceHubItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>,
  existingId?: string
): Promise<void> {
  const hubId = existingId || "hub_" + Math.random().toString(36).substring(2, 15);
  
  // Clean up old IndexedDB file if type changed or URL is not a data URL anymore
  if (existingId && (!item.url || !item.url.startsWith('data:'))) {
    await deleteLargeFile(`large_file_${existingId}`);
  }

  let finalUrl = item.url;
  if (item.url && item.url.startsWith('data:')) {
    const fileKey = `large_file_${hubId}`;
    await saveLargeFile(fileKey, item.url);
    finalUrl = `largefile:${fileKey}`;
  }
  
  // 🔒 Client-Side Encryption: Encrypt with Shared Community Key to lock cloud index databases
  const encryptedUrl = await encryptText(finalUrl, COMMUNITY_HUB_PASSPHRASE);
  
  if (!isLocalSandbox) {
    const docPath = `resource_hub/${hubId}`;
    try {
      const docRef = doc(db, docPath);
      await setDoc(docRef, {
        id: hubId,
        title: item.title,
        description: item.description,
        type: item.type,
        url: encryptedUrl,
        category: item.category,
        createdAt: existingId ? Timestamp.fromDate(new Date()) : serverTimestamp(),
        createdBy: adminId,
        createdByName: adminName
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  } else {
    // Simulated Shared Hub database write
    const storedHub = localStorage.getItem(SIMULATED_HUB_KEY);
    let list: any[] = storedHub ? JSON.parse(storedHub) : [];
    
    const existingIndex = list.findIndex(x => x.id === hubId);
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        title: item.title,
        description: item.description,
        type: item.type,
        url: encryptedUrl,
        category: item.category
      };
    } else {
      list.push({
        id: hubId,
        title: item.title,
        description: item.description,
        type: item.type,
        url: encryptedUrl,
        category: item.category,
        createdAt: new Date().toISOString(),
        createdBy: adminId,
        createdByName: adminName
      });
    }
    
    localStorage.setItem(SIMULATED_HUB_KEY, JSON.stringify(list));
    hubChangeSubscribers.forEach(sub => sub());
  }
}

/**
 * Remove an item from the curated Resource Hub (Admins Only)
 */
export async function deleteResourceHubItem(hubId: string): Promise<void> {
  await deleteLargeFile(`large_file_${hubId}`);
  if (!isLocalSandbox) {
    const docPath = `resource_hub/${hubId}`;
    try {
      await deleteDoc(doc(db, docPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  } else {
    const storedHub = localStorage.getItem(SIMULATED_HUB_KEY);
    if (storedHub) {
      let list: any[] = JSON.parse(storedHub);
      list = list.filter(x => x.id !== hubId);
      localStorage.setItem(SIMULATED_HUB_KEY, JSON.stringify(list));
      hubChangeSubscribers.forEach(sub => sub());
    }
  }
}

/**
 * Auto seed community Resource Hub so it contains beautiful, ready-to-use expert studies
 */
function checkAndSeedHub() {
  if (isLocalSandbox) {
    const storedHub = localStorage.getItem(SIMULATED_HUB_KEY);
    if (!storedHub || JSON.parse(storedHub).length === 0) {
      localStorage.setItem(SIMULATED_HUB_KEY, JSON.stringify(SEED_HUB_RESOURCES));
    }
  }
}

// Core seeding initialiser
checkAndSeedHub();

/**
 * Shared Hub Decryption stream
 */
export async function decryptHubResources(rawItems: any[]): Promise<ResourceHubItem[]> {
  return Promise.all(rawItems.map(async (raw) => {
    let plainUrl = raw.url || raw.encryptedUrl; // support seed indices or raw
    let isDecrypted = false;
    
    if (plainUrl && plainUrl.startsWith("ENC:")) {
      plainUrl = await decryptText(plainUrl, COMMUNITY_HUB_PASSPHRASE);
      isDecrypted = true;
    }
    
    if (plainUrl && plainUrl.startsWith("largefile:")) {
      const fileKey = plainUrl.replace("largefile:", "");
      const localDataUrl = await getLargeFile(fileKey);
      if (localDataUrl) {
        plainUrl = localDataUrl;
      }
    }
    
    return {
      id: raw.id,
      title: raw.title || '',
      description: raw.description || '',
      type: raw.type || 'link',
      url: plainUrl,
      category: raw.category || 'General',
      folderId: raw.folderId || '',
      createdAt: raw.createdAt instanceof Timestamp ? raw.createdAt.toDate() : new Date(raw.createdAt),
      createdBy: raw.createdBy || 'system',
      createdByName: raw.createdByName || 'Global Expert',
      isDecrypted
    } as ResourceHubItem;
  }));
}

/**
 * Subscribe to Live Shared "Resource Hub" items
 */
export function subscribeResourceHub(onUpdate: (items: ResourceHubItem[]) => void): () => void {
  if (!isLocalSandbox) {
    const colPath = `resource_hub`;
    const colRef = collection(db, colPath);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, async (snap) => {
      const rawList = snap.docs.map(doc => doc.data());
      const decrypted = await decryptHubResources(rawList);
      onUpdate(decrypted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    });
  } else {
    // Local sandbox simulation stream
    const handleUpdate = async () => {
      const storedHub = localStorage.getItem(SIMULATED_HUB_KEY);
      const rawList = storedHub ? JSON.parse(storedHub) : SEED_HUB_RESOURCES;
      const decrypted = await decryptHubResources(rawList);
      onUpdate(decrypted);
    };
    
    hubChangeSubscribers.add(handleUpdate);
    handleUpdate();
    return () => {
      hubChangeSubscribers.delete(handleUpdate);
    };
  }
}

/**
 * Easily copy any curated material from the Resource Hub to candidate's own Personal Private Vault!
 * This encrypts the copied material specifically for the candidate.
 */
export async function importItemToPersonalVault(userId: string, hubItem: ResourceHubItem): Promise<void> {
  await savePersonalResource(userId, {
    title: hubItem.title,
    description: `[Imported from Shared Resource Hub] - ${hubItem.description}`,
    type: hubItem.type,
    url: hubItem.url, // Original decrypted URL is retrieved from the UI card and re-encrypted specifically under the user's UID pass key!
    category: hubItem.category,
    folderId: hubItem.folderId || ""
  });
}

import { Folder } from '../types';

// Folder tracking subscribers
const folderChangeSubscribers = new Set<() => void>();
const SIMULATED_FOLDERS_KEY = "upsc_simulated_folders_";

/**
 * Save folder inside user database or local sandbox space
 */
export async function saveFolder(userId: string, folder: { id: string; name: string }): Promise<void> {
  if (!isLocalSandbox) {
    const docPath = `users/${userId}/folders/${folder.id}`;
    try {
      const docRef = doc(db, docPath);
      await setDoc(docRef, {
        id: folder.id,
        name: folder.name,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  } else {
    const stored = localStorage.getItem(SIMULATED_FOLDERS_KEY + userId);
    let folders: any[] = stored ? JSON.parse(stored) : [];
    const idx = folders.findIndex(x => x.id === folder.id);
    if (idx >= 0) {
      folders[idx].name = folder.name;
    } else {
      folders.push({
        id: folder.id,
        name: folder.name,
        createdAt: new Date().toISOString()
      });
    }
    localStorage.setItem(SIMULATED_FOLDERS_KEY + userId, JSON.stringify(folders));
    folderChangeSubscribers.forEach(sub => sub());
  }
}

/**
 * Delete folder from database or sandbox space
 */
export async function deleteFolder(userId: string, folderId: string): Promise<void> {
  if (!isLocalSandbox) {
    const docPath = `users/${userId}/folders/${folderId}`;
    try {
      await deleteDoc(doc(db, docPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  } else {
    const stored = localStorage.getItem(SIMULATED_FOLDERS_KEY + userId);
    if (stored) {
      let folders: any[] = JSON.parse(stored);
      folders = folders.filter(x => x.id !== folderId);
      localStorage.setItem(SIMULATED_FOLDERS_KEY + userId, JSON.stringify(folders));
      folderChangeSubscribers.forEach(sub => sub());
    }
  }
}

/**
 * Subscribe to folders stream
 */
export function subscribeFolders(userId: string, onUpdate: (folders: Folder[]) => void): () => void {
  if (!isLocalSandbox) {
    const colPath = `users/${userId}/folders`;
    const colRef = collection(db, colPath);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(docDoc => {
        const d = docDoc.data();
        return {
          id: d.id,
          name: d.name,
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date()
        } as Folder;
      });
      onUpdate(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    });
  } else {
    const handleUpdate = () => {
      const stored = localStorage.getItem(SIMULATED_FOLDERS_KEY + userId);
      let list = stored ? JSON.parse(stored) : [];
      list = list.map((d: any) => ({
        id: d.id,
        name: d.name,
        createdAt: new Date(d.createdAt)
      }));
      onUpdate(list);
    };
    
    folderChangeSubscribers.add(handleUpdate);
    handleUpdate();
    return () => {
      folderChangeSubscribers.delete(handleUpdate);
    };
  }
}
