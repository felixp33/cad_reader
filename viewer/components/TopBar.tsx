'use client';

import Link from 'next/link';
import { House } from 'lucide-react';
import Settings from './Settings';
import Profile from './Profile';
import ModeSwitch from './ModeSwitch';

// Top bar shared by every page: home link, page-specific content (children / actions), then settings and account.
export default function TopBar({ children, actions, search, home = true }: {
  children?: React.ReactNode; actions?: React.ReactNode; home?: boolean; // home: show the link back to the library
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
}) {
  return (
    <header className="topbar">
      {home && (
        <Link className="btn icon-btn" href="/" title="Library" aria-label="Library">
          <House className="ic" size={16} aria-hidden />
        </Link>
      )}
      {children}
      <span className="topbar-spacer" />
      {search && (
        <input className="topbar-search" type="search" value={search.value} placeholder={search.placeholder ?? 'Search…'} aria-label="Search" onChange={(e) => search.onChange(e.target.value)} />
      )}
      {actions}
      <ModeSwitch />
      <Settings />
      <Profile />
    </header>
  );
}
