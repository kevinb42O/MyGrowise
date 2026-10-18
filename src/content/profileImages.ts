/** Editorial image defaults. Explicit images chosen in the catalog keep priority. */
export const profileImages: Record<string, string> = {
  'stress-en-emotieprofiel': '/images/profiles/stress-en-emotieprofiel-v1.webp',
  'persoonlijkheidsprofiel-volwassenen': '/images/profiles/persoonlijkheidsprofiel-volwassenen-v1.webp',
  'persoonlijkheidsprofiel-kind': '/images/profiles/persoonlijkheidsprofiel-kind-v1.webp',
  'werk-en-loopbaanprofiel': '/images/profiles/werk-en-loopbaanprofiel-v1.webp',
  'werk-en-burn-outprofiel': '/images/profiles/werk-en-burn-outprofiel-v1.webp',
  'prikkelverwerkingsprofiel': '/images/profiles/prikkelverwerkingsprofiel-v1.webp',
  'trauma-en-herstelprofiel': '/images/profiles/trauma-en-herstelprofiel-v1.webp',
  'emotioneel-welzijnsprofiel-jongeren': '/images/profiles/emotioneel-welzijnsprofiel-jongeren-v1.webp',
  'hechting-en-relatieprofiel': '/images/profiles/hechting-en-relatieprofiel-v1.webp',
};

const legacyImages = new Set([
  '/images/editorial/mygrowise-46.jpg',
  '/images/editorial/mygrowise-50.jpg',
]);

/** Replace only shared legacy portraits, so future admin image edits still work. */
export function resolveProfileImage(type: string, slug: string, image: string): string {
  if (type !== 'profile' || (image && !legacyImages.has(image))) return image;
  return profileImages[slug] ?? image;
}
