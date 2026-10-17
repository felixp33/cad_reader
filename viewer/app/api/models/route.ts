import { listModels } from '@/lib/project';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(listModels());
}
