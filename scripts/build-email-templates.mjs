import {mkdirSync,writeFileSync} from 'node:fs';
import {renderEmail,escapeEmailHtml} from '../src/lib/emailTemplate.ts';
import {bookingMailContent} from '../src/lib/bookingMailContent.ts';

const link={url:'{{ .ConfirmationURL }}'};
const security='Deze link is persoonlijk. Heb je dit niet aangevraagd? Negeer deze e-mail. Deel je link of beveiligingscode nooit met anderen.';
const templates={
 confirmation:{subject:'Bevestig je e-mailadres — MyGrowise',title:'Welkom bij MyGrowise.',preheader:'Bevestig je e-mailadres en rond je registratie af.',paragraphs:['Fijn dat je er bent. Bevestig je e-mailadres om je registratie af te ronden en veilig toegang te krijgen tot je MyGrowise-account.'],action:{...link,label:'Bevestig mijn e-mailadres'},note:security},
 recovery:{subject:'Stel je nieuwe wachtwoord in — MyGrowise',title:'Een nieuw wachtwoord, veilig geregeld.',preheader:'Je vroeg een link aan om je wachtwoord opnieuw in te stellen.',paragraphs:['Je vroeg om je MyGrowise-wachtwoord opnieuw in te stellen. Via de knop hieronder kies je een nieuw wachtwoord. Je huidige wachtwoord blijft werken totdat je een nieuw wachtwoord opslaat.'],action:{...link,label:'Kies een nieuw wachtwoord'},note:security},
 invite:{subject:'Je uitnodiging voor MyGrowise',title:'Je werkruimte staat klaar.',preheader:'Activeer je MyGrowise-account via je persoonlijke uitnodiging.',paragraphs:['Je bent uitgenodigd om MyGrowise te gebruiken. Activeer je account via de knop hieronder. Tijdens het activeren stel je een eigen wachtwoord in.'],action:{...link,label:'Activeer mijn account'},note:'Deze uitnodiging is persoonlijk. Verwachtte je geen uitnodiging? Neem dan contact op met de persoon die je heeft uitgenodigd of met info@mygrowise.be.'},
 magic_link:{subject:'Je veilige inloglink — MyGrowise',title:'Welkom terug.',preheader:'Open je MyGrowise-account via je persoonlijke inloglink.',paragraphs:['Je vroeg een inloglink aan voor MyGrowise. Met de knop hieronder meld je je veilig aan, zonder je wachtwoord in te vullen.'],action:{...link,label:'Log in op MyGrowise'},note:security},
 email_change:{subject:'Bevestig je e-mailwijziging — MyGrowise',title:'Bevestig je nieuwe e-mailadres.',preheader:'Rond de wijziging van je MyGrowise-e-mailadres veilig af.',paragraphs:['Er is een wijziging van het e-mailadres van je MyGrowise-account aangevraagd. Bevestig deze wijziging via de knop hieronder. Als bevestiging op beide adressen nodig is, ontvang je op elk adres een afzonderlijke e-mail.'],action:{...link,label:'Bevestig de e-mailwijziging'},note:'Heb je je e-mailadres niet gewijzigd? Klik dan niet op de knop en neem contact op via info@mygrowise.be.'},
 reauthentication:{subject:'Je beveiligingscode — MyGrowise',title:'Bevestig dat jij het bent.',preheader:'Gebruik deze code om je handeling veilig af te ronden.',paragraphs:['Voor deze handeling vragen we je identiteit opnieuw te bevestigen. Voer onderstaande code in op de MyGrowise-pagina waar je deze hebt aangevraagd.'],details:[['Je code','{{ .Token }}']],note:'Deel deze code nooit met anderen. MyGrowise vraagt je nooit om deze code per e-mail door te sturen. Niet aangevraagd? Negeer dit bericht.'},
};
mkdirSync('supabase/templates',{recursive:true});mkdirSync('output/email-preview',{recursive:true});
const config={};
for(const [kind,content] of Object.entries(templates)){
 const html=renderEmail(content);writeFileSync(`supabase/templates/${kind}.html`,html+'\n');
 writeFileSync(`output/email-preview/auth-${kind}.html`,html+'\n');
 writeFileSync(`output/email-preview/auth-${kind}.txt`,html+'\n');
 writeFileSync(`output/email-preview/auth-${kind}.source.html`,`<!doctype html><html lang="nl"><meta charset="utf-8"><title>Mailbron ${kind}</title><textarea aria-label="Mailbron" style="width:95vw;height:90vh">${escapeEmailHtml(html)}</textarea></html>`);
 config[`mailer_subjects_${kind}`]=content.subject;config[`mailer_templates_${kind}_content`]=html;
 writeFileSync(`output/email-preview/${kind}.html`,html.replaceAll('{{ .ConfirmationURL }}','https://mygrowise.vercel.app/account/bevestigingslink?example=1').replaceAll('{{ .Token }}','123456'));
}
writeFileSync('output/email-preview/supabase-auth-templates.json',JSON.stringify(config,null,2)+'\n');
const payload={name:'Anne',appointment:'Psychologiesessie – online',practitioner:'Margot',startsAt:'2026-11-12T09:00:00Z',endsAt:'2026-11-12T09:50:00Z',channel:'online',instructions:'Je therapeut bezorgt je de praktische informatie voor de online sessie. Zoek een rustige plek waar je ongestoord kunt spreken.'};
for(const kind of ['confirmation','rescheduled','cancelled'])writeFileSync(`output/email-preview/appointment-${kind}.html`,bookingMailContent(kind,payload).html);
writeFileSync('output/email-preview/purchase.html',renderEmail({title:'Je betaling is bevestigd.',preheader:'Je aangekochte inhoud is beschikbaar via Mijn aankopen.',greeting:'Beste Anne,',paragraphs:['Bedankt voor je betaling. Je digitale inhoud staat klaar bij Mijn aankopen. Via de knop hieronder open je jouw materialen, zonder verplicht account.'],details:[['Referentie','MG-VOORBEELD'],['Bedrag','€ 89,00']],action:{label:'Open mijn aankopen',url:'https://mygrowise.vercel.app/aankopen'},note:'Deze link geeft persoonlijke toegang tot je aankopen. Deel hem niet met anderen.'}));
writeFileSync('output/email-preview/index.html','<!doctype html><html lang="nl"><meta charset="utf-8"><title>MyGrowise mailvoorbeelden</title><body style="font:18px/1.8 Arial;background:#fbf8f2;color:#173d35;padding:32px"><h1>MyGrowise mailvoorbeelden</h1>'+['appointment-confirmation','appointment-rescheduled','appointment-cancelled','purchase',...Object.keys(templates)].map(kind=>`<p><a href="${kind}.html">${kind}</a></p>`).join('')+'</body></html>');
console.log('Generated 6 Supabase Auth templates and synthetic visual previews. No mail sent.');
