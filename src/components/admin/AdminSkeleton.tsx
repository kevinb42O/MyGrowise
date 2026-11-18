/** CSS-only loading primitives, shared by Astro fallbacks and React islands. */
function LoadingMark() {
  return <span className="admin-loading-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export function AdminLoadingStatus({ label = 'Gegevens laden' }: { label?: string }) {
  return <span className="admin-loading-status" role="status"><LoadingMark /><span>{label}</span></span>;
}

type Props = {
  variant?: 'metric' | 'chart' | 'rows' | 'calendar';
  rows?: number;
  toolbar?: boolean;
  days?: 1 | 5 | 7;
  appearance?: 'people' | 'plain' | 'rank';
};

export default function AdminSkeleton({ variant = 'rows', rows = 3, toolbar = false, days = 7, appearance = 'people' }: Props) {
  return <div className={`admin-skeleton admin-skeleton--${variant} admin-skeleton--${appearance} admin-skeleton--days-${days}${toolbar ? ' admin-skeleton--workspace' : ''}`} aria-hidden="true">
    {variant === 'metric' && <><span className="admin-skeleton__value" /><span className="admin-skeleton__line admin-skeleton__line--long" /></>}
    {variant === 'rows' && Array.from({ length: rows }, (_, index) => <div className="admin-skeleton__row" key={index}>
      {appearance !== 'plain' && <span className="admin-skeleton__avatar" />}
      <div className="admin-skeleton__copy"><span className="admin-skeleton__line" /><span className="admin-skeleton__line admin-skeleton__line--long" /></div><span className="admin-skeleton__badge" />
    </div>)}
    {variant === 'chart' && <><div className="admin-skeleton__chart-heading"><span className="admin-skeleton__value" /><span className="admin-skeleton__line" /></div><div className="admin-skeleton__plot">{[0, 1, 2, 3].map(index => <div key={index}><span className="admin-skeleton__tick" /><i /></div>)}</div><div className="admin-skeleton__axis">{[0, 1, 2].map(index => <span className="admin-skeleton__line" key={index} />)}</div></>}
    {variant === 'calendar' && <>
      {toolbar && <><div className="admin-skeleton__toolbar"><span className="admin-skeleton__control" /><span className="admin-skeleton__line" /><span className="admin-skeleton__control" /></div><div className="admin-skeleton__filters"><span className="admin-skeleton__control" /><span className="admin-skeleton__control" /></div></>}
      <div className="admin-skeleton__week">{Array.from({ length: days }, (_, index) => <span key={index}><i className="admin-skeleton__line" /></span>)}</div>
      <div className="admin-skeleton__calendar-grid">{Array.from({ length: 9 }, (_, index) => <div className="admin-skeleton__calendar-row" key={index}><span className="admin-skeleton__tick" />{Array.from({ length: days }, (_, day) => <i key={day} />)}</div>)}</div>
      <div className="admin-skeleton__calendar-caption"><LoadingMark /><span>Agenda laden</span></div>
    </>}
  </div>;
}
