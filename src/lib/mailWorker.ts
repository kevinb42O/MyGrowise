import {deliverBookingMail} from './bookingMail';
import {deliverCommerceMail} from './catalog/mail';
import {deliverWebsiteMail} from './commerce/websiteMail';
import {deliverSupportMail} from './supportMail';

/** Actions try immediately. Hobby's daily cron and explicit staff retries are fallbacks.
 * Small parallel batches bound runtime when the mail provider is unavailable.
 * A failed queue must not prevent the other queues from being processed.
 */
export async function deliverQueuedMail() {
  const entries = Object.entries({support:deliverSupportMail, commerce:deliverCommerceMail, booking:deliverBookingMail, website:deliverWebsiteMail});
  const results = await Promise.allSettled(entries.map(([,deliver]) => deliver(2)));
  return Object.fromEntries(results.map((result,index) => [entries[index][0],result.status === 'fulfilled' ? result.value : {unavailable:true}]));
}
