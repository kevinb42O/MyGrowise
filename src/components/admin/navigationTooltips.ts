/** A single, delegated tooltip outside the scroll container, shared by all rails. */
export function setupNavigationTooltips(sidebar: HTMLElement, mobile: MediaQueryList) {
  const selector = '.admin-brand > a, .admin-nav a, .admin-sidebar__footer > a, .admin-user button, .agenda-navigation-tools summary, [data-notification-toggle]';
  const root = document.documentElement;
  const tooltip = document.createElement('div');
  tooltip.className = 'admin-nav-tooltip';
  tooltip.id = 'admin-navigation-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  const context = document.createElement('span');
  context.className = 'admin-nav-tooltip__context';
  const label = document.createElement('strong');
  label.className = 'admin-nav-tooltip__label';
  const status = document.createElement('span');
  status.className = 'admin-nav-tooltip__status';
  // The label already names the trigger. Only supplementary context is described.
  const description = document.createElement('span');
  description.className = 'admin-nav-tooltip__description';
  description.id = 'admin-navigation-description';
  tooltip.append(context, label, status, description);
  document.body.append(tooltip);
  const titles = new Map<HTMLElement, string>();
  let active: HTMLElement | null = null;
  let pending: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  let hovered: HTMLElement | null = null;
  let dismissed: HTMLElement | null = null;
  let showTimer: number | undefined;
  let hideTimer: number | undefined;
  let warmUntil = 0;
  const collapsed = () => !mobile.matches && root.dataset.navigationState === 'collapsed';
  const triggerFor = (target: EventTarget | null) => {
    const trigger = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
    return trigger && sidebar.contains(trigger) ? trigger : null;
  };
  const removeDescription = () => {
    if (!active) return;
    const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== description.id);
    if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
    else active.removeAttribute('aria-describedby');
  };
  const hide = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    pending = null;
    if (!tooltip.hidden) warmUntil = performance.now() + 800;
    tooltip.hidden = true;
    removeDescription();
    active = null;
  };
  const eligible = (trigger: HTMLElement) => collapsed() && trigger !== dismissed && trigger.isConnected
    && trigger.getClientRects().length > 0 && trigger.getAttribute('aria-expanded') !== 'true'
    && !trigger.closest('details[open], [inert]') && !document.querySelector('dialog[open]');
  const position = (trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const navBounds = trigger.closest('.admin-nav')?.getBoundingClientRect();
    if (navBounds && (rect.top < navBounds.top || rect.bottom > navBounds.bottom)) return false;
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft || 0) + 8;
    const topEdge = (viewport?.offsetTop || 0) + 8;
    const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16;
    const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16;
    tooltip.style.maxWidth = `${Math.min(280, rightEdge - leftEdge)}px`;
    const rail = sidebar.getBoundingClientRect();
    const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const onRight = rail.right + 12 + width <= rightEdge;
    const left = onRight ? rail.right + 12 : Math.max(leftEdge, rect.left - width - 12);
    const top = Math.max(topEdge, Math.min(rect.top + (rect.height - height) / 2, bottomEdge - height));
    tooltip.dataset.side = onRight ? 'right' : 'left';
    tooltip.style.left = `${Math.max(leftEdge, Math.min(left, rightEdge - width))}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.setProperty('--tooltip-arrow-y', `${Math.max(12, Math.min(rect.top + rect.height / 2 - top, height - 12))}px`);
    return true;
  };
  const show = (trigger: HTMLElement, immediate = false) => {
    window.clearTimeout(hideTimer);
    if (active === trigger && !tooltip.hidden) return;
    window.clearTimeout(showTimer);
    pending = trigger;
    if (!eligible(trigger)) { hide(); return; }
    const reveal = () => {
      if (pending !== trigger || !eligible(trigger)) return;
      const name = trigger.getAttribute('aria-label') || titles.get(trigger) || trigger.textContent?.trim();
      if (!name) return;
      removeDescription();
      active = trigger;
      const group = trigger.closest('.admin-nav__group')?.querySelector('h2')?.textContent?.trim() || '';
      const attention = Boolean(trigger.querySelector('.admin-attention-dot:not([hidden])'));
      const states = [trigger.getAttribute('aria-current') === 'page' ? 'Huidige pagina' : '', attention ? 'Aandacht nodig' : ''].filter(Boolean);
      context.textContent = group;
      context.hidden = !group;
      label.textContent = name;
      status.textContent = states.join(' · ');
      status.hidden = !states.length;
      status.dataset.attention = String(attention);
      description.textContent = [group, ...states].filter(Boolean).join('. ');
      if (description.textContent) {
        const ids = new Set((trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        ids.add(description.id);
        trigger.setAttribute('aria-describedby', [...ids].join(' '));
      }
      const wasHidden = tooltip.hidden;
      tooltip.hidden = false;
      if (!position(trigger)) { hide(); return; }
      // Switching between nearby icons stays instant; only the first reveal fades.
      tooltip.dataset.entering = String(wasHidden);
    };
    if (immediate) reveal();
    else showTimer = window.setTimeout(reveal, performance.now() < warmUntil || active ? 70 : 300);
  };
  const scheduleHide = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    pending = null;
    hideTimer = window.setTimeout(() => {
      if (focused && focused !== dismissed) show(focused, true);
      else hide();
    }, 140);
  };
  const syncTitles = () => {
    sidebar.querySelectorAll<HTMLElement>(selector).forEach(trigger => {
      if (trigger.hasAttribute('title')) titles.set(trigger, trigger.title);
      if (collapsed()) trigger.removeAttribute('title');
      else if (titles.has(trigger)) trigger.title = titles.get(trigger)!;
    });
  };
  sidebar.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const trigger = triggerFor(event.target);
    if (!trigger || trigger === triggerFor(event.relatedTarget)) return;
    hovered = trigger;
    dismissed = null;
    show(trigger);
  });
  sidebar.addEventListener('pointerout', event => {
    const trigger = triggerFor(event.target);
    if (!trigger || trigger === triggerFor(event.relatedTarget)) return;
    hovered = null;
    if (dismissed === trigger) dismissed = null;
    scheduleHide();
  });
  sidebar.addEventListener('focusin', event => {
    focused = triggerFor(event.target);
    if (focused?.matches(':focus-visible')) { dismissed = null; show(focused, true); }
  });
  sidebar.addEventListener('focusout', () => { focused = null; if (!hovered) scheduleHide(); });
  tooltip.addEventListener('pointerenter', () => window.clearTimeout(hideTimer));
  tooltip.addEventListener('pointerleave', scheduleHide);
  document.addEventListener('pointerdown', hide);
  document.addEventListener('click', hide);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || (!active && !pending)) return;
    const wasVisible = !tooltip.hidden;
    dismissed = active || pending;
    hide();
    // Dismiss the tooltip first, leaving an underlying menu or dialog alone.
    if (wasVisible) event.preventDefault();
  }, true);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  window.visualViewport?.addEventListener('resize', hide);
  window.visualViewport?.addEventListener('scroll', hide);
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', hide);
  new MutationObserver(() => { hide(); syncTitles(); }).observe(root, { attributes: true, attributeFilter: ['data-navigation-state'] });
  // Event delegation also handles notification controls mounted after hydration.
  new MutationObserver(syncTitles).observe(sidebar, { childList: true, subtree: true });
  syncTitles();
}
