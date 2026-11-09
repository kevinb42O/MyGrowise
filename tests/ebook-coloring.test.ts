import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeColoring } from '../src/lib/ebooks/reader/coloring.ts';

// Drive the actual drawing event handlers; only browser/canvas primitives are faked.
class Element {
  dataset: Record<string, string> = {};
  style = { setProperty() {}, cursor: '' };
  attributes = new Map<string, string>();
  listeners = new Map<string, Function[]>();
  children: Element[] = [];
  hidden = false;
  disabled = false;
  textContent = '';
  width = 1600;
  height = 1132;
  captured = new Set<number>();
  addEventListener(name: string, handler: Function) { this.listeners.set(name, [...(this.listeners.get(name) || []), handler]); }
  emit(name: string, props: Record<string, unknown> = {}) {
    const event = { pointerId: 1, button: 0, isPrimary: true, clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {}, ...props };
    for (const handler of this.listeners.get(name) || []) handler(event);
    return event;
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  focus() {}
  append(child: Element) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  querySelectorAll() { return this.children; }
  querySelector() { return this.children[0] || new Element(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 849 }; }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); this.emit('lostpointercapture', {pointerId: id}); }
}
function setup() {
  const elements = new Map<string, Element>();
  const element = (name: string) => {
    if (!elements.has(name)) elements.set(name, new Element());
    return elements.get(name)!;
  };
  const root = new Element();
  root.querySelector = ((selector: string) => element(selector)) as any;
  const window = new Element();
  const document = Object.assign(new Element(), { createElement: () => new Element() });
  const saved = new Map<string, string>();
  let blocked = false;
  Object.assign(globalThis, {
    window, document,
    localStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { if (blocked) throw Error('quota'); saved.set(key, value); },
    },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  const coloring = makeColoring(root as any, () => {});
  coloring.setPage(1);
  const canvas = element('[data-color-canvas]');
  const click = (name: string) => element(`[data-color-${name}]`).emit('click');
  const read = (page = 1) => JSON.parse(saved.get(`mygrowise-fien-colors-v1-page-${page}`) || '[]');
  const draw = (end = 'pointerup') => {
    click('open');
    canvas.emit('pointerdown');
    canvas.emit('pointermove', {clientX: 70, clientY: 80});
    canvas.emit(end, {clientX: 90, clientY: 95});
  };
  return { coloring, canvas, click, read, draw, saved, element, window, block: (value: boolean) => { blocked = value; } };
}

test('interrupted strokes survive cancel, capture loss and window blur', () => {
  for (const ending of ['pointercancel', 'lostpointercapture', 'blur']) {
    const app = setup();
    if (ending === 'blur') {
      app.click('open'); app.canvas.emit('pointerdown'); app.canvas.emit('pointermove', {clientX: 100}); app.window.emit('blur');
    } else app.draw(ending);
    assert.equal(app.read().length, 1, ending);
    app.draw();
    assert.equal(app.read().length, 2, 'next stroke still works');
  }
});

test('page changes and reopening retain exactly the expected drawing', () => {
  const app = setup();
  app.draw(); app.draw();
  app.coloring.setPage(2); app.draw();
  assert.equal(app.read(2).length, 1);
  app.coloring.setPage(1);
  app.draw(); assert.equal(app.read().length, 3);
  assert.equal(app.read(2).length, 1);
  app.coloring.setPage(2);
  app.coloring.setPage(1);
  app.draw(); assert.equal(app.read().length, 4);
});

test('stored drawings above the former action and point limits stay editable', () => {
  const app = setup();
  const stroke = {kind:'stroke', color:'#e95663', size:10, erase:false, points:Array.from({length:200}, (_, i) => i)};
  app.saved.set('mygrowise-fien-colors-v1-page-1', JSON.stringify(Array.from({length:401}, () => stroke)));
  app.coloring.setPage(1); app.draw();
  assert.equal(app.read().length, 402);
  app.coloring.setPage(2); app.coloring.setPage(1); app.draw();
  assert.equal(app.read().length, 403);
});

test('a long stroke continues beyond the former point cap and records its release position', () => {
  const app = setup();
  app.click('open'); app.canvas.emit('pointerdown');
  for (let i = 0; i < 5100; i++) app.canvas.emit('pointermove', {clientX: i % 2 ? 30 : 60});
  app.canvas.emit('pointerup', {clientX:100, clientY:200});
  assert.ok(app.read()[0].points.length > 10000);
  assert.deepEqual(app.read()[0].points.slice(-2), [100, 200]);
});

test('storage failure retains drawings across pages and retries before leaving', () => {
  const app = setup(); app.block(true); app.draw();
  assert.equal(app.read().length, 0);
  app.coloring.setPage(2); app.draw(); app.coloring.setPage(1);
  app.draw();
  const leaving = app.window.emit('beforeunload');
  assert.equal((leaving as any).returnValue, '');
  app.block(false); app.window.emit('pagehide');
  assert.equal(app.read(1).length, 2);
  assert.equal(app.read(2).length, 1);
});

test('compact palette has seven pencils and a gom with a fixed drawing width', () => {
  const app = setup();
  const pencils = app.element('[data-color-swatches]').children.filter(button => button.dataset.color);
  assert.equal(pencils.length, 7);
  assert.equal(pencils.some(button => button.dataset.color === '#99664b'), false);
  app.draw();
  assert.equal(app.read()[0].size, 10);
  app.click('eraser'); app.draw();
  assert.equal(app.read()[1].erase, true);
  pencils[1].emit('click'); app.draw();
  assert.equal(app.read()[2].erase, false);
  assert.equal(app.read()[2].size, 10);
});
