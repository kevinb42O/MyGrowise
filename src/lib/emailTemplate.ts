export type EmailContent = {
  title: string;
  preheader: string;
  greeting?: string;
  paragraphs: string[];
  details?: [string, string][];
  action?: { label: string; url: string };
  sections?: { title: string; body: string }[];
  note?: string;
};

export const escapeEmailHtml = (value: string) => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
export const emailUrl = (value: string) => {
  if (value === '{{ .ConfirmationURL }}') return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) return '';
    return url.href;
  } catch { return ''; }
};
const paragraph = (value: string) => `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#405c53;overflow-wrap:anywhere;">${escapeEmailHtml(value).replace(/\n/g,'<br>')}</p>`;

/** Table layout and inline styles keep the email usable in Outlook and Gmail.
 * Content remains legible with images blocked; no tracking pixels or webfonts.
 */
export function renderEmail(content: EmailContent) {
  const actionUrl = content.action ? emailUrl(content.action.url) : '';
  const details = content.details?.map(([label,value]) => `<tr><td valign="top" style="padding:10px 12px 10px 0;width:100px;font-size:13px;line-height:1.6;color:#526d63;">${escapeEmailHtml(label)}</td><td valign="top" style="padding:10px 0;font-size:15px;line-height:1.6;color:#173d35;font-weight:bold;overflow-wrap:anywhere;">${escapeEmailHtml(value)}</td></tr>`).join('') || '';
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeEmailHtml(content.title)}</title><style>@media(max-width:620px){.email-outer{padding:16px 10px!important}.email-content{padding:28px 22px!important}.email-heading{font-size:30px!important}.email-brand{padding:26px 22px!important}}</style></head>
<body style="margin:0;padding:0;background:#f3f0e9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;color:#173d35;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeEmailHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f0e9;"><tr><td align="center" class="email-outer" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fffdf9;border-collapse:collapse;">
<tr><td class="email-brand" style="padding:30px 40px;border-bottom:1px solid #e5e4d9;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:12px;"><img src="https://mygrowise.vercel.app/images/logo-lelie.png" width="38" height="29" alt="" style="display:block;border:0;"></td><td style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#173d35;">MyGrowise</td></tr></table></td></tr>
<tr><td class="email-content" style="padding:38px 40px 40px;"><h1 class="email-heading" style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:normal;line-height:1.17;color:#173d35;">${escapeEmailHtml(content.title)}</h1>
${content.greeting?paragraph(content.greeting):''}${content.paragraphs.map(paragraph).join('')}
${details?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#f2f4ed;"><tr><td style="padding:12px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${details}</table></td></tr></table>`:''}
${actionUrl?`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 20px;"><tr><td bgcolor="#173d35" style="border-radius:6px;mso-padding-alt:16px 24px;"><a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;padding:16px 24px;color:#fffdf9;font-size:15px;line-height:1.4;font-weight:bold;text-decoration:none;border-radius:6px;">${escapeEmailHtml(content.action!.label)}</a></td></tr></table><p style="margin:0 0 28px;font-size:12px;line-height:1.6;color:#526d63;">Werkt de knop niet? <a href="${escapeEmailHtml(actionUrl)}" style="color:#173d35;text-decoration:underline;">Open dezelfde link in je browser</a>.</p>`:''}
${content.sections?.map(section=>`<h2 style="margin:30px 0 12px;font-size:17px;line-height:1.4;color:#173d35;">${escapeEmailHtml(section.title)}</h2>${paragraph(section.body)}`).join('')||''}
${content.note?`<p style="margin:28px 0 0;padding-top:22px;border-top:1px solid #e5e4d9;font-size:13px;line-height:1.7;color:#526d63;">${escapeEmailHtml(content.note)}</p>`:''}
<p style="margin:28px 0 0;font-size:15px;line-height:1.7;color:#173d35;">Met warme groet,<br><strong>Het MyGrowise-team</strong></p></td></tr>
<tr><td style="padding:22px 40px;background:#fffdf9;border-top:1px solid #e5e4d9;color:#405c53;font-size:13px;line-height:1.7;">Een helder vertrekpunt. Ruimte om te groeien.<br><a href="https://mygrowise.be" style="color:#173d35;text-decoration:underline;">mygrowise.be</a> &nbsp;·&nbsp; <a href="mailto:info@mygrowise.be" style="color:#173d35;text-decoration:underline;">info@mygrowise.be</a></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="max-width:540px;margin:20px auto 0;font-size:11px;line-height:1.7;color:#526d63;">MyGrowise · I-Transform SLU<br>Deel geen diagnoses, vragenlijstantwoorden of sessieverslagen via gewone e-mail.</p>
</td></tr></table></body></html>`;
}

/** Safety net for older callers; keeps the full plain-text message intact. */
export function renderTextEmail(subject: string, text: string) {
  return renderEmail({title:subject.replace(/\s*[—|]\s*MyGrowise$/,''),preheader:text.split('\n').find(Boolean)||subject,paragraphs:text.split(/\n\n+/)});
}
