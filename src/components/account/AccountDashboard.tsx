import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type PrimaryAction = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  status?: string;
  meta?: string;
  kind: 'appointment' | 'library' | 'welcome';
};

type SecondaryAction = {
  label: string;
  title: string;
  description: string;
  href: string;
};

type Summary = {
  label: string;
  value: string;
  detail: string;
  href: string;
  icon: 'library' | 'care' | 'receipt';
  tone: 'rose' | 'sun' | 'mint';
};

type Activity = {
  label: string;
  title: string;
  detail: string;
  time: string;
  tone: 'rose' | 'sun' | 'mint';
};

export type AccountDashboardProps = {
  firstName: string;
  dayLabel: string;
  primary: PrimaryAction;
  secondary?: SecondaryAction;
  summaries: Summary[];
  activity: Activity[];
  hasActivity: boolean;
};

const ease = [0.16, 1, 0.3, 1] as const;

function Icon({ name, size = 20 }: { name: Summary['icon'] | 'arrow' | 'spark'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'library') return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5a2.5 2.5 0 0 0-2.5-2.5H4Z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/></svg>;
  if (name === 'care') return <svg {...common}><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
  if (name === 'receipt') return <svg {...common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/></svg>;
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.45 5.55L19 10l-5.55 1.45L12 17l-1.45-5.55L5 10l5.55-1.45Z"/></svg>;
  return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6"/></svg>;
}

export default function AccountDashboard({ firstName, dayLabel, primary, secondary, summaries, activity, hasActivity }: AccountDashboardProps) {
  const reducedMotion = useReducedMotion();
  const item = (delay: number) => reducedMotion ? {} : ({ initial: { opacity: 0, y: 20, filter: 'blur(6px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: 0.65, delay, ease } });

  return <div className="account-dashboard">
    <motion.header className="account-dashboard__intro" {...item(0.04)}>
      <div>
        <span className="account-kicker"><i></i>Mijn ruimte</span>
        <h1>Welkom terug, {firstName}.</h1>
        <p>Hier staat klaar wat nu relevant is — op jouw tempo.</p>
      </div>
      <span className="account-date">{dayLabel}</span>
    </motion.header>

    <motion.section className={`account-focus account-focus--${primary.kind}`} aria-labelledby="account-focus-title" {...item(0.12)}>
      <div className="account-focus__copy">
        <span className="account-kicker account-kicker--light"><i></i>{primary.eyebrow}</span>
        <AnimatePresence mode="wait">
          <motion.div key={`${primary.kind}-${primary.title}`} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.35, ease }}>
            <h2 id="account-focus-title">{primary.title}</h2>
            <p>{primary.description}</p>
            <div className="account-focus__meta">
              {primary.status && <span className="account-status">{primary.status}</span>}
              {primary.meta && <span>{primary.meta}</span>}
            </div>
            <motion.a className="account-button account-button--light" href={primary.href} whileHover={reducedMotion ? undefined : { y: -3 }} whileTap={{ scale: 0.98 }}>
              {primary.label}<Icon name="arrow" size={17}/>
            </motion.a>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="account-focus__art" aria-hidden="true">
        <motion.div className="account-brand-emblem" animate={reducedMotion ? undefined : { y: [0, -8, 0], rotate: [-1.5, 1.5, -1.5] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="account-brand-emblem__glow" />
          <img src="/images/logo-lelie.webp" alt="" width="382" height="289" />
        </motion.div>
      </div>
    </motion.section>

    {secondary && <motion.a className="account-secondary-route" href={secondary.href} {...item(0.18)} whileHover={reducedMotion ? undefined : { y: -3 }}>
      <span className="account-secondary-route__marker"><Icon name="spark" size={17}/></span>
      <span><small>{secondary.label}</small><strong>{secondary.title}</strong><em>{secondary.description}</em></span>
      <Icon name="arrow" size={19}/>
    </motion.a>}

    <motion.section className="account-overview" aria-labelledby="account-overview-title" {...item(0.22)}>
      <div className="account-section-heading"><div><span className="account-kicker"><i></i>In één oogopslag</span><h2 id="account-overview-title">Jouw overzicht</h2></div></div>
      <div className="account-summary-grid">
        {summaries.map((summary, index) => <motion.a className={`account-summary account-summary--${summary.tone}`} href={summary.href} key={summary.label} whileHover={reducedMotion ? undefined : { y: -6 }} transition={{ duration: 0.25, ease }}>
          <span className="account-summary__icon"><Icon name={summary.icon}/></span>
          <span className="account-summary__top"><small>{summary.label}</small></span>
          <span className="account-summary__arrow" aria-hidden="true"><Icon name="arrow" size={22}/></span>
          <strong>{summary.value}</strong><em>{summary.detail}</em>
        </motion.a>)}
      </div>
    </motion.section>

    <motion.section className="account-activity" aria-labelledby="account-activity-title" {...item(0.3)}>
      <div className="account-section-heading"><div><span className="account-kicker"><i></i>{hasActivity ? 'Praktische accountactiviteit' : 'Een rustig begin'}</span><h2 id="account-activity-title">{hasActivity ? 'Wat er recent gebeurde' : 'Kies wat nu bij je past'}</h2></div>{hasActivity && <a href="/account/begeleiding">Alles bekijken <Icon name="arrow" size={16}/></a>}</div>
      {hasActivity ? <div className="account-timeline">{activity.map((event, index) => <motion.article key={`${event.title}-${index}`} className="account-timeline__item" initial={reducedMotion ? false : { opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.45 }} transition={{ duration: 0.45, delay: index * 0.08, ease }}><span className={`account-timeline__dot account-timeline__dot--${event.tone}`}></span><div><small>{event.label}</small><strong>{event.title}</strong><p>{event.detail}</p></div><time>{event.time}</time></motion.article>)}</div> : <div className="account-start-card"><div><span className="account-start-card__icon"><Icon name="spark" size={20}/></span><h3>Je hoeft niet alles tegelijk te weten.</h3><p>Je kan rustig starten met meer inzicht, of meteen kijken welke begeleiding bij je past.</p></div><div><a className="account-button account-button--dark" href="/profielen">Eerst meer inzicht <Icon name="arrow" size={17}/></a><a className="account-text-action" href="/begeleiding">Met iemand spreken <Icon name="arrow" size={16}/></a></div></div>}
    </motion.section>
  </div>;
}
