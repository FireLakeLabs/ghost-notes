import type { SongFiles } from './types';
import { array, object, relativePath, version } from './validate';

export type SongChoice = { label: string; files: SongFiles };
/** Both browser adapters expose the same local, read-only file contract. */
export interface FolderAccess {
  open(): Promise<SongFiles>;
  reopen(): Promise<SongFiles | null>;
}
function scoped(files: SongFiles, prefix: string): SongFiles {
  return {
    read: async (p) => files.read(`${prefix}/${relativePath(p)}`),
    exists: async (p) => files.exists(`${prefix}/${relativePath(p)}`),
  };
}
export async function songChoices(files: SongFiles): Promise<SongChoice[]> {
  if (await files.exists('song.json')) return [{ label: 'Selected song', files }];
  if (!(await files.exists('manifest.json')))
    throw Error('Choose a version 1 song folder or a source folder containing manifest.json.');
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(await files.read('manifest.json')));
  } catch {
    throw Error('Cannot read the source manifest.');
  }
  const manifest = version(raw);
  const choices = array(manifest.pieces, 'source songs').map((piece, i) => {
    const folder = relativePath(object(piece, 'source song').folder);
    return { label: `Song ${i + 1}`, files: scoped(files, folder) };
  });
  if (!choices.length) throw Error('This source folder contains no exported songs.');
  return choices;
}

export type LocalDirectory = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'read' }): Promise<PermissionState>;
};
export function directoryFiles(root: FileSystemDirectoryHandle): SongFiles {
  async function file(path: string) {
    const parts = relativePath(path).split('/'),
      name = parts.pop();
    if (!name) throw Error('Invalid file path');
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    return (await dir.getFileHandle(name)).getFile();
  }
  return {
    read: async (path) => {
      try {
        return new Uint8Array(await (await file(path)).arrayBuffer());
      } catch {
        throw Error(
          'Cannot read a listed reference file. Check folder permission and export completeness.',
        );
      }
    },
    exists: async (path) => {
      try {
        await file(path);
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return false;
        throw Error('Cannot access the reference folder. Reopen it and grant read permission.');
      }
    },
  };
}
/** IndexedDB stores only one handle. Audio, notes and filenames are never written. */
export async function savedDirectory(value?: LocalDirectory): Promise<LocalDirectory | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ghost-notes-folder', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onerror = () => reject(Error('Folder handle storage is unavailable.'));
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction('handles', value ? 'readwrite' : 'readonly');
      const op = value
        ? tx.objectStore('handles').put(value, 'last')
        : tx.objectStore('handles').get('last');
      let result: LocalDirectory | null = null;
      op.onsuccess = () => {
        result = value ?? op.result ?? null;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(Error('Folder handle storage is unavailable.'));
      };
    };
  });
}
export function pickerAccess(
  pick: () => Promise<LocalDirectory>,
): FolderAccess & { use(handle: LocalDirectory): Promise<SongFiles> } {
  let current: LocalDirectory | null = null;
  async function use(handle: LocalDirectory) {
    current = handle;
    // Persistence is optional; an unavailable store must not prevent opening.
    await savedDirectory(current).catch(() => null);
    return directoryFiles(current);
  }
  return {
    use,
    open: async () => use(await pick()),
    reopen: async () => {
      current ??= await savedDirectory().catch(() => null);
      if (!current) return null;
      if (
        (await current.queryPermission({ mode: 'read' })) !== 'granted' &&
        (await current.requestPermission({ mode: 'read' })) !== 'granted'
      )
        throw Error('Read permission was not granted. Open the song folder again.');
      return directoryFiles(current);
    },
  };
}
export function uploadedFiles(files: readonly File[]): SongFiles {
  const map = new Map<string, File>();
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    const slash = path.indexOf('/');
    map.set(slash < 0 ? path : path.slice(slash + 1), file);
  }
  return {
    exists: async (p) => map.has(relativePath(p)),
    read: async (p) => {
      const file = map.get(relativePath(p));
      if (!file) throw Error('A listed reference file is missing.');
      return new Uint8Array(await file.arrayBuffer());
    },
  };
}
export function dropAccess(select: () => Promise<readonly File[]>): FolderAccess {
  return {
    open: async () => {
      const files = await select();
      if (!files.length) throw new DOMException('Cancelled', 'AbortError');
      return uploadedFiles(files);
    },
    reopen: async () => null,
  };
}
/** Invoke during drop dispatch, before DataTransfer becomes protected. */
export function droppedHandle(transfer: DataTransfer): Promise<LocalDirectory | null> {
  const item = transfer.items[0] as
    | (DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> })
    | undefined;
  const pending = item?.getAsFileSystemHandle?.();
  return pending
    ? pending.then((handle) => {
        // This native API returns a permission-capable directory when kind is directory.
        return handle?.kind === 'directory' ? (handle as LocalDirectory) : null;
      })
    : Promise.resolve(null);
}
/** Legacy directory entries keep folder drop available outside Chromium's picker. */
export function droppedFiles(transfer: DataTransfer): SongFiles {
  const root = transfer.items[0]?.webkitGetAsEntry();
  if (!root?.isDirectory) return uploadedFiles(Array.from(transfer.files));
  // FileSystemEntry's discriminant is boolean in lib.dom; the API guarantees these subtypes.
  const directory = root as FileSystemDirectoryEntry;
  const cache = new Map<FileSystemDirectoryEntry, Promise<FileSystemEntry[]>>();
  function entries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    let result = cache.get(dir);
    if (!result) {
      result = new Promise((resolve, reject) => {
        const reader = dir.createReader(),
          all: FileSystemEntry[] = [];
        const next = () =>
          reader.readEntries((batch) => {
            if (!batch.length) resolve(all);
            else {
              all.push(...batch);
              next();
            }
          }, reject);
        next();
      });
      cache.set(dir, result);
    }
    return result;
  }
  async function find(path: string): Promise<File | null> {
    let dir = directory;
    const parts = relativePath(path).split('/');
    for (let i = 0; i < parts.length; i++) {
      const entry = (await entries(dir)).find((e) => e.name === parts[i]);
      if (!entry) return null;
      if (i === parts.length - 1 && entry.isFile)
        return new Promise((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        );
      if (!entry.isDirectory) return null;
      dir = entry as FileSystemDirectoryEntry;
    }
    return null;
  }
  return {
    exists: async (p) => (await find(p)) !== null,
    read: async (p) => {
      const file = await find(p);
      if (!file) throw Error('A listed reference file is missing.');
      return new Uint8Array(await file.arrayBuffer());
    },
  };
}
