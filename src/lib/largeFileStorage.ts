const DB_NAME = 'UPSC_SafeVault_LargeFiles_v2';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Converts Data URL to Blob for high efficiency binary storage in IndexedDB
 */
function dataURItoBlob(dataURI: string): Blob {
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch {
    return new Blob([dataURI], { type: 'text/plain' });
  }
}

/**
 * Stores a large file (Blob, File, or base64 data string) in IndexedDB
 */
export async function saveLargeFile(key: string, dataUrlOrBlob: string | Blob | File): Promise<void> {
  try {
    const db = await getDB();
    let payload: any = dataUrlOrBlob;
    // If passed a base64 Data URL, convert to Blob to save 50%+ memory and bypass string limits
    if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('data:')) {
      payload = dataURItoBlob(dataUrlOrBlob);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payload, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn("IndexedDB save warning, attempting fallback:", err);
    // If IndexedDB save fails, fallback to window.sessionStorage or memory
    try {
      if (typeof dataUrlOrBlob === 'string') {
        window.sessionStorage.setItem(key, dataUrlOrBlob);
      }
    } catch (e) {
      console.error("Storage write error:", e);
    }
  }
}

/**
 * Retrieves a large file data string/URL from IndexedDB
 */
export async function getLargeFile(key: string): Promise<string | null> {
  try {
    const db = await getDB();
    const result: any = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });

    if (!result) {
      // Check fallback sessionStorage
      const fallback = window.sessionStorage.getItem(key);
      return fallback || null;
    }

    if (result instanceof Blob || result instanceof File) {
      return URL.createObjectURL(result);
    }

    return result as string;
  } catch (err) {
    console.error("IndexedDB read error:", err);
    const fallback = window.sessionStorage.getItem(key);
    return fallback || null;
  }
}

/**
 * Deletes a large file from IndexedDB
 */
export async function deleteLargeFile(key: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
    window.sessionStorage.removeItem(key);
  } catch (err) {
    console.error("IndexedDB delete error:", err);
  }
}

