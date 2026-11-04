'use client';

import { Eye, PencilLine } from 'lucide-react';
import { setMode, useMode } from '@/lib/mode';

// Creator / consumer switch for the top bar.
export default function ModeSwitch() {
  const mode = useMode();
  return (
    <div className="segmented mode-switch" role="group" aria-label="View mode">
      <button aria-pressed={mode === 'creator'} title="Add and edit information" onClick={() => setMode('creator')}><PencilLine className="ic" size={14} /> Creator</button>
      <button aria-pressed={mode === 'consumer'} title="Browse information others have provided" onClick={() => setMode('consumer')}><Eye className="ic" size={14} /> Consumer</button>
    </div>
  );
}
