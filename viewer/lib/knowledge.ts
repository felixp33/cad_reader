import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeItem } from './knowledgeTypes';

const FILE = path.join(process.cwd(), 'data', 'knowledge.json');

type Seed = Omit<KnowledgeItem, 'createdAt'>;
const SEED: Seed[] = [
  { id: 'machinery-directive', title: 'Machinery Directive', ref: '2006/42/EC', kind: 'law', region: 'EU', status: 'in-force', year: 2006,
    topics: ['general'], links: ['machinery-regulation', 'iso-12100', 'lvd', 'emc'],
    summary: 'Essential health and safety requirements for machinery placed on the EU market, and the basis for CE marking. Being replaced by Regulation (EU) 2023/1230.' },
  { id: 'machinery-regulation', title: 'Machinery Regulation', ref: '(EU) 2023/1230', kind: 'law', region: 'EU', status: 'upcoming', year: 2023,
    topics: ['general', 'controls'], links: ['machinery-directive', 'iso-13849-1'],
    summary: 'Replaces the Machinery Directive and applies from 20 January 2027. Adds requirements for software, self-evolving behaviour and protection against corruption of safety functions.' },
  { id: 'lvd', title: 'Low Voltage Directive', ref: '2014/35/EU', kind: 'law', region: 'EU', status: 'in-force', year: 2014,
    topics: ['electrical'], links: ['machinery-directive', 'iec-60204-1'],
    summary: 'Safety of electrical equipment designed for use between 50 and 1000 V AC or 75 and 1500 V DC.' },
  { id: 'emc', title: 'EMC Directive', ref: '2014/30/EU', kind: 'law', region: 'EU', status: 'in-force', year: 2014,
    topics: ['emc', 'electrical'], links: ['machinery-directive'],
    summary: 'Equipment must not cause excessive electromagnetic disturbance and must tolerate the disturbance in its environment.' },
  { id: 'betrsichv', title: 'Betriebssicherheitsverordnung (BetrSichV)', ref: 'BetrSichV 2015', kind: 'law', region: 'DE', status: 'in-force', year: 2015,
    topics: ['operation'], links: ['dguv-v3'],
    summary: 'German ordinance on safety when providing and using work equipment: risk assessment by the employer, inspections and maintenance.' },
  { id: 'iso-12100', title: 'General principles for design — risk assessment and risk reduction', ref: 'EN ISO 12100:2010', kind: 'norm', region: 'International', status: 'in-force', year: 2010,
    topics: ['general'], links: ['machinery-directive', 'iso-13849-1', 'iso-14120'],
    summary: 'The basic framework for machine safety: identify hazards, estimate and evaluate risk, reduce it by design, safeguarding and information.' },
  { id: 'iso-13849-1', title: 'Safety-related parts of control systems — Part 1: General principles for design', ref: 'EN ISO 13849-1:2023', kind: 'norm', region: 'International', status: 'in-force', year: 2023,
    topics: ['controls'], links: ['iso-12100', 'iso-14119', 'machinery-regulation'],
    summary: 'Design and performance of safety functions in control systems, expressed as Performance Levels (PL a to e).' },
  { id: 'iec-60204-1', title: 'Electrical equipment of machines — Part 1: General requirements', ref: 'EN 60204-1:2018', kind: 'norm', region: 'International', status: 'in-force', year: 2018,
    topics: ['electrical'], links: ['lvd', 'iec-60204-1-2006'],
    summary: 'Requirements for the electrical equipment of machines: supply disconnection, protection, wiring, control circuits, emergency stop.' },
  { id: 'iec-60204-1-2006', title: 'Electrical equipment of machines — Part 1 (previous edition)', ref: 'EN 60204-1:2006', kind: 'norm', region: 'International', status: 'withdrawn', year: 2006,
    topics: ['electrical'], links: ['iec-60204-1'],
    summary: 'Replaced by the 2018 edition. Still found in older machine documentation.' },
  { id: 'iso-13857', title: 'Safety distances to prevent hazard zones being reached', ref: 'EN ISO 13857:2019', kind: 'norm', region: 'International', status: 'in-force', year: 2019,
    topics: ['guarding'], links: ['iso-14120', 'iso-12100'],
    summary: 'Distances and opening sizes that keep upper and lower limbs out of danger zones.' },
  { id: 'iso-14120', title: 'Guards — General requirements for fixed and movable guards', ref: 'EN ISO 14120:2015', kind: 'norm', region: 'International', status: 'in-force', year: 2015,
    topics: ['guarding'], links: ['iso-14119', 'iso-13857', 'iso-12100'],
    summary: 'Design and construction requirements for fixed and movable guards.' },
  { id: 'iso-14119', title: 'Interlocking devices associated with guards', ref: 'EN ISO 14119:2013', kind: 'norm', region: 'International', status: 'in-force', year: 2013,
    topics: ['guarding', 'controls'], links: ['iso-14120', 'iso-13849-1'],
    summary: 'Principles for designing and selecting interlocking devices, including how to reduce defeating them.' },
  { id: 'iec-60529', title: 'Degrees of protection provided by enclosures (IP Code)', ref: 'EN 60529', kind: 'norm', region: 'International', status: 'in-force', year: 1989,
    topics: ['guarding', 'electrical'], links: ['iec-60204-1'],
    summary: 'The IP code: protection against solid objects, dust and water for enclosures.' },
  { id: 'iso-10218', title: 'Safety requirements for industrial robots', ref: 'ISO 10218-1 / -2', kind: 'norm', region: 'International', status: 'in-force',
    topics: ['robot'], links: ['iso-12100'],
    summary: 'Safety requirements for robots (part 1) and for robot systems and their integration (part 2).' },
  { id: 'dguv-v3', title: 'DGUV Vorschrift 3 — Electrical installations and equipment', ref: 'DGUV V3', kind: 'rule', region: 'DE', status: 'in-force',
    topics: ['electrical', 'operation'], links: ['betrsichv', 'iec-60204-1'],
    summary: 'German accident-insurance rule: electrical equipment must be tested by a qualified person before first use and at regular intervals.' },
];

function write(items: KnowledgeItem[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
}

// First run: start with a handful of well-known entries so the views have something to show.
export function listKnowledge(): KnowledgeItem[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* first run */ }
  const now = new Date().toISOString();
  const items = SEED.map((s) => ({ ...s, createdAt: now }));
  write(items);
  return items;
}

export function saveKnowledge(input: Partial<KnowledgeItem> & Pick<KnowledgeItem, 'title'>): KnowledgeItem {
  const items = listKnowledge();
  const existing = input.id ? items.find((i) => i.id === input.id) : undefined;
  const item: KnowledgeItem = {
    ref: '', kind: 'unsorted', summary: '', topics: [], region: '', status: 'in-force', links: [],
    ...existing, ...input,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  if (existing) items[items.indexOf(existing)] = item; else items.push(item);
  write(items);
  return item;
}

export function deleteKnowledge(id: string) {
  write(listKnowledge().filter((i) => i.id !== id).map((i) => ({ ...i, links: i.links.filter((l) => l !== id) })));
}
