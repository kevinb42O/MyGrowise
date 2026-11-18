import {isEbook} from './ebooks/book';
export function adminProductEditorPath(product:{id:string;type:string;slug:string}) {
  if (isEbook(product)) return `/admin/producten/${product.id}`;
  if (['module','guide'].includes(product.type)) return `/admin/modules/${product.id}`;
  if (['profile','questionnaire'].includes(product.type)) return `/admin/vragenlijsten/${product.id}`;
  return `/admin/producten/${product.id}`;
}
