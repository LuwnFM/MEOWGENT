import { NextResponse } from 'next/server';
import { createUploadUrl } from '@/lib/storage';

export const runtime = 'nodejs';

function authorized(value: unknown) {
  const configured = process.env.APP_ACCESS_CODE;
  return Boolean(configured) && value === configured;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accessCode?: unknown; filename?: unknown; contentType?: unknown };
    if (!authorized(body.accessCode)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (typeof body.filename !== 'string' || body.filename.length < 1 || body.filename.length > 255) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    const upload = await createUploadUrl(body.filename, typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream');
    return NextResponse.json(upload);
  } catch (error) {
    console.error('File upload URL error:', error);
    return NextResponse.json({ error: 'Storage is not configured' }, { status: 503 });
  }
}