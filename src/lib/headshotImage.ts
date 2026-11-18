import sharp from 'sharp';

export const HEADSHOT_MAX_BYTES = 3 * 1024 * 1024;
export const HEADSHOT_ACCEPT = 'image/jpeg,image/png,image/webp';
export const HEADSHOT_ERRORS: Record<string, string> = {
  headshot_size: 'Kies een foto van maximaal 3 MB.',
  headshot_type: 'Kies een geldige JPG-, PNG- of WebP-foto.',
  headshot_dimensions: 'Kies een foto van maximaal 20 megapixels.',
  headshot_missing: 'Kies eerst een foto.',
  headshot_failed: 'De foto kon niet worden opgeslagen. Probeer opnieuw.',
};

/** Decode and re-encode instead of trusting an extension, MIME header or EXIF metadata. */
export async function prepareHeadshot(value: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > HEADSHOT_MAX_BYTES) throw new Error('headshot_size');
  if (!HEADSHOT_ACCEPT.split(',').includes(value.type)) throw new Error('headshot_type');
  const bytes = Buffer.from(await value.arrayBuffer());
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000) throw new Error('headshot_dimensions');
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('headshot_type');
    return await image.rotate().resize(512, 512, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error instanceof Error && (error.message === 'headshot_dimensions' || /pixel limit/i.test(error.message))) throw new Error('headshot_dimensions');
    throw new Error('headshot_type');
  }
}
