const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const toBrusselsLocalInput = (value: Date | string) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return value.slice(0, 16);
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const fromBrusselsLocalInput = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('invalid_time');
  const [, year, month, day, hour, minute] = match;
  const wallAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const candidates = [60, 120].map((offset) => new Date(wallAsUtc - offset * 60000))
    .filter((date) => toBrusselsLocalInput(date) === value);
  if (candidates.length !== 1) throw new Error('ambiguous_time');
  return candidates[0].toISOString();
};
