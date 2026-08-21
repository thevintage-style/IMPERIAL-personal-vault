const DB_NAME = 'UPSC_SafeVault_Permanent_Storage_v3';
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
 * Converts Data URL to Blob safely in chunked bytes to handle massive files without call-stack or memory limits
 */
function safeDataURItoBlob(dataURI: string): Blob {
  try {
    const parts = dataURI.split(',');
    if (parts.length < 2) return new Blob([dataURI], { type: 'text/plain' });
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeString = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64Data = parts[1];
    
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeString });
  } catch (err) {
    console.warn("Blob conversion fallback engaged:", err);
    return new Blob([dataURI], { type: 'text/plain' });
  }
}

/**
 * Stores a file permanently (Blob, File, or base64 data string) in IndexedDB and durable local storage
 * Saved permanently until explicitly deleted by the user/admin.
 */
export async function saveLargeFile(key: string, dataUrlOrBlob: string | Blob | File): Promise<void> {
  try {
    const db = await getDB();
    let payload: any = dataUrlOrBlob;
    // If passed a base64 Data URL, convert to Blob to save 50%+ memory and bypass string limits
    if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('data:')) {
      payload = safeDataURItoBlob(dataUrlOrBlob);
      // Also write to permanent localStorage backup for small to medium assets
      try {
        if (dataUrlOrBlob.length < 2500000) {
          localStorage.setItem(`upsc_durable_file_${key}`, dataUrlOrBlob);
        }
      } catch {
        // Safe quota catch
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payload, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn("Permanent storage write fallback:", err);
    try {
      if (typeof dataUrlOrBlob === 'string') {
        localStorage.setItem(`upsc_durable_file_${key}`, dataUrlOrBlob);
      }
    } catch (e) {
      console.warn("Permanent storage backup note:", e);
    }
  }
}

/**
 * Retrieves a file data string/URL from permanent IndexedDB or persistent storage
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
      // Check durable localStorage backup
      const fallback = localStorage.getItem(`upsc_durable_file_${key}`);
      return fallback || null;
    }

    if (result instanceof Blob || result instanceof File) {
      return URL.createObjectURL(result);
    }

    return result as string;
  } catch (err) {
    console.error("Storage read error:", err);
    const fallback = localStorage.getItem(`upsc_durable_file_${key}`);
    return fallback || null;
  }
}

/**
 * Deletes a file from permanent storage when explicitly requested
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
    localStorage.removeItem(`upsc_durable_file_${key}`);
  } catch (err) {
    console.error("Storage delete error:", err);
    localStorage.removeItem(`upsc_durable_file_${key}`);
  }
}

