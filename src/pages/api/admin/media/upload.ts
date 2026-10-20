import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { saveMediaAsset, logAudit } from '../../../../lib/db.ts';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024;   // 25MB

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No valid file provided.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mimeType = file.type.toLowerCase();
    const safeExt = ALLOWED_MIME_TYPES[mimeType];

    if (!safeExt) {
      return new Response(
        JSON.stringify({
          error: `File type "${mimeType}" is not allowed. Permitted formats: PNG, JPEG, WebP, SVG, AVIF, and PDF.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const maxSize = mimeType === 'application/pdf' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      return new Response(
        JSON.stringify({ error: `File exceeds maximum permissible size of ${maxMb}MB.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFilename = `${crypto.randomUUID()}${safeExt}`;
    const storagePath = path.join(uploadsDir, safeFilename);

    // Write file to disk securely
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(storagePath, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/${safeFilename}`;

    const asset = saveMediaAsset({
      filename: safeFilename,
      original_name: file.name.slice(0, 200),
      mime_type: mimeType,
      file_size: file.size,
      storage_path: storagePath,
      public_url: publicUrl,
    });

    logAudit({
      user_id: user?.id,
      action: 'media_uploaded',
      entity_type: 'media',
      entity_id: asset.id,
      details: { original_name: asset.original_name, mime_type: asset.mime_type, file_size: asset.file_size },
    });

    return new Response(JSON.stringify({ success: true, asset }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: 'Failed to process file upload.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
