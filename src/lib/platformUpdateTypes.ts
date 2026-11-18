export const UPDATE_STATES = {
  planned: 'Gepland',
  in_progress: 'In uitvoering',
  review: 'Wordt nagekeken',
  released: 'Beschikbaar',
  paused: 'Uitgesteld',
  cancelled: 'Vervallen',
  historical: 'Terugblik',
} as const;
export type UpdateState = keyof typeof UPDATE_STATES;
export type PlatformUpdate = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  next_step: string;
  status: UpdateState;
  published: boolean;
  category: string;
  audience: 'website' | 'dashboard';
  revision: number;
  content_revision?: number;
  updated_at: string;
  created_at: string;
  action_path: string | null;
  action_label: string | null;
  unread?: boolean;
};
export type UpdateEvent = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  status: UpdateState;
  revision: number;
};
export type UpdateComment = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  feedback_status: 'received' | 'handling' | 'answered';
  reply_to: string | null;
  event?: { id: string; title: string; position: number } | null;
  revision: number;
};
export const UPDATE_CATEGORIES = [
  'Werkruimte',
  'Agenda & cliënten',
  'Website',
  'Aanbod & aankopen',
] as const;
export const updateDate = (value: string) =>
  new Intl.DateTimeFormat('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Brussels',
  }).format(new Date(value));
export const validUpdatePath = (path: string) =>
  /^\/(?:admin(?:\/[a-z0-9/-]+)?|startpunt|aanbod|begeleiding|aankopen|zelf-aan-de-slag|contact|vragenlijsten|modules)\/?$/.test(
    path,
  );
