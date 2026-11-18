import { renderEmail } from './emailTemplate';
import { UPDATE_STATES, updateDate, type UpdateState } from './platformUpdateTypes';
import { SITE_ORIGIN } from './site';
export type UpdateFeedbackPayload = {
  comment_id: string;
  slug: string;
  title: string;
  summary: string;
  status: UpdateState;
  next_step: string;
  category: string;
  audience: 'website' | 'dashboard';
  author_name: string;
  author_email: string | null;
  body: string;
  created_at: string;
  parent_body?: string | null;
  milestone_title?: string | null;
};
export function updateFeedbackMailContent(p: UpdateFeedbackPayload) {
  const url = `${SITE_ORIGIN}/admin/updates/${encodeURIComponent(p.slug)}#feedback-title`;
  const subject = `Feedback van ${p.author_name.replace(/[\r\n]/g, ' ')} · ${p.title.replace(/[\r\n]/g, ' ')} — MyGrowise`;
  const details: [string, string][] = [
    ['Van', p.author_name],
    ['Onderwerp', p.title],
    ['Omgeving', p.audience === 'website' ? 'Website' : 'Dashboard'],
    ['Onderdeel', p.category],
    ['Voortgang', UPDATE_STATES[p.status]],
    ['Geplaatst', updateDate(p.created_at)],
  ];
  const sections = [
    { title: 'De feedback', body: p.body },
    { title: 'Waar gaat deze update over?', body: p.summary },
    ...(p.next_step ? [{ title: 'Huidige volgende stap', body: p.next_step }] : []),
    ...(p.parent_body ? [{ title: 'Reactie op dit eerdere bericht', body: p.parent_body }] : []),
    ...(p.milestone_title ? [{ title: 'Gekoppelde mijlpaal', body: p.milestone_title }] : []),
  ];
  const note =
    'Deze reactie is bewaard bij de update. Gebruik de knop om daar te antwoorden; een antwoord op deze e-mail wordt niet automatisch aan het dashboardgesprek toegevoegd.';
  const html = renderEmail({
    title: 'Er is nieuwe feedback.',
    preheader: `${p.author_name} denkt mee over ${p.title}.`,
    greeting: 'Dag Kevin,',
    paragraphs: [
      'Er staat een nieuwe reactie bij een MyGrowise-update. Hieronder lees je de feedback met de context erbij.',
    ],
    highlight: { label: `Feedback van ${p.author_name}`, body: p.body },
    details,
    sections: sections.slice(1),
    action: { label: 'Bekijk de update en antwoord', url },
    note,
  });
  const text = `Dag Kevin,\n\nNieuwe feedback bij MyGrowise.\n\n${details.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${sections.map((s) => `${s.title}\n${s.body}`).join('\n\n')}\n\nBekijk de update en antwoord:\n${url}\n\n${note}`;
  return { subject, text, html };
}
