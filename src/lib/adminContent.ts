import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

export const CONTENT_KINDS = ['article', 'page'] as const;
export const CONTENT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type AdminContent = {
  id: string;
  kind: ContentKind;
  status: ContentStatus;
  title: string;
  slug: string;
  excerpt: string;
  bodyText: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ContentInput = Pick<AdminContent, 'kind' | 'status' | 'title' | 'slug' | 'excerpt' | 'bodyText' | 'seoTitle' | 'seoDescription'>;
export type ContentVersion = Pick<AdminContent, 'status' | 'title' | 'slug' | 'excerpt' | 'seoTitle' | 'seoDescription'> & { id: string; versionNumber: number; createdAt: string };

const columns = 'id,kind,status,title,slug,excerpt,body,seo_title,seo_description,published_at,created_at,updated_at';
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
const rowToContent = (row: Record<string, unknown>): AdminContent => ({
  id: String(row.id), kind: row.kind as ContentKind, status: row.status as ContentStatus,
  title: String(row.title), slug: String(row.slug), excerpt: String(row.excerpt || ''),
  bodyText: typeof (row.body as { text?: unknown })?.text === 'string' ? (row.body as { text: string }).text : '',
  seoTitle: String(row.seo_title || ''), seoDescription: String(row.seo_description || ''),
  publishedAt: row.published_at ? String(row.published_at) : null,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});
const failure = (error: { code?: string; message?: string } | null) => {
  if (!error) return;
  if (error.code === '23505') throw new Error('duplicate_slug');
  throw new Error('database_error');
};

export const contentSlug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const validateContentInput = (form: FormData): { value?: ContentInput; errors: Record<string, string> } => {
  const title = String(form.get('title') || '').trim().replace(/\s+/g, ' ');
  const slug = contentSlug(String(form.get('slug') || title));
  const kind = String(form.get('kind') || '') as ContentKind;
  const status = String(form.get('status') || '') as ContentStatus;
  const excerpt = String(form.get('excerpt') || '').trim();
  const bodyText = String(form.get('body') || '').replace(/\u0000/g, '').trim();
  const seoTitle = String(form.get('seo_title') || '').trim();
  const seoDescription = String(form.get('seo_description') || '').trim();
  const errors: Record<string, string> = {};
  if (title.length < 3 || title.length > 160) errors.title = 'Gebruik tussen 3 en 160 tekens.';
  if (!slug || slug.length > 80) errors.slug = 'Gebruik een geldige URL-slug van maximaal 80 tekens.';
  if (!CONTENT_KINDS.includes(kind)) errors.kind = 'Kies een geldig contenttype.';
  if (!CONTENT_STATUSES.includes(status)) errors.status = 'Kies een geldige publicatiestatus.';
  if (excerpt.length > 360) errors.excerpt = 'De samenvatting mag maximaal 360 tekens bevatten.';
  if (bodyText.length > 20000) errors.body = 'De inhoud mag maximaal 20.000 tekens bevatten.';
  if (seoTitle.length > 70) errors.seo_title = 'SEO-titel mag maximaal 70 tekens bevatten.';
  if (seoDescription.length > 170) errors.seo_description = 'SEO-beschrijving mag maximaal 170 tekens bevatten.';
  if (status === 'published' && !bodyText) errors.body = 'Gepubliceerde content heeft inhoud nodig.';
  return Object.keys(errors).length ? { errors } : { errors, value: { kind, status, title, slug, excerpt, bodyText, seoTitle, seoDescription } };
};

export const listContent = async (): Promise<AdminContent[]> => {
  const { data, error } = await getSupabaseAdmin().from('content_items').select(columns).order('updated_at', { ascending: false }).limit(250);
  failure(error); return ((data || []) as Record<string, unknown>[]).map(rowToContent);
};

export const getContent = async (id: string): Promise<AdminContent | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await getSupabaseAdmin().from('content_items').select(columns).eq('id', id).maybeSingle();
  failure(error); return data ? rowToContent(data as Record<string, unknown>) : null;
};

