'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail, UserX, X } from 'lucide-react';
import { initials, userByName } from '@/lib/user';

// Who wrote a note: name, current position and how to reach them — or that they have retired.
export default function AuthorPopup({ name, onClose }: { name: string; onClose: () => void }) {
  const user = userByName(name);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal author-popup" role="dialog" aria-modal="true" aria-labelledby="author-name" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn author-close" aria-label="Close" onClick={onClose}><X className="ic" size={16} /></button>
        <div className="author-head">
          <span className={`avatar author-avatar${user?.retired ? ' retired' : ''}`} aria-hidden>{initials(name)}</span>
          <div>
            <h2 id="author-name">{name}</h2>
            <div className="author-role">{user ? user.role : 'Position unknown'}</div>
          </div>
        </div>
        {user?.retired ? (
          <p className="author-retired"><UserX className="ic" size={16} /> Retired — no longer reachable.</p>
        ) : user ? (
          <a className="btn author-mail" href={`mailto:${user.email}`}><Mail className="ic" size={15} /> {user.email}</a>
        ) : (
          <p className="author-retired">No contact details are on file for this author.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
