import { useEffect, useRef, type ReactNode } from 'react';

export default function AgendaDialog({ title, onDismiss, busy, dirty, children }: {
  title: string; onDismiss: () => void; busy: boolean; dirty: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const dismiss = () => {
    if (busy || (dirty && !window.confirm('Je wijzigingen zijn nog niet opgeslagen. Wil je ze verwerpen?'))) return;
    onDismiss();
  };

  return <dialog ref={ref} className="unified-agenda__editor unified-agenda-dialog" aria-labelledby="unified-agenda-dialog-title"
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <div className="unified-agenda-dialog__content">
      <header><h2 id="unified-agenda-dialog-title">{title}</h2><button type="button" onClick={dismiss} disabled={busy} aria-label="Sluiten">×</button></header>
      {children}
    </div>
  </dialog>;
}
