'use client';

import { useEffect, useRef, useState } from 'react';
import { USERS, initials, setUser, useUser } from '@/lib/user';

// Signed-in user badge for the top bar; clicking it opens a menu to switch between the mock accounts.
export default function Profile() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onDown);
    return () => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <div className="profile-wrap" ref={ref}>
      <button className="profile" aria-haspopup="menu" aria-expanded={open} title={`Signed in as ${user.name}`} onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.name} />
        <span className="profile-text">
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </span>
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-head">Switch account</div>
          {USERS.map((u) => (
            <button key={u.id} role="menuitemradio" aria-checked={u.id === user.id} className={u.id === user.id ? 'current' : ''} onClick={() => { setUser(u.id); setOpen(false); }}>
              <Avatar name={u.name} />
              <span className="profile-text">
                <strong>{u.name}</strong>
                <small>{u.role}</small>
              </span>
              {u.id === user.id && <span className="profile-check" aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Avatar = ({ name }: { name: string }) => <span className="avatar" aria-hidden>{initials(name)}</span>;
