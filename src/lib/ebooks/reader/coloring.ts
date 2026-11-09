const palette = [
  ['Rood', '#e95663'], ['Oranje', '#f59a45'], ['Geel', '#f5d75d'], ['Groen', '#83c46c'],
  ['Blauw', '#69b8e8'], ['Paars', '#ad85d3'], ['Roze', '#ef9fbc'],
] as const;

type ColorRegion = { name: string; polygons: number[][] };
const regions: Partial<Record<number, ColorRegion[]>> = {
  6: [
    { name: 'Gedachte 1', polygons: [[686,355,727,355,727,397,686,397]] },
    { name: 'Gedachte 2', polygons: [[740,348,812,348,812,398,740,399]] },
    { name: 'Gedachte 3', polygons: [[826,375,856,375,856,399,826,399]] },
  ],
  13: [{ name: 'Mijn gevoel', polygons: [[1056,557,1181,557,1177,704,1056,704]] }],
  25: [
    { name: 'Bang / zenuwen', polygons: [[337,138,390,141,388,174,337,171], [393,113,400,113,400,124,393,124]] },
    { name: 'Rust / ontspanning', polygons: [[578,194,650,195,648,231,578,231], [512,223,522,223,522,233,512,233]] },
  ],
};

type Stroke = { kind: 'stroke'; color: string; size: number; erase: boolean; points: number[] };
type Fill = { kind: 'fill'; color: string; region: number };
type Action = Stroke | Fill;

function paths(region: ColorRegion) {
  return region.polygons.map(points => {
    const path = new Path2D();
    path.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) path.lineTo(points[i], points[i + 1]);
    path.closePath();
    return path;
  });
}

