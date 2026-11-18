// Clinical text stays in the open form; never persist it in browser storage.
document.querySelectorAll<HTMLFormElement>('form[data-note-form]').forEach(form => {
  const status = form.querySelector<HTMLElement>('[data-note-status]');
  let saving = false;
  form.addEventListener('input', () => {
    if (status && !saving) status.textContent = 'Niet opgeslagen. Bewaar je wijzigingen als concept.';
  });
  form.addEventListener('submit', async event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (saving) return;
    const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button?.value === 'final' && !window.confirm('Dit verslag definitief opslaan? Daarna kun je de tekst alleen met een afzonderlijke aanvulling corrigeren.')) return;
    const body = new FormData(form);
    if (button?.name) body.set(button.name, button.value);
    saving = true;
    form.dispatchEvent(new Event('note-saving'));
    const controls = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input, textarea, select, button')].filter(item=>!item.disabled);
    controls.forEach(item => item.disabled = true);
    form.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Verslag opslaan…';
    try {
      const response = await fetch(form.action, {method: 'POST', body, headers: {Accept: 'application/json'}, credentials: 'same-origin', redirect: 'error'});
      const result = await response.json();
      if (!response.ok || !result.location) throw new Error(result.error || 'Opslaan is niet bevestigd. Je tekst blijft hier staan. Controleer je verbinding en of je nog bent aangemeld.');
      form.dispatchEvent(new Event('form-saved'));
      window.location.assign(result.location);
    } catch (cause) {
      if (status) {
        status.textContent = cause instanceof Error && !['TypeError','SyntaxError'].includes(cause.name) ? cause.message : 'Geen bevestiging ontvangen. Je tekst blijft hier staan. Controleer in een tweede tabblad of het verslag is opgeslagen voordat je opnieuw probeert.';
        status.setAttribute('role', 'alert');
      }
      saving = false;
      controls.forEach(item => item.disabled = false);
      form.removeAttribute('aria-busy');
      form.dispatchEvent(new Event('note-save-failed'));
    }
  });
});
