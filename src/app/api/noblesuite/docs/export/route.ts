import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { html, title } = await req.json();
    if (typeof html !== 'string') {
      return new Response(
        JSON.stringify({ ok: false, error: 'INVALID_HTML' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    // Import server-only to avoid bundling into client
    const HTMLtoDOCX = (await import('html-to-docx')).default as any;
    const buffer: Uint8Array | ArrayBuffer | Buffer = await HTMLtoDOCX(
      html,
      null,
      {
        table: { row: { cantSplit: true } }
      }
    );
    const filename = `${(title || 'Document').replace(/\s+/g, '_')}.docx`;
    const body =
      buffer instanceof ArrayBuffer
        ? Buffer.from(buffer)
        : Buffer.from(buffer as any);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (e: any) {
    console.error('DOCX_EXPORT_FAILED', e);
    return new Response(
      JSON.stringify({ ok: false, error: 'DOCX_EXPORT_FAILED' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
