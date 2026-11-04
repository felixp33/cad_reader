import { DOC_TYPES, readDoc, setDoc } from '@/lib/knowledge';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;

// The document provided for an entry. Anything that is not a PDF is served sandboxed so uploaded pages cannot run scripts here.
export function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  const found = id ? readDoc(id) : null;
  if (!found) return new Response('not found', { status: 404 });
  const headers: Record<string, string> = {
    'Content-Type': found.doc.mime,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(found.doc.name)}`,
    'X-Content-Type-Options': 'nosniff',
  };
  if (found.doc.mime !== 'application/pdf') headers['Content-Security-Policy'] = 'sandbox';
  return new Response(new Uint8Array(found.data), { headers });
}

// Upload (raw body; the file name comes in ?name=).
export async function PUT(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get('id'), name = q.get('name')?.trim();
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!id || !name) return new Response('id and name required', { status: 400 });
  if (!DOC_TYPES.includes(mime)) return new Response('Use a PDF, HTML, text or image file.', { status: 415 });
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length === 0 || data.length > MAX_BYTES) return new Response('File must be between 1 byte and 20 MB.', { status: 413 });
  const item = setDoc(id, { name, mime }, data);
  return item ? Response.json(item) : new Response('unknown entry', { status: 404 });
}

export function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  const item = id ? setDoc(id, null) : null;
  return item ? Response.json(item) : new Response('unknown entry', { status: 404 });
}
