export const moments = {
  5: { kind: 'star', x: .805, y: .474, size: '7%', label: 'Laat de ster oplichten', text: 'Volg het licht, het avontuur begint!' },
  10: { kind: 'chest', x: .518, y: .652, size: '10%', label: 'Tik op het slot', text: 'Welke superkracht zou jij in de kist stoppen?' },
  21: { kind: 'heart', x: .462, y: .524, size: '22%', label: 'Houd het hart vast', text: 'Adem rustig in…' },
  23: { kind: 'bell', x: .973, y: .644, size: '9%', label: 'Laat de schoolbel rinkelen', text: 'Riiing! De bel gaat!' },
  25: { kind: 'balloon', x: .508, y: .093, size: '7%', label: 'Sleep de ballon', text: 'Laat los en kijk hoe je ballon wegzweeft.' },
} as const;
export type Moment = typeof moments[keyof typeof moments];

export const chestDuration = 2.65;
export const heartCycle = 4.8;
export const balloonDuration = 2.15;
export const bellDuration = 3.68;

const unit = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - (1 - unit(value)) ** 3;
const seam = new Path2D('M-235 -109 C-153 -86 -77 -82 -7 -67 S161 -47 241 -36');
const keyhole = new Path2D('M-3 -20 C-14 -20 -18 -7 -9 0 L-17 33 L10 35 L3 2 C14 -6 9 -20 -3 -20Z');
const heart = new Path2D('M0 -72 C-65 -151 -148 -114 -139 -33 C-137 25 -58 83 0 129 C56 83 137 25 140 -33 C148 -112 65 -151 0 -72Z');
const balloon = new Path2D('M0 37 C-20 34 -34 17 -30 -10 C-27 -28 -16 -39 -1 -38 C17 -38 27 -26 29 -7 C34 15 22 34 0 37Z');

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius);
  fill.addColorStop(0, color);
  fill.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function glint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * .13, y - size * .1, x + size * .76, y);
  ctx.quadraticCurveTo(x + size * .13, y + size * .1, x, y + size);
  ctx.quadraticCurveTo(x - size * .13, y + size * .1, x - size * .76, y);
  ctx.quadraticCurveTo(x - size * .13, y - size * .1, x, y - size);
  ctx.fill();
}

const powers = [
  { x: -184, y: -224, color: '#ffc762' },
  { x: -95, y: -287, color: '#dfa8ff' },
  { x: 3, y: -327, color: '#b6ffbd' },
  { x: 104, y: -277, color: '#9de7ff' },
  { x: 199, y: -200, color: '#ffc39b' },
];

function paintChest(ctx: CanvasRenderingContext2D, elapsed: number, calm: boolean) {
  const click = unit(elapsed / .065 + .32) * unit((.68 - elapsed) / .44);
  glow(ctx, 0, 5, 69, '#ffe182', click * .88);
  ctx.globalAlpha = click;
  ctx.fillStyle = '#fff0a0';
  ctx.fill(keyhole);

  const opening = easeOut((elapsed - .095) / .25);
  const fade = opening * unit((2.51 - elapsed) / .76);
  ctx.lineCap = 'round';
  ctx.shadowColor = '#ffb34a';
  ctx.shadowBlur = 17;
  ctx.strokeStyle = '#ffb759';
  ctx.lineWidth = 4 + 13 * opening;
  ctx.globalAlpha = fade * .75;
  ctx.stroke(seam);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff4c4';
  ctx.lineWidth = 2.6 + 2 * opening;
  ctx.globalAlpha = fade;
  ctx.stroke(seam);

  for (const [index, power] of powers.entries()) {
    const age = elapsed - (.20 + index * .13);
    if (age < 0) continue;
    const progress = easeOut(age / .84);
    const alpha = unit(age / .10) * unit((2.48 - elapsed) / .66);
    const fromX = power.x * .68, fromY = -66 + fromX * .14;
    const x = calm ? fromX : fromX + (power.x - fromX) * progress;
    const y = calm ? fromY - 8 : fromY + (power.y - fromY) * progress + 5 * Math.sin(age * 4);
    if (!calm) {
      for (let i = 1; i < 8; i++) {
        const trail = easeOut((age - i * .028) / .84);
        const trailX = fromX + (power.x - fromX) * trail + Math.sin(i * 2.4 + index) * i * 2;
        const trailY = fromY + (power.y - fromY) * trail + i * 2;
        ctx.globalAlpha = alpha * (1 - i / 9) * .71;
        ctx.fillStyle = power.color;
        glint(ctx, trailX, trailY, 4 + i % 3);
      }
    }
    glow(ctx, x, y, 46, power.color, alpha * .74);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff9e5';
    glint(ctx, x, y, calm ? 8 : 11 + progress * 7);
  }
}

