// Shared (client + server) definitions for the general knowledge base: norms, rules and laws
// that are not tied to one particular machine.
export const KINDS = [
  { id: 'norm', label: 'Norm', hint: 'Standards (EN, ISO, IEC)' },
  { id: 'law', label: 'Law', hint: 'Directives, regulations, statutes' },
  { id: 'rule', label: 'Rule', hint: 'Guidelines, company or insurer rules' },
  { id: 'unsorted', label: 'Unsorted', hint: 'Captured, not classified yet' },
] as const;
export type Kind = (typeof KINDS)[number]['id'];

export const STATUSES = [
  { id: 'in-force', label: 'In force' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'withdrawn', label: 'Superseded' },
] as const;
export type Status = (typeof STATUSES)[number]['id'];

// What a machine can have or do; drives the "what applies?" questions.
export const TOPICS = [
  { id: 'general', label: 'Every machine' },
  { id: 'electrical', label: 'Electrical equipment' },
  { id: 'controls', label: 'Safety-related controls' },
  { id: 'guarding', label: 'Guards and enclosures' },
  { id: 'robot', label: 'Robots' },
  { id: 'emc', label: 'Electromagnetic emissions' },
  { id: 'operation', label: 'Operation and maintenance' },
] as const;
export type Topic = (typeof TOPICS)[number]['id'];

export type KnowledgeItem = {
  id: string;
  title: string;
  ref: string; // e.g. "EN ISO 12100:2010"
  kind: Kind;
  summary: string;
  topics: Topic[];
  region: string; // EU, DE, International …
  status: Status;
  year?: number;
  links: string[]; // ids of related items
  createdAt: string;
};

export const kindLabel = (k: Kind) => KINDS.find((x) => x.id === k)?.label ?? k;
export const statusLabel = (s: Status) => STATUSES.find((x) => x.id === s)?.label ?? s;
export const topicLabel = (t: Topic) => TOPICS.find((x) => x.id === t)?.label ?? t;
