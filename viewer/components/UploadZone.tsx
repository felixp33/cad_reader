'use client';

import { useRef, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';

export type UploadItem = { file: File; path: string };
type Item = UploadItem;

export const MODEL_ACCEPT = '.stp,.step,.igs,.iges,.brep,.brp,.stl';
export const DOC_ACCEPT = 'application/pdf,text/html,text/plain,image/png,image/jpeg,image/svg+xml';

// Uploads 3D files (keeping folder structure) to the project; returns what to tell the user when nothing was added.
export async function uploadModels(items: UploadItem[]): Promise<string | null> {
  const form = new FormData();
  for (const { file, path } of items) { form.append('files', file); form.append('paths', path); }
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error();
  const { saved, skipped } = await res.json();
  return saved.length ? null : skipped ? 'No supported 3D files found (STEP, IGES, BREP, STL).' : 'Nothing was added.';
}

// Recursively collects files from a dropped entry (file or folder), keeping the relative path.
async function readEntry(entry: FileSystemEntry, out: Item[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, path: entry.fullPath.replace(/^\//, '') });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await readEntry(e, out);
    }
  }
}

// Drop target with a file picker. `upload` stores them and returns a message
// when nothing could be added; `onUploaded` runs after a successful upload.
export default function UploadZone({ upload: store, onUploaded, accept, hint }: {
  upload: (items: UploadItem[]) => Promise<string | null>; onUploaded: () => void; accept: string; hint: string
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (items: Item[]) => {
    if (!items.length) { setMessage('Nothing to upload.'); return; }
    setBusy(true);
    setMessage(`Uploading ${items.length} file${items.length === 1 ? '' : 's'}…`);
    try {
      const problem = await store(items);
      if (problem) setMessage(problem); else { setMessage(''); onUploaded(); }
    } catch {
      setMessage('Upload failed.');
    }
    setBusy(false);
  };

  const fromInput = (files: FileList | null) => {
    if (!files) return;
    upload(Array.from(files).map((file) => ({ file, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name })));
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (busy) return;
    // Entries must be grabbed synchronously — the DataTransfer is cleared after the first await.
    const entries = Array.from(e.dataTransfer.items).map((i) => i.webkitGetAsEntry()).filter((x): x is FileSystemEntry => !!x);
    const items: Item[] = [];
    try { for (const entry of entries) await readEntry(entry, items); } catch { setMessage('Could not read the dropped items.'); return; }
    upload(items);
  };

  return (
    <div className={'uploadzone' + (over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <Upload size={20} className="dropzone-icon" aria-hidden />
      <span className="uploadzone-text">
        <strong>Drop files or a folder here</strong>
        <small role="status">{message || hint}</small>
      </span>
      <button className="btn" disabled={busy} onClick={() => fileInput.current?.click()}><FolderOpen className="ic" size={15} /> Browse</button>
      <input ref={fileInput} type="file" multiple hidden accept={accept} onChange={(e) => { fromInput(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
