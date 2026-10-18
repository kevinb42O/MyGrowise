import {useState} from 'react';
type Slot={startsAt:string;endsAt:string};
const dayOf=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export default function BookingSlots({slots,selected=''}:{slots:Slot[];selected?:string}){
 const initial=slots.find(s=>s.startsAt===selected)||slots[0];
 const [day,setDay]=useState(initial?dayOf(initial.startsAt):'');
 const [month,setMonth]=useState((initial?dayOf(initial.startsAt):dayOf(new Date().toISOString())).slice(0,7));
 const [choice,setChoice]=useState(slots.some(s=>s.startsAt===selected)?selected:'');
 const available=new Set(slots.map(s=>dayOf(s.startsAt)));
 const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1));
 const offset=(first.getUTCDay()+6)%7;
 const days=Array.from({length:42},(_,i)=>new Date(Date.UTC(year,m-1,i-offset+1)).toISOString().slice(0,10));
 const move=(step:number)=>setMonth(new Date(Date.UTC(year,m-1+step,1)).toISOString().slice(0,7));
 return <fieldset className="practice-card booking-slots"><legend>1. Kies een datum en tijd</legend>
 {!slots.length?<p>Er zijn momenteel geen vrije momenten voor dit afspraaktype. Neem contact op met de praktijk.</p>:<>
 <div className="booking-calendar-head"><button type="button" className="practice-button secondary" aria-label="Vorige maand" onClick={()=>move(-1)}>←</button><strong>{new Intl.DateTimeFormat('nl-BE',{month:'long',year:'numeric',timeZone:'UTC'}).format(first)}</strong><button type="button" className="practice-button secondary" aria-label="Volgende maand" onClick={()=>move(1)}>→</button></div>
 <div className="booking-days">{['ma','di','wo','do','vr','za','zo'].map(d=><span key={d}>{d}</span>)}{days.map(d=><button key={d} type="button" disabled={!available.has(d)} className={day===d?'selected':''} aria-pressed={day===d} aria-label={new Intl.DateTimeFormat('nl-BE',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`))} onClick={()=>{setDay(d);setChoice('');}}>{Number(d.slice(-2))}{available.has(d)&&<small>vrij</small>}</button>)}</div>
 <p className="practice-muted">Gekleurde dagen hebben vrije momenten. Alle uren zijn Belgische tijd.</p>
 <div className="booking-times" aria-label="Beschikbare uren">{slots.filter(s=>dayOf(s.startsAt)===day).map(s=><label key={s.startsAt}><input type="radio" name="starts_at" value={s.startsAt} required checked={choice===s.startsAt} onChange={()=>setChoice(s.startsAt)}/><span>{new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit'}).format(new Date(s.startsAt))}</span></label>)}</div>
 <p aria-live="polite">{choice?`Gekozen: ${new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',dateStyle:'full',timeStyle:'short'}).format(new Date(choice))}`:'Kies een tijdstip om verder te gaan.'}</p>
 </>}
 </fieldset>;
}
