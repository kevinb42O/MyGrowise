/** Status notifications retain the appointment time that applied at that event. */
export const bookingNotificationStartsAt = (current:string,notifiedAt:string,changes:{oldStartsAt:string;occurredAt:string}[]) => {
  const next=changes.filter(change=>Date.parse(change.occurredAt)>=Date.parse(notifiedAt))
    .sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt))[0];
  return next?.oldStartsAt||current;
};