function paintHeart(ctx: CanvasRenderingContext2D, elapsed: number, calm: boolean) {
  const phase = (elapsed % heartCycle) / heartCycle;
  const breath = .5 - .5 * Math.cos(phase * Math.PI * 2);
  const reveal = unit(.24 + elapsed / .24);
  glow(ctx, 0, -8, 172 + (calm ? 0 : 58 * breath), '#d2ffc3', reveal * (.23 + .35 * breath));
  ctx.scale(1 + (calm ? 0 : breath * .115), 1 + (calm ? 0 : breath * .115));
  ctx.globalAlpha = reveal * (.45 + breath * .54);
  ctx.strokeStyle = '#f2ffd6';
  ctx.shadowColor = '#b3ff90';
  ctx.shadowBlur = 15;
  ctx.lineWidth = 3.5 + breath * 2;
  ctx.stroke(heart);
  ctx.shadowBlur = 0;
  if (calm) return;
  for (let i = 0; i < 14; i++) {
    const angle = i * Math.PI * 2 / 14 + .1;
    const distance = 150 + breath * 35 + (i * 17 % 29);
    ctx.globalAlpha = reveal * (.19 + breath * .54) * (.8 + .2 * Math.sin(elapsed * 3 + i));
    ctx.fillStyle = i % 3 ? '#e7ffd0' : '#fff0ba';
    glint(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance * .79, 3.5 + i % 4);
  }
}

function paintBalloon(ctx: CanvasRenderingContext2D, elapsed: number, free: number | null, x: number, y: number, vx: number, calm: boolean) {
  const fade = free === null ? 1 : unit((balloonDuration - free) / .72);
  const wake = calm ? 0 : Math.sin(elapsed * 5);
  if (!calm && free !== null) {
    for (let i = 1; i <= 13; i++) {
      const spread = i * 6;
      ctx.globalAlpha = fade * (1 - i / 15) * unit(free * 5);
      ctx.fillStyle = i % 2 ? '#ffe8b8' : '#ffd3a4';
      glint(ctx, x + Math.sin(i * 2.4 + elapsed * 3) * spread * .39 - vx * i * .018,
        y + 26 + spread, 3 + i % 4);
    }
  }
  ctx.translate(x, y);
  ctx.rotate(calm ? 0 : Math.max(-.22, Math.min(.22, vx * .0007)) + wake * .05);
  glow(ctx, 0, 0, 75, '#ffd689', fade * .65);
  ctx.globalAlpha = fade;
  ctx.strokeStyle = '#fff1ca';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 39);
  ctx.bezierCurveTo(-15 - wake * 9, 56, 21 + wake * 15, 67, 5 + wake * 14, 89);
  ctx.stroke();
  const silk = ctx.createRadialGradient(-10, -14, 4, 0, 4, 43);
  silk.addColorStop(0, '#fff4c1');
  silk.addColorStop(.42, '#ffd58b');
  silk.addColorStop(.82, '#ffac59');
  silk.addColorStop(1, '#eb763c');
  ctx.fillStyle = silk;
  ctx.fill(balloon);
  ctx.strokeStyle = '#fff1c0';
  ctx.stroke(balloon);
  ctx.fillStyle = '#fff9e1';
  glint(ctx, -11, -13, 9);
  ctx.fillStyle = '#ffbe72';
  ctx.beginPath();
  ctx.moveTo(0, 35);
  ctx.lineTo(-5, 43);
  ctx.lineTo(5, 43);
  ctx.closePath();
  ctx.fill();
}

function paintBell(ctx: CanvasRenderingContext2D, elapsed: number, calm: boolean) {
  const fade = unit(elapsed / .06 + .3) * unit((bellDuration - elapsed) / .65);
  const wobble = calm ? 0 : Math.sin(elapsed * 42) * .035 * unit((3.1 - elapsed) / .7);
  ctx.rotate(wobble);
  glow(ctx, 0, 0, 56, '#ffeaa1', fade * .43);
  ctx.globalAlpha = fade;
  ctx.strokeStyle = '#fff1b7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 35, .12, 0, Math.PI * 2);
  ctx.stroke();
  if (calm) return;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const pulse = (elapsed * 1.25 + i / 3) % 1;
    const radius = 44 + pulse * 31;
    ctx.globalAlpha = fade * (1 - pulse) * .88;
    ctx.strokeStyle = i % 2 ? '#fff6d8' : '#ffd677';
    ctx.lineWidth = 2.5 - pulse;
    for (const side of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, side - .55, side + .55);
      ctx.stroke();
    }
  }
}

export function paintIllustration(
  canvas: HTMLCanvasElement, moment: Exclude<Moment, { kind: 'star' }>,
  elapsed: number, calm: boolean, free: number | null, x: number, y: number, vx: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width * moment.x, canvas.height * moment.y);
  ctx.scale(canvas.width / 1200, canvas.height / 849);
  if (moment.kind === 'chest') paintChest(ctx, elapsed, calm);
  else if (moment.kind === 'heart') paintHeart(ctx, elapsed, calm);
  else if (moment.kind === 'bell') paintBell(ctx, elapsed, calm);
  else paintBalloon(ctx, elapsed, free, x, y, vx, calm);
  ctx.restore();
}
