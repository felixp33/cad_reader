'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FolderOpen, Upload, X } from 'lucide-react';

const ACCEPT = '.stp,.step,.igs,.iges,.brep,.brp,.stl';
type Item = { file: File; path: string };

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

// Pop-up with a drop target and pickers for files or a whole folder. Uploads to /api/upload.
export default function AddFilesDialog({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [menu, setMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const upload = async (items: Item[]) => {
    if (!items.length) { setMessage('Nothing to upload.'); return; }
    const form = new FormData();
    for (const { file, path } of items) { form.append('files', file); form.append('paths', path); }
    setBusy(true);
    setMessage(`Uploading ${items.length} file${items.length === 1 ? '' : 's'}…`);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error();
      const { saved, skipped } = await res.json();
      if (saved.length) { onUploaded(); onClose(); return; }
      setMessage(skipped ? 'No supported 3D files found (STEP, IGES, BREP, STL).' : 'Nothing was added.');
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

  return createPortal(
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="add-title">Add 3D files</h2>
          <button className="icon-btn" aria-label="Close" disabled={busy} onClick={onClose}><X className="ic" size={16} /></button>
        </div>
        <div className="modal-body">
          <div
            className={'dropzone' + (over ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <Upload size={28} className="dropzone-icon" aria-hidden />
            <strong>Drop files or a folder here</strong>
            <small>STEP, IGES, BREP, STL</small>
            <div className="dropzone-actions">
              <div className="add-menu">
                <button className="btn" disabled={busy} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><FolderOpen className="ic" size={15} /> Browse computer <ChevronDown className="ic" size={14} /></button>
                {menu && (
                  <div className="add-menu-list" role="menu">
                    <button role="menuitem" onClick={() => { setMenu(false); fileInput.current?.click(); }}>Files</button>
                    <button role="menuitem" onClick={() => { setMenu(false); folderInput.current?.click(); }}>Folder</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {message && <small className="dropzone-msg" role="status">{message}</small>}
          <input ref={fileInput} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { fromInput(e.target.files); e.target.value = ''; }} />
          <input ref={folderInput} type="file" hidden {...({ webkitdirectory: '' } as object)} onChange={(e) => { fromInput(e.target.files); e.target.value = ''; }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
