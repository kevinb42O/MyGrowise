import { createContent, getContent, getContentVersion, updateContent, validateContentInput, type ContentInput } from './adminContent';
import { hasPermission, isTrustedFormOrigin, type UserSession } from './adminAuth';
import { auditActor } from './securityAudit';

/** Render failed submissions in the same request: even 20k of text survives without JS or cookies. */
export async function submitContentForm(request: Request, user: UserSession | undefined, requestId?: string, id?: string) {
  if (!isTrustedFormOrigin(request) || !hasPermission(user, 'content.write')) return { error: 'Geen toegang tot deze wijziging.', status: 403 };
  const form = await request.formData();
  const draft: ContentInput = {
    kind: String(form.get('kind') || 'article') as ContentInput['kind'], status: String(form.get('status') || 'draft') as ContentInput['status'],
    title: String(form.get('title') || ''), slug: String(form.get('slug') || ''), excerpt: String(form.get('excerpt') || ''),
    bodyText: String(form.get('body') || ''), seoTitle: String(form.get('seo_title') || ''), seoDescription: String(form.get('seo_description') || ''),
  };
  if (id && form.get('load_version')) {
    const version = await getContentVersion(id, String(form.get('load_version')));
    if (!version) return { error: 'Deze versie is niet gevonden.', status: 404 };
    return { draft: { ...version, status: 'draft' as const }, notice: `Versie ${version.versionNumber} staat in het formulier. Controleer de inhoud en sla op als nieuwe versie. De huidige website is nog niet gewijzigd.`, status: 200 };
  }
  if (id && !hasPermission(user, 'content.publish') && (await getContent(id))?.status === 'published') return { draft, error: 'Een bevoegde publicatierol moet wijzigingen aan gepubliceerde content beheren.', status: 403 };
  if (draft.status === 'published' && !hasPermission(user, 'content.publish')) return { draft, error: 'Je mag deze content niet publiceren. Kies concept of review.', status: 403 };
  const validation = validateContentInput(form);
  if (!validation.value) return { draft, error: Object.values(validation.errors)[0], status: 422 };
  try {
    const actor = auditActor(user, requestId, new URL(request.url).pathname);
    const item = id ? await updateContent(id, validation.value, actor) : await createContent(validation.value, actor);
    return { redirect: `/admin/content/${item.id}?${id ? 'saved' : 'created'}=1`, status: 303 };
  } catch (error) {
    return { draft, error: error instanceof Error && error.message === 'duplicate_slug' ? 'Deze slug bestaat al. Kies een andere URL; je tekst is behouden.' : 'Opslaan is niet gelukt. Je invoer is behouden; probeer opnieuw.', status: 409 };
  }
}
