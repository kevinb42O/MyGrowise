export type WritingField = {
  id: string;
  question: string;
  hint: string;
  x: number;
  y: number;
  width: number;
  max: number;
  chalk?: boolean;
};

// Coordinates refer to the answer lines in the original 1200 × 849 illustrations.
export const writingFields: Partial<Record<number, WritingField[]>> = {
  12: [
    { id: 'toverwoord', question: 'Wat is jouw geheime toverwoord?', hint: 'Bedenk een woord waarmee jij je toverkist opent.', x: 858, y: 302, width: 156, max: 28 },
  ],
  13: [
    { id: 'speelplaats-gedachte', question: 'Welke gedachte heb jij op de speelplaats?', hint: 'Schrijf jouw eigen gedachte bij de rode pakketjes.', x: 260, y: 527, width: 131, max: 80 },
    { id: 'speelplaats-gevoel', question: 'Wat voor gevoel geeft die gedachte jou?', hint: 'Een paar woorden is al genoeg.', x: 238, y: 631, width: 154, max: 80 },
    { id: 'speelplaats-helper', question: 'Wat wil jouw alarm je vertellen?', hint: 'Schrijf jouw eigen antwoord bij de groene pakketjes.', x: 258, y: 789, width: 139, max: 80 },
    { id: 'speelplaats-rust', question: 'Wat voel je nu je alarm is gestopt?', hint: 'Schrijf op hoe jij je nu voelt.', x: 685, y: 496, width: 154, max: 80 },
    { id: 'speelplaats-plek', question: 'Waar voel je dit?', hint: 'Waar in je lichaam merk jij dat gevoel?', x: 685, y: 532, width: 154, max: 80 },
  ],
  14: [
    { id: 'toets-helper', question: 'Wat wil je alarm zeggen bij een toets?', hint: 'Schrijf jouw eigen antwoord naast het groene pakketje.', x: 973, y: 386, width: 146, max: 80 },
    { id: 'toets-gevoel', question: 'Hoe voel je je nu je naar de helpertjes hebt geluisterd?', hint: 'Een paar woorden is al genoeg.', x: 953, y: 604, width: 148, max: 80 },
  ],
  15: [
    { id: 'schoolfeest-helper-1', question: 'Wat vertelt jouw alarm je bij het schoolfeest?', hint: 'Schrijf je eerste helpende gedachte op.', x: 1049, y: 78, width: 144, max: 80 },
    { id: 'schoolfeest-helper-2', question: 'Wat vertelt jouw alarm je nog meer?', hint: 'Schrijf je tweede helpende gedachte op.', x: 1049, y: 115, width: 144, max: 80 },
    { id: 'schoolfeest-helper-3', question: 'Welke derde gedachte helpt jou?', hint: 'Schrijf je derde helpende gedachte op.', x: 1049, y: 152, width: 144, max: 80 },
  ],
  19: [
    { id: 'droomgetal', question: 'Schrijf met je droomkrijtje', hint: 'Begin bij 100. Wis je getal uit en schrijf er één lager. Doe het rustig op jouw tempo.', x: 583, y: 549, width: 76, max: 3, chalk: true },
  ],
  20: [
    { id: 'hartjeskracht', question: 'Wat zit er in jouw magische hartje?', hint: 'Denk aan iets waar jij blij van wordt. Een herinnering, een hobby, een plek…', x: 194, y: 748, width: 190, max: 100 },
    { id: 'hartjesgevoel', question: 'Wat voor gevoel geeft jouw hartjeskracht?', hint: 'Schrijf op hoe dat fijne gevoel voor jou voelt.', x: 792, y: 337, width: 195, max: 80 },
  ],
  24: [
    { id: 'gebruikte-kracht', question: 'Welke kracht heb jij hiervoor gebruikt?', hint: 'Welke superkracht hielp jou bij deze toets?', x: 670, y: 262, width: 143, max: 80 },
  ],
};

const inks = ['#174e44', '#28528c', '#8a3e66'];
type Answer = { text: string; ink: string };
const pencilIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 1.5-6L16 3.5a2.1 2.1 0 0 1 3 0L20.5 5a2.1 2.1 0 0 1 0 3L10 18.5 4 20Zm1.5-6 4.5 4.5M14.5 5l4.5 4.5"/></svg>';

