export const starDuration = 2.84;

const launchTime = .065;
const flightTime = 1.255;
const stepCount = 128;
const unit = (value: number) => Math.max(0, Math.min(1, value));

// Trace the ribbon already painted on the page, relative to the tip of Fien's wand.
const curves = [
  [-126, -39, -268, -9, -330, 42],
  [-414, 120, -422, 254, -371, 359],
  [-310, 472, -176, 467, -73, 429],
  [22, 397, 122, 339, 193, 266],
];
const ribbon = [{ x: 0, y: 0, length: 0 }];
for (const [ax, ay, bx, by, cx, cy] of curves) {
  const origin = ribbon[ribbon.length - 1];
  for (let i = 1; i <= 32; i++) {
    const t = i / 32, inv = 1 - t;
    const x = inv ** 3 * origin.x + 3 * inv ** 2 * t * ax + 3 * inv * t ** 2 * bx + t ** 3 * cx;
    const y = inv ** 3 * origin.y + 3 * inv ** 2 * t * ay + 3 * inv * t ** 2 * by + t ** 3 * cy;
    const last = ribbon[ribbon.length - 1];
    ribbon.push({ x, y, length: last.length + Math.hypot(x - last.x, y - last.y) });
  }
}

const length = ribbon[ribbon.length - 1].length;
function pointAt(progress: number) {
  const distance = unit(progress) * length;
  let low = 0, high = ribbon.length - 1;
  while (high - low > 1) {
    const mid = (high + low) >> 1;
    if (ribbon[mid].length < distance) low = mid;
    else high = mid;
  }
  const a = ribbon[low], b = ribbon[high];
  const t = (distance - a.length) / (b.length - a.length);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const strands = [0, 1, 2].map(strand =>
  Array.from({ length: stepCount + 1 }, (_, index) => {
    const t = index / stepCount;
    const point = pointAt(t);
    const next = pointAt(t + .004);
    const prev = pointAt(t - .004);
    const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    const offset = strand === 0 ? 0 : Math.sin(t * 14 + strand * Math.PI) * Math.sin(t * Math.PI) * (strand === 1 ? 9 : 15);
    return { x: point.x - Math.sin(angle) * offset, y: point.y + Math.cos(angle) * offset };
  }),
);

const dust = Array.from({ length: 118 }, (_, i) => {
  const launch = i < 24;
  const arrival = i >= 100;
  const progress = launch ? 0 : arrival ? 1 : (i - 23) / 77;
  const crossing = launchTime + flightTime * (1 - (1 - progress) ** (1 / 1.24));
  return {
    origin: pointAt(progress),
    born: launch ? i * .003 : crossing + (arrival ? (i - 100) * .006 : 0),
    angle: i * 2.39996,
    drift: (launch || arrival ? 42 : 14) + (i * 37 % 57),
    life: .49 + (i * 13 % 53) / 70,
    size: 1 + (i * 19 % 43) / 12,
    glint: i % (arrival ? 3 : 5) === 0,
    color: ['#fff7d6', '#ffdc87', '#ffd2b6', '#fff1ac'][i % 4],
  };
});

const ribbonLayers = [
  { color: '#da841e', width: 13, alpha: .26 },
  { color: '#ffd267', width: 6, alpha: .92 },
  { color: '#fffbe5', width: 2.4, alpha: 1 },
  { color: '#fff4ac', width: 1.55, alpha: .8 },
  { color: '#ffe9cf', width: 1.1, alpha: .62 },
];

function glint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * .1, y - size * .09, x + size * .77, y);
  ctx.quadraticCurveTo(x + size * .1, y + size * .09, x, y + size);
  ctx.quadraticCurveTo(x - size * .1, y + size * .09, x - size * .77, y);
  ctx.quadraticCurveTo(x - size * .1, y - size * .09, x, y - size);
  ctx.fill();
}

function lantern(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) {
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, '#fffef0');
  light.addColorStop(.14, '#fff0b8eb');
  light.addColorStop(.46, '#ffc05c72');
  light.addColorStop(1, '#ffc05c00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = light;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function paintStar(canvas: HTMLCanvasElement, x: number, y: number, elapsed: number, calm: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(x * canvas.width, y * canvas.height);
  ctx.scale(canvas.width / 1200, canvas.height / 849);

  const ember = calm ? unit(elapsed / .16) * unit((1.28 - elapsed) / .83) : Math.exp(-elapsed * 3.9);
  if (ember > .01) {
    lantern(ctx, 0, 0, calm ? 49 : 52 + 26 * unit(elapsed / .22), ember * .84);
    ctx.globalAlpha = ember;
    ctx.fillStyle = '#fff8d1';
    glint(ctx, 0, 0, calm ? 19 : 25 + 12 * unit(elapsed / .1));
  }

  if (!calm) {
    const progress = 1 - (1 - unit((elapsed - launchTime) / flightTime)) ** 1.24;
    const head = pointAt(progress);
    const tailAlpha = unit((2.35 - elapsed) / 1.02);
    const trail = Math.max(0, progress - .37 - .12 * unit(elapsed));
    // Feather the wake in overlapping lengths so the ribbon dissolves behind its head.
    const end = Math.floor(progress * stepCount);
    const first = Math.floor(trail * stepCount);
    const band = Math.max(1, Math.ceil((end - first) / 9));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let start = first; start < end; start += band) {
      const finish = Math.min(end, start + band);
      const intensity = ((finish - first) / (end - first)) ** 1.8;
      ribbonLayers.forEach(({ color, width, alpha }, layer) => {
        const strand = strands[Math.max(0, layer - 2)];
        ctx.beginPath();
        ctx.moveTo(strand[start].x, strand[start].y);
        for (let i = start + 1; i <= finish; i++) ctx.lineTo(strand[i].x, strand[i].y);
        if (finish === end && layer < 3) ctx.lineTo(head.x, head.y);
        ctx.globalAlpha = tailAlpha * intensity * alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      });
    }

    for (const fleck of dust) {
      const age = (elapsed - fleck.born) / fleck.life;
      if (age <= 0 || age >= 1) continue;
      const travel = fleck.drift * (1 - (1 - age) ** 2.7);
      const px = fleck.origin.x + Math.cos(fleck.angle) * travel;
      const py = fleck.origin.y + Math.sin(fleck.angle) * travel + age ** 2 * 26;
      ctx.globalAlpha = unit(age * 13) * (1 - age) ** 1.4;
      ctx.fillStyle = fleck.color;
      if (fleck.glint) glint(ctx, px, py, fleck.size * 2.1);
      else {
        ctx.beginPath();
        ctx.arc(px, py, fleck.size * (1 - age * .65), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const arrivalAge = elapsed - launchTime - flightTime;
    const bloom = unit(arrivalAge / .09) * unit((.48 - arrivalAge) / .39);
    const afterglow = unit((.60 - arrivalAge) / .60);
    if (afterglow > 0) {
      lantern(ctx, head.x, head.y, 49 + 29 * bloom, afterglow * .91);
      ctx.globalAlpha = afterglow;
      ctx.fillStyle = '#fffdeb';
      glint(ctx, head.x, head.y, 15 + 8 * Math.sin(progress * Math.PI) + 13 * bloom);
    }
  }

  ctx.restore();
}
