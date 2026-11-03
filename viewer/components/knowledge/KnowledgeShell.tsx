'use client';

import Link from 'next/link';
import TopBar from '../TopBar';

const VIEWS = [
  { href: '/knowledge/catalog', label: 'Catalog' },
  { href: '/knowledge/applicability', label: 'What applies?' },
  { href: '/knowledge/timeline', label: 'Timeline' },
  { href: '/knowledge/graph', label: 'Relations' },
  { href: '/knowledge/capture', label: 'Capture' },
];

// Page frame shared by the knowledge views: top bar, switcher between the views, content.
export default function KnowledgeShell({ current, title, search, actions, children }: {
  current: string; title: string; children: React.ReactNode;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }; actions?: React.ReactNode;
}) {
  return (
    <div className="kview">
      <TopBar search={search} actions={actions}>
        <h1 className="topbar-title">{title}</h1>
        <nav className="ktabs" aria-label="Knowledge views">
          {VIEWS.map((v) => <Link key={v.href} href={v.href} aria-current={v.href === current ? 'page' : undefined}>{v.label}</Link>)}
        </nav>
      </TopBar>
      {children}
    </div>
  );
}