export function makeWriting(root: HTMLElement, onOpen: () => void) {
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const layer = get('[data-writing-fields]');
  const launcher = get<HTMLButtonElement>('[data-write-open]');
  const dialog = get<HTMLDialogElement>('[data-write-dialog]');
  const title = get('[data-write-title]');
  const hint = get('[data-write-hint]');
  const textarea = get<HTMLTextAreaElement>('[data-write-input]');
  const number = get<HTMLInputElement>('[data-write-number]');
  const inkTools = get('[data-write-inks]');
  const counter = get('[data-write-count]');
  const message = get('[data-write-message]');
  const lower = get<HTMLButtonElement>('[data-write-lower]');
  const next = get<HTMLButtonElement>('[data-write-next]');
  const list = get('[data-write-list]');
  const memory = new Map<string, Answer>();
  const unsaved = new Set<string>();
  let pageFields: WritingField[] = [];
  let buttons: HTMLButtonElement[] = [];
  let active: WritingField | undefined;
  let ink = inks[0];
  const key = (field: WritingField) => 'mygrowise-fien-writing-v1-' + field.id;

  function read(field: WritingField): Answer {
    const fallback = memory.get(field.id) || { text: '', ink: inks[0] };
    if (unsaved.has(field.id)) return fallback;
    try {
      const answer = JSON.parse(localStorage.getItem(key(field)) || 'null');
      if (!answer || typeof answer.text !== 'string' || answer.text.length > field.max || !inks.includes(answer.ink)) return fallback;
      if (field.chalk && answer.text !== '' && !/^(100|[1-9]?\d)$/.test(answer.text)) return fallback;
      return answer;
    } catch { return fallback; }
  }

  function renderButton(field: WritingField, button: HTMLButtonElement) {
    const answer = read(field);
    const text = answer.text || (field.chalk ? '100' : 'Schrijf hier');
    button.querySelector('span')!.textContent = text;
    button.style.setProperty('--writing-ink', field.chalk ? '#fff9df' : answer.ink);
    button.dataset.filled = answer.text ? 'yes' : 'no';
    button.setAttribute('aria-label', field.question + (answer.text ? ' Jouw antwoord. ' + answer.text : ' Schrijf hier.'));
    button.title = answer.text || field.question;
  }

  function updateInk() {
    textarea.style.color = ink;
    for (const button of inkTools.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.ink === ink));
  }

  function save() {
    if (!active) return;
    const field = active;
    const input = field.chalk ? number : textarea;
    const raw = field.chalk ? input.value : input.value.slice(0, field.max);
    const text = field.chalk && raw !== '' ? String(Number(raw)) : raw;
    if (field.chalk && (number.validity.badInput || text !== '' && !/^(100|[1-9]?\d)$/.test(text))) {
      message.textContent = 'Kies een heel getal van 0 tot 100.';
      return;
    }
    const answer = { text, ink };
    memory.set(field.id, answer);
    try {
      localStorage.setItem(key(field), JSON.stringify(answer));
      unsaved.delete(field.id);
      message.textContent = 'Bewaard op dit apparaat.';
    } catch {
      unsaved.add(field.id);
      message.textContent = 'Je antwoord blijft hier staan. Bewaren voor later lukt nu niet op dit apparaat.';
    }
    counter.textContent = field.chalk ? (text === '0' ? 'Slaapwel, dromer.' : 'Op jouw tempo.') : text.length + ' / ' + field.max;
    lower.disabled = text === '0';
    const button = buttons[pageFields.indexOf(field)];
    if (button) renderButton(field, button);
  }

  function edit(field: WritingField) {
    onOpen();
    active = field;
    const answer = read(field);
    ink = answer.ink;
    root.dataset.writing = 'yes';
    title.textContent = field.question;
    hint.textContent = field.hint;
    textarea.hidden = !!field.chalk;
    number.hidden = lower.hidden = !field.chalk;
    inkTools.hidden = !!field.chalk;
    textarea.value = answer.text;
    textarea.maxLength = field.max;
    number.value = answer.text || '100';
    lower.disabled = number.value === '0';
    counter.textContent = field.chalk ? 'Op jouw tempo.' : answer.text.length + ' / ' + field.max;
    message.textContent = answer.text ? 'Je kunt je antwoord altijd veranderen.' : 'Dit zijn jouw eigen woorden.';
    next.hidden = pageFields.length === 1;
    const picker = get<HTMLDetailsElement>('[data-write-picker]');
    picker.hidden = pageFields.length === 1;
    picker.open = false;
    next.textContent = pageFields.indexOf(field) === pageFields.length - 1 ? 'Eerste vraag' : 'Volgende vraag';
    updateInk();
    list.replaceChildren();
    for (const entry of pageFields) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = entry.question;
      item.setAttribute('aria-current', String(entry === field));
      item.addEventListener('click', () => { save(); edit(entry); });
      list.append(item);
    }
    if (!dialog.open) dialog.showModal();
    const input = field.chalk ? number : textarea;
    input.focus({ preventScroll: true });
    if (!field.chalk) textarea.setSelectionRange(answer.text.length, answer.text.length);
    fitDialog();
  }

  function close() {
    if (dialog.open) {
      if (active?.chalk && !number.reportValidity()) return;
      save();
      dialog.close();
    }
  }

  function fitDialog() {
    if (!dialog.open) return;
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    dialog.style.maxHeight = Math.max(120, height - 24) + 'px';
    dialog.style.top = (viewport?.offsetTop || 0) + Math.max(12, (height - dialog.offsetHeight) / 2) + 'px';
  }
  window.visualViewport?.addEventListener('resize', fitDialog);
  window.visualViewport?.addEventListener('scroll', fitDialog);
  window.addEventListener('resize', fitDialog);

  launcher.addEventListener('click', () => { if (pageFields[0]) edit(pageFields[0]); });
  textarea.addEventListener('input', save);
  textarea.addEventListener('compositionend', save);
  number.addEventListener('input', save);
  number.addEventListener('change', () => {
    if (number.value === '' || !number.validity.valid) number.value = read(active!).text || '100';
    save();
  });
  lower.addEventListener('click', () => {
    if (!number.reportValidity()) return;
    number.value = String(Math.max(0, Math.min(100, Number(number.value || '100')) - 1));
    save();
    if (root.dataset.calm !== 'yes') number.animate([{ opacity: .15 }, { opacity: 1 }], { duration: 220 });
  });
  inkTools.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
    ink = button.dataset.ink!;
    updateInk();
    save();
    textarea.focus({ preventScroll: true });
  }));
  next.addEventListener('click', () => {
    save();
    edit(pageFields[(pageFields.indexOf(active!) + 1) % pageFields.length]);
  });
  get('[data-write-done]').addEventListener('click', close);
  get('[data-write-dismiss]').addEventListener('click', close);
  dialog.addEventListener('cancel', save);
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); close(); }
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    root.dataset.writing = 'no';
    const button = buttons[pageFields.indexOf(active!)];
    button?.focus({ preventScroll: true });
    if (button && root.dataset.calm !== 'yes') {
      const frames = active?.chalk ? [{ opacity: .4 }, { opacity: 1 }] : [{ backgroundColor: '#ffdf8f' }, { backgroundColor: '#fff7e8dd' }];
      button.animate(frames, { duration: 650 });
    }
    active = undefined;
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('storage', event => {
    pageFields.forEach((field, i) => {
      if (event.key === key(field) && field !== active && !unsaved.has(field.id)) { memory.delete(field.id); renderButton(field, buttons[i]); }
    });
  });

  return {
    close,
    setPage(page: number) {
      close();
      pageFields = writingFields[page] || [];
      buttons = [];
      layer.replaceChildren();
      launcher.hidden = pageFields.length === 0;
      launcher.querySelector('span')!.textContent = page === 19 ? 'Mijn droomkrijtje' : 'Schrijf in je boek';
      for (const field of pageFields) {
        const button = document.createElement('button');
        const height = field.chalk ? 81 : 18;
        button.type = 'button';
        button.className = 'reader-write-field';
        button.dataset.field = field.id;
        if (field.chalk) button.dataset.chalk = 'yes';
        button.style.left = field.x / 12 + '%';
        button.style.top = (field.y - height) / 8.49 + '%';
        button.style.width = field.width / 12 + '%';
        button.style.height = height / 8.49 + '%';
        button.innerHTML = pencilIcon + '<span></span>';
        renderButton(field, button);
        button.addEventListener('pointerdown', event => event.stopPropagation());
        button.addEventListener('click', () => edit(field));
        layer.append(button);
        buttons.push(button);
      }
    },
    snapshot(source: HTMLImageElement | HTMLCanvasElement) {
      const filled = pageFields.filter(field => field.chalk || read(field).text);
      if (filled.length === 0) return source;
      const canvas = document.createElement('canvas');
      canvas.width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      canvas.height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
      ctx.scale(canvas.width / 1200, canvas.height / 849);
      for (const field of filled) {
        const answer = read(field);
        ctx.save();
        const height = field.chalk ? 81 : 18;
        if (field.chalk) {
          ctx.translate(field.x + field.width / 2, field.y - height / 2);
          ctx.rotate(11 * Math.PI / 180);
          ctx.translate(-field.x - field.width / 2, -field.y + height / 2);
        }
        ctx.fillStyle = field.chalk ? '#9d9c8d' : '#fff7e8';
        ctx.beginPath();
        ctx.roundRect(field.x, field.y - height, field.width, height, field.chalk ? 20 : 4);
        ctx.fill();
        ctx.fillStyle = field.chalk ? '#fff9df' : answer.ink;
        const size = field.chalk ? 50 : 18;
        ctx.font = size + 'px "Fien Pencil", cursive';
        ctx.textBaseline = 'bottom';
        let text = answer.text || (field.chalk ? '100' : '');
        while (text.length > 1 && ctx.measureText(text).width > field.width - 4) text = text.slice(0, -2) + '…';
        ctx.fillText(text, field.x + 2, field.y - (field.chalk ? 15 : 2));
        ctx.restore();
      }
      return canvas;
    },
  };
}
