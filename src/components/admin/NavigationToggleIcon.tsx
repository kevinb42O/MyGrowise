/** Shared by the server-rendered dashboard and the client-rendered agenda. */
export default function NavigationToggleIcon() {
  return <svg className="navigation-toggle-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g className="navigation-toggle-icon__desktop">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
      <path className="navigation-toggle-icon__arrow" d="m14 9 3 3-3 3" />
    </g>
    <path className="navigation-toggle-icon__mobile" d="M4 6h16M4 12h16M4 18h16" />
  </svg>;
}
