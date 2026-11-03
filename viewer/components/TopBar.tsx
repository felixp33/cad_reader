'use client';

import Link from 'next/link';
import Settings from './Settings';
import Profile from './Profile';

// Top bar shared by every page: home link, page-specific content (children / actions), then settings and account.
export default function TopBar({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link className="btn icon-btn" href="/" title="Library" aria-label="Library">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" />
        </svg>
      </Link>
      {children}
      <span className="topbar-spacer" />
      {actions}
      <Settings />
      <Profile />
    </header>
  );
}
