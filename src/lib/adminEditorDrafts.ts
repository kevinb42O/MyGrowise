export type EditorField = {name: string; value: string; type: string; checked?: boolean};
export type EditorDraft = Record<string, EditorField[]>;
/** Hidden fields contain current server revisions and must never be restored from a draft. */
export function editableFields(fields: Iterable<EditorField>): EditorField[] {
  return Array.from(fields).filter(field => field.name && !['hidden', 'file', 'submit', 'button'].includes(field.type)).map(({name, value, type, checked}) => ({name, value, type, ...(checked === undefined ? {} : {checked})}));
}
export function changedEditorForms(initial: EditorDraft, current: EditorDraft, saved?: string): EditorDraft {
  return Object.fromEntries(Object.entries(current).filter(([key, fields]) => key !== saved && JSON.stringify(fields) !== JSON.stringify(initial[key])));
}
export function parseEditorDraft(value: string | null): EditorDraft {
  try {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, EditorField[]] => Array.isArray(entry[1]) && entry[1].every(field => field && typeof field.name === 'string' && typeof field.value === 'string' && typeof field.type === 'string' && !['hidden', 'file'].includes(field.type))));
  } catch { return {}; }
}
