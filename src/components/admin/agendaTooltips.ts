/** One viewport-level tooltip keeps labels outside the rail's scrolling container. */
export function setupAgendaTooltips(sidebar: HTMLElement, mobile: MediaQueryList) {
  const selector = '.admin-brand > a, .admin-nav a, .admin-sidebar__footer > a, .admin-user button, .agenda-navigation-tools summary, [data-notification-toggle]';
  const triggers = [...sidebar.querySelectorAll<HTMLElement>(selector)];
  const titles = new Map<HTMLElement, string>();
  const tooltip = document.createElement('div');
  tooltip.className = 'agenda-nav-tooltip';
  tooltip.id = 'agenda-nav-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let active: HTMLElement | null = null;
  let pending: HTMLElement | null = null;
  let timer: number | undefined;
  let closeTimer: number | undefined;
  const collapsed = () => !mobile.matches && !document.body.classList.contains('agenda-navigation-open');
  const hide = () => {
    window.clearTimeout(timer);
    window.clearTimeout(closeTimer);
    pending = null;
    tooltip.hidden = true;
    active = null;
  };
  const position = () => {
    if (!active) return;
    const rect = active.getBoundingClientRect();
    const rail = sidebar.getBoundingClientRect();
    const nav = active.closest('.admin-nav');
    if (nav) {
      const bounds = nav.getBoundingClientRect();
      if (rect.top < bounds.top || rect.bottom > bounds.bottom) { hide(); return; }
    }
    tooltip.style.left = `${Math.min(rail.right + 10, window.innerWidth - tooltip.offsetWidth - 8)}px`;
    tooltip.style.top = `${Math.max(8, Math.min(rect.top + (rect.height - tooltip.offsetHeight) / 2, window.innerHeight - tooltip.offsetHeight - 8))}px`;
  };
  const show = (trigger: HTMLElement, immediate = false) => {
    hide();
    if (!collapsed() || trigger.getAttribute('aria-expanded') === 'true' || trigger.closest('details[open]')) return;
    pending = trigger;
    const reveal = () => {
      if (pending !== trigger || !collapsed()) return;
      const label = trigger.getAttribute('aria-label') || titles.get(trigger);
      if (!label) return;
      active = trigger;
      tooltip.textContent = label;
      tooltip.hidden = false;
      position();
    };
    if (immediate) reveal();
    else timer = window.setTimeout(reveal, 180);
  };
  const sync = () => {
    hide();
    triggers.forEach(trigger => {
      if (collapsed()) trigger.removeAttribute('title');
      else if (titles.has(trigger)) trigger.title = titles.get(trigger)!;
    });
  };
  triggers.forEach(trigger => {
    if (trigger.title) titles.set(trigger, trigger.title);
    // aria-label already supplies the same accessible name; avoid announcing it twice.
    trigger.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(trigger); });
    trigger.addEventListener('pointerleave', () => {
      if (document.activeElement !== trigger) closeTimer = window.setTimeout(hide, 100);
    });
    trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) show(trigger, true); });
    trigger.addEventListener('blur', hide);
    trigger.addEventListener('pointerdown', hide);
    trigger.addEventListener('click', hide);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  window.addEventListener('blur', hide);
  // The tooltip remains hoverable, as required for hover-triggered supplementary content.
  tooltip.addEventListener('pointerleave', hide);
  tooltip.addEventListener('pointerenter', () => window.clearTimeout(closeTimer));
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  mobile.addEventListener('change', sync);
  sync();
}