export function makeColoring(root: HTMLElement, onOpen: () => void) {
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const canvas = get<HTMLCanvasElement>('[data-color-canvas]');
  const ctx = canvas.getContext('2d')!;
  const launcher = get<HTMLButtonElement>('[data-color-open]');
  const panel = get('[data-color-panel]');
  const message = get('[data-color-message]');
  const eraser = get<HTMLButtonElement>('[data-color-eraser]');
  const swatches = get('[data-color-swatches]');
  const cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Cpath fill=\'%23ffd571\' stroke=\'%23472f24\' stroke-width=\'1.5\' d=\'M4 28l3-10L22 3q2-2 4 0l3 3q2 2 0 4L14 25Z\'/%3E%3Cpath stroke=\'%23472f24\' stroke-width=\'2\' d=\'m7 18 7 7M4 28l4-1M20 5l7 7\'/%3E%3C/svg%3E") 4 28, crosshair';
  canvas.style.cursor = cursor;
  let page = 1;
  let color: string = palette[0][1];
  const size = 10;
  let erase = false;
  let actions: Action[] = [];
  const unsaved = new Map<number, Action[]>();
  let active: { id: number; stroke: Stroke; moved: boolean } | null = null;
  let open = false;
  let frame = 0;
  let pageRegions: ColorRegion[] = [];
  let regionPaths: Path2D[][] = [];
  const key = () => 'mygrowise-fien-colors-v1-page-' + page;

  function read() {
    const memory = unsaved.get(page);
    if (memory) return memory;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key()) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((action): action is Action => {
        if (!action || typeof action !== 'object' || !/^#[0-9a-f]{6}$/i.test(action.color)) return false;
        if (action.kind === 'fill') return Number.isInteger(action.region) && !!pageRegions[action.region];
        if (action.kind !== 'stroke' || ![4,10,22,34].includes(action.size) || typeof action.erase !== 'boolean') return false;
        if (!Array.isArray(action.points) || action.points.length < 2 || action.points.length % 2) return false;
        return action.points.every((n: unknown, i: number) =>
          typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= (i % 2 ? 849 : 1200));
      });
    } catch { return []; }
  }

  function draw(action: Action) {
    ctx.save();
    ctx.globalAlpha = 1;
    if (action.kind === 'fill') {
      ctx.fillStyle = action.color;
      for (const path of regionPaths[action.region] || []) ctx.fill(path);
    } else {
      ctx.globalCompositeOperation = action.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = action.size;
      const points = action.points;
      ctx.beginPath();
      ctx.arc(points[0], points[1], action.size / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    cancelAnimationFrame(frame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(canvas.width / 1200, canvas.height / 849);
    for (const action of actions) draw(action);
    if (active) draw(active.stroke);
    ctx.restore();
  }

  function write(next: Action[]) {
    actions = next;
    try {
      localStorage.setItem(key(), JSON.stringify(actions));
      unsaved.delete(page);
      message.textContent = '';
    } catch {
      unsaved.set(page, actions);
      message.textContent = 'Oeps, houd je boek nog even open.';
    }
    render();
  }

  // Read the latest saved page for each edit, preserving edits made in another tab.
  function commit(action: Action) {
    write([...read(), action]);
  }

  function finish(interrupted = false) {
    if (!active) return;
    const finished = active;
    active = null;
    if (canvas.hasPointerCapture(finished.id)) canvas.releasePointerCapture(finished.id);
    const [x, y] = finished.stroke.points;
    const region = !interrupted && !finished.stroke.erase && !finished.moved ? regionPaths.findIndex(group => group.some(path => ctx.isPointInPath(path, x, y))) : -1;
    if (region >= 0) commit({ kind: 'fill', color: finished.stroke.color, region });
    else commit(finished.stroke);
  }

  function close(restoreFocus = false) {
    finish();
    open = false;
    root.dataset.coloring = 'no';
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    if (restoreFocus) launcher.focus();
  }

  function show() {
    onOpen();
    open = true;
    root.dataset.coloring = 'yes';
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    get<HTMLButtonElement>(erase ? '[data-color-eraser]' : '[data-color-swatches] button[aria-pressed="true"]').focus();
  }

  function updateTools() {
    for (const swatch of swatches.querySelectorAll<HTMLButtonElement>('button')) {
      swatch.setAttribute('aria-pressed', String(swatch.dataset.color === color && !erase));
    }
    eraser.setAttribute('aria-pressed', String(erase));
    canvas.style.cursor = erase ? 'crosshair' : cursor;
    root.style.setProperty('--pencil-color', color);
  }

  for (const [name, value] of palette) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.color = value;
    button.style.setProperty('--swatch', value);
    button.setAttribute('aria-label', name);
    button.title = name;
    button.addEventListener('click', () => { color = value; erase = false; updateTools(); });
    swatches.append(button);
  }
  swatches.append(eraser);
  updateTools();
  launcher.addEventListener('click', show);
  get('[data-color-close]').addEventListener('click', () => close(true));
  eraser.addEventListener('click', () => { erase = !erase; updateTools(); });
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
  });

  function point(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(1200, (event.clientX - bounds.left) / bounds.width * 1200)),
      Math.max(0, Math.min(849, (event.clientY - bounds.top) / bounds.height * 849))];
  }
  canvas.addEventListener('pointerdown', event => {
    event.stopPropagation();
    if (!open || event.button !== 0 || !event.isPrimary || active) return;
    event.preventDefault();
    active = { id: event.pointerId, moved: false, stroke: { kind: 'stroke', color, size: erase ? 34 : size, erase, points: point(event) } };
    canvas.setPointerCapture(event.pointerId);
    render();
  });
  canvas.addEventListener('pointermove', event => {
    if (active?.id !== event.pointerId) return;
    event.stopPropagation();
    const stroke = active.stroke;
    const [x, y] = point(event);
    const points = stroke.points;
    if (Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < 1.5) return;
    active.moved ||= Math.hypot(x - points[0], y - points[1]) > 5;
    points.push(x, y);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    canvas.addEventListener(name, event => {
      event.stopPropagation();
      if (active?.id !== event.pointerId) return;
      if (name === 'pointerup') {
        const [x, y] = point(event);
        const points = active.stroke.points;
        if (x !== points[points.length - 2] || y !== points[points.length - 1]) points.push(x, y);
        active.moved ||= Math.hypot(x - points[0], y - points[1]) > 5;
      }
      finish(name !== 'pointerup');
    });
  }
  function preserve() {
    finish(true);
    for (const [number, pending] of unsaved) {
      try {
        localStorage.setItem('mygrowise-fien-colors-v1-page-' + number, JSON.stringify(pending));
        unsaved.delete(number);
      } catch { /* Keep the drawing in memory for the next retry. */ }
    }
  }
  window.addEventListener('blur', () => finish(true));
  window.addEventListener('pagehide', preserve);
  document.addEventListener('visibilitychange', () => { if (document.hidden) preserve(); });
  window.addEventListener('beforeunload', event => {
    preserve();
    if (unsaved.size) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('storage', event => {
    if ((event.key === key() || event.key === null) && !active) { actions = read(); render(); }
  });

  return {
    close,
    setPage(number: number) {
      close();
      page = number;
      pageRegions = regions[page] || [];
      regionPaths = pageRegions.map(paths);
      actions = read();
      launcher.querySelector('span')!.textContent = page === 13 ? 'Teken je gevoel' : pageRegions.length ? 'Kleur de vakjes' : 'Kleuren';
      launcher.dataset.boxes = pageRegions.length ? 'yes' : 'no';
      render();
    },
    snapshot(image: HTMLImageElement) {
      if (actions.length === 0) return image;
      const copy = document.createElement('canvas');
      copy.width = image.naturalWidth;
      copy.height = image.naturalHeight;
      const context = copy.getContext('2d')!;
      context.drawImage(image, 0, 0);
      context.globalCompositeOperation = 'source-over';
      context.drawImage(canvas, 0, 0, copy.width, copy.height);
      return copy;
    },
  };
}
