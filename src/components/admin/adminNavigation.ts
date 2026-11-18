import { setupNavigationTooltips } from './navigationTooltips';

/** One controller for the admin shell and both agenda workspaces. */
export function setupAdminNavigation() {
  const body = document.body;
  if (!body?.classList.contains('navigation-shell')) return;
  const root = document.documentElement;
  const sidebar = body.querySelector<HTMLElement>('.admin-sidebar');
  const workspace = body.querySelector<HTMLElement>('.admin-workspace');
  if (!sidebar || !workspace) return;
  const mobile = window.matchMedia('(max-width: 820px)');
  const persistent = body.dataset.navigationScope === 'admin';
  const storageKey = 'mygrowise.admin.navigation';
  const toggleSelector = '[data-sidebar-open], [data-agenda-navigation]';
  let desktopExpanded = root.dataset.navigationState !== 'collapsed';
  let mobileOpen = false;
  let returnFocus: HTMLElement | null = null;
  const expanded = () => mobile.matches ? mobileOpen : desktopExpanded;
  const syncToggles = () => {
    body.querySelectorAll<HTMLButtonElement>(toggleSelector).forEach(button => {
      button.setAttribute('aria-expanded', String(expanded()));
      const label = mobile.matches
        ? (mobileOpen ? 'Menu sluiten' : 'Menu openen')
        : (desktopExpanded ? 'Menu inklappen' : 'Menu uitklappen');
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  };
  const focusable = () => [...sidebar.querySelectorAll<HTMLElement>('a[href], button, summary, input, select, [tabindex="0"]')]
    .filter(element => element.getClientRects().length && !element.matches(':disabled, [inert], [inert] *'));
  const render = () => {
    root.dataset.navigationState = expanded() ? 'expanded' : 'collapsed';
    body.classList.toggle('admin-menu-open', mobile.matches && mobileOpen);
    body.classList.toggle('agenda-navigation-open', expanded());
    workspace.inert = mobile.matches && mobileOpen;
    sidebar.inert = mobile.matches && !mobileOpen;
    syncToggles();
    // FullCalendar measures its container when this event fires.
    window.dispatchEvent(new Event('resize'));
  };
  const setExpanded = (open: boolean, restoreFocus = false) => {
    if (mobile.matches) mobileOpen = open;
    else {
      desktopExpanded = open;
      if (persistent) {
        try { localStorage.setItem(storageKey, open ? 'expanded' : 'collapsed'); } catch {}
      }
    }
    render();
    if (open && mobile.matches) focusable()[0]?.focus();
    if (!open && restoreFocus) {
      const toggle = body.querySelector<HTMLElement>(toggleSelector);
      (returnFocus?.isConnected ? returnFocus : toggle)?.focus();
    }
  };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest<HTMLElement>(toggleSelector);
    if (toggle) { returnFocus = toggle; setExpanded(!expanded()); }
    if (target?.closest('[data-sidebar-close]')) setExpanded(false, true);
    document.querySelectorAll<HTMLDetailsElement>('.agenda-navigation-tools details[open], details[name="agenda-tools"][open]').forEach(menu => {
      if (target && !menu.contains(target)) menu.open = false;
    });
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('dialog[open]'))) return;
    if (event.key === 'Escape') {
      const menu = document.querySelector<HTMLDetailsElement>('.agenda-navigation-tools details[open], details[name="agenda-tools"][open]');
      if (menu) { event.preventDefault(); menu.open = false; menu.querySelector('summary')?.focus(); return; }
      if (mobile.matches && mobileOpen) { event.preventDefault(); setExpanded(false, true); }
    }
    if (event.key === 'Tab' && mobile.matches && mobileOpen) {
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  mobile.addEventListener('change', () => {
    const focusWasInSidebar = sidebar.contains(document.activeElement);
    mobileOpen = false;
    render();
    if (mobile.matches && focusWasInSidebar) body.querySelector<HTMLElement>(toggleSelector)?.focus();
  });
  window.addEventListener('storage', event => {
    if (!persistent || event.key !== storageKey) return;
    desktopExpanded = event.newValue === 'expanded' || (event.newValue !== 'collapsed' && !body.classList.contains('agenda-workspace'));
    render();
  });
  // The agenda toolbar is mounted by a client-only React island.
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node instanceof Element
      && (node.matches(toggleSelector) || node.querySelector(toggleSelector))))) syncToggles();
  }).observe(workspace, { childList: true, subtree: true });
  render();
  setupNavigationTooltips(sidebar, mobile);
}