export const listContentVersions = async (contentId: string): Promise<ContentVersion[]> => {
  if (!isUuid(contentId)) return [];
  const { data, error } = await getSupabaseAdmin().from('content_versions').select('id,version_number,status,title,slug,excerpt,seo_title,seo_description,created_at').eq('content_id', contentId).order('version_number', { ascending: false }).limit(20);
  failure(error);
  return ((data || []) as Record<string, unknown>[]).map((row) => ({ id: String(row.id), versionNumber: Number(row.version_number), status: row.status as ContentStatus, title: String(row.title), slug: String(row.slug), excerpt: String(row.excerpt), seoTitle: String(row.seo_title), seoDescription: String(row.seo_description), createdAt: String(row.created_at) }));
};

const body = (bodyText: string) => ({ text: bodyText });
const publicPath = (item: Pick<AdminContent, 'kind' | 'slug'>) => item.kind === 'article' ? `/inspiratie/${item.slug}` : `/${item.slug}`;

export const createContent = async (input: ContentInput, actor: AuditActor) => {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin().from('content_items').insert({
    kind: input.kind, status: input.status, title: input.title, slug: input.slug, excerpt: input.excerpt,
    body: body(input.bodyText), seo_title: input.seoTitle, seo_description: input.seoDescription,
    published_at: input.status === 'published' ? now : null, created_by: actor.userId || null, updated_by: actor.userId || null,
  }).select(columns).single();
  failure(error); const content = rowToContent(data as Record<string, unknown>);
  await writeSecurityAudit({ actor, action: 'content.created', objectType: 'content_item', objectId: content.id, after: content });
  return content;
};

export const updateContent = async (id: string, input: ContentInput, actor: AuditActor) => {
  const before = await getContent(id);
  if (!before) throw new Error('not_found');
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin().from('content_items').update({
    kind: input.kind, status: input.status, title: input.title, slug: input.slug, excerpt: input.excerpt,
    body: body(input.bodyText), seo_title: input.seoTitle, seo_description: input.seoDescription,
    published_at: input.status === 'published' ? before.publishedAt || now : null, updated_by: actor.userId || null,
  }).eq('id', id).select(columns).maybeSingle();
  failure(error); if (!data) throw new Error('not_found'); const content = rowToContent(data as Record<string, unknown>);
  if (before.status === 'published' && before.slug !== content.slug) {
    const { error: redirectError } = await getSupabaseAdmin().from('content_redirects').upsert({ from_path: publicPath(before), content_id: content.id, created_by: actor.userId || null }, { onConflict: 'from_path' });
    failure(redirectError);
  }
  await writeSecurityAudit({ actor, action: 'content.updated', objectType: 'content_item', objectId: content.id, before, after: content });
  return content;
};

export const getPublishedArticle = async (slug: string) => {
  const { data, error } = await getSupabaseAdmin().from('content_items').select(columns).eq('kind', 'article').eq('status', 'published').eq('slug', contentSlug(slug)).maybeSingle();
  failure(error); return data ? rowToContent(data as Record<string, unknown>) : null;
};

export const listPublishedArticles = async () => {
  const { data, error } = await getSupabaseAdmin().from('content_items').select(columns).eq('kind', 'article').eq('status', 'published').order('published_at', { ascending: false }).limit(100);
  failure(error); return ((data || []) as Record<string, unknown>[]).map(rowToContent);
};

export const resolveContentRedirect = async (path: string) => {
  const { data, error } = await getSupabaseAdmin().from('content_redirects').select('content_items(kind,slug,status)').eq('from_path', path).maybeSingle();
  failure(error);
  const item = (data as { content_items?: Record<string, unknown> | null } | null)?.content_items;
  if (!item || item.status !== 'published') return null;
  return publicPath({ kind: item.kind as ContentKind, slug: String(item.slug) });
};
