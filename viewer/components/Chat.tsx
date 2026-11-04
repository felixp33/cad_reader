'use client';

import { useEffect, useState } from 'react';
import { ALL_MACHINES } from '@/lib/noteTypes';
import ChatThread from './ChatThread';
import TopBar from './TopBar';

type ModelFile = { path: string; size: number };

const SUGGESTIONS = ['Which lessons learned are documented?', 'What requirements shaped the design?', 'Give me a short overview of the machine.'];

// Full-page chat from the home screen: ask about one machine, or about all of them.
export default function Chat() {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [summary, setSummary] = useState<Record<string, { title: string }>>({});
  const [model, setModel] = useState(ALL_MACHINES);
  const [question, setQuestion] = useState<string | null>(null); // from ?q=, set by the home screen's input
  useEffect(() => {
    setQuestion(new URLSearchParams(location.search).get('q') ?? '');
    fetch('/api/models').then((r) => r.json()).then(setModels).catch(() => {});
    fetch('/api/summary').then((r) => r.json()).then(setSummary).catch(() => {});
  }, []);

  return (
    <div className="chatpage">
      <TopBar>
        <h1 className="topbar-title">Ask</h1>
        <select className="chat-machine" value={model} aria-label="Machine" onChange={(e) => setModel(e.target.value)}>
          <option value={ALL_MACHINES}>All machines</option>
          {models.map((m) => <option key={m.path} value={m.path}>{summary[m.path]?.title || m.path.split('/').pop()}</option>)}
        </select>
      </TopBar>
      <section className="ask chat-window" aria-label="Chat">
        {question !== null && <ChatThread initialQuestion={question || undefined} model={model} selected={null} suggestions={SUGGESTIONS}
          intro={<p>Ask anything about {model === ALL_MACHINES ? 'your machines' : 'this machine'}, its parts and the notes people have left.</p>} />}
      </section>
    </div>
  );
}
