'use client';

import { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ALL_MACHINES } from '@/lib/noteTypes';
import ChatThread from './ChatThread';
import { useReferenceAnchor } from './References';

const SUGGESTIONS = ['Which lessons learned are documented?', 'What requirements shaped the design?', 'Give me a short overview of the machine.'];

// Chat column on the right of the home screen: asks about all machines. A question typed in the home field is sent as the first message.
export default function Chat({ initialQuestion, onClose }: { initialQuestion?: string; onClose: () => void }) {
  useReferenceAnchor(400); // the reference panel opens to the left of this column
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <section className="ask home-chat" aria-label="Ask about your machines">
      <header className="ask-head">
        <Sparkles className="ic" size={16} /> <strong>Ask about your machines</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X className="ic" size={16} /></button>
      </header>
      <ChatThread model={ALL_MACHINES} selected={null} suggestions={SUGGESTIONS} initialQuestion={initialQuestion}
        intro={<p>Ask anything about your machines, their parts and the notes people have left.</p>} />
    </section>
  );
}
