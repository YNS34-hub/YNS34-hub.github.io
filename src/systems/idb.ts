/** Browser-only, private collections. Blobs never leave this device. */
export type LibraryCollection = "music" | "wallpapers";
export interface LibraryRecord {
  id: string;
  collection: LibraryCollection;
  data: Record<string, unknown>;
  blob?: Blob;
  coverBlob?: Blob;
  previewBlob?: Blob;
  coverPreviewBlob?: Blob;
  addedAt?: number;
}

let connection: Promise<IDBDatabase> | undefined;
function openLibrary(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Browser storage is unavailable. Imports remain in this session.",
        ),
      );
      return;
    }
    const request = indexedDB.open("memory-palace-collections", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("collections", {
        keyPath: "id",
      });
      store.createIndex("collection", "collection", { unique: false });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error || new Error("Unable to open local collection."));
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error("Close another palace tab to update local storage."));
    };
  });
  return connection;
}

export async function readLibraryRecords(): Promise<LibraryRecord[]> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("collections", "readonly");
    const request = transaction.objectStore("collections").getAll();
    request.onsuccess = () => resolve(request.result as LibraryRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function writeLibraryRecord(record: LibraryRecord): Promise<void> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("collections", "readwrite");
    transaction.objectStore("collections").put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error || new Error("The browser could not save this file."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ||
          new Error(
            "Browser storage is full. The file remains available this session.",
          ),
      );
  });
}

export async function deleteLibraryRecord(id: string): Promise<void> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("collections", "readwrite");
    transaction.objectStore("collections").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
