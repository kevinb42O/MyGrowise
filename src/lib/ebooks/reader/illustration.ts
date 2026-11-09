export const moments = {
  5: { kind: 'star', x: .805, y: .474, size: '7%', label: 'Raak Fiens ster aan', text: 'Volg het licht, het avontuur begint!' },
  10: { kind: 'chest', x: .518, y: .652, size: '10%', label: 'Tik op het slot', text: 'Welke superkracht zou jij in de kist stoppen?' },
  21: { kind: 'heart', x: .462, y: .524, size: '22%', label: 'Houd het hart vast', text: 'Adem rustig in … en weer uit.' },
  25: { kind: 'balloon', x: .508, y: .093, size: '7%', label: 'Trek aan de ballon', text: 'Laat je piekergedachte even meevliegen.' },
} as const;
export type Moment = typeof moments[keyof typeof moments];

export function paintIllustration(canvas: HTMLCanvasElement, moment: Moment, t: number, fade: number, dx: number, dy: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const x = w * moment.x, y = h * moment.y;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);

  function glow(x: number, y: number, radius: number, color: string) {
    const fill = ctx!.createRadialGradient(x, y, 0, x, y, radius);
    fill.addColorStop(0, color);
    fill.addColorStop(1, 'transparent');
    ctx!.fillStyle = fill;
    ctx!.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function spark(x: number, y: number, size: number) {
    ctx!.beginPath();
    ctx!.moveTo(x - size, y);
    ctx!.quadraticCurveTo(x, y - 1, x, y - size);
    ctx!.quadraticCurveTo(x + 1, y, x + size, y);
    ctx!.quadraticCurveTo(x, y + 1, x, y + size);
    ctx!.quadraticCurveTo(x - 1, y, x - size, y);
    ctx!.fill();
  }

  if (moment.kind === 'star') {
    const trail = new Path2D('M0 0 C -130 -112 -339 -24 -390 125 C -440 275 -136 349 134 225');
    ctx.lineCap = 'round';
    ctx.setLineDash([850 * Math.min(1, t * 1.45), 950]);
    ctx.strokeStyle = '#ffd46e';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ffbc48';
    ctx.shadowBlur = 16;
    ctx.stroke(trail);
    ctx.strokeStyle = '#fff7cb';
    ctx.lineWidth = 2;
    ctx.stroke(trail);
    glow(0, 0, 95, '#fff4aee0');
    ctx.fillStyle = '#fff6c7';
    for (let i = 0; i < 16; i++) {
      const angle = i * 2.4, r = (18 + i * 7) * t;
      spark(Math.cos(angle) * r, Math.sin(angle) * r, 4 + i % 3 * 2);
    }
  } else if (moment.kind === 'chest') {
    glow(0, 0, 220 * t + 28, '#ffc95bb0');
    ctx.fillStyle = '#fff0b6';
    ctx.shadowColor = '#ffab3a';
    ctx.shadowBlur = 12;
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.4, distance = (30 + i * 6) * t;
      spark(Math.cos(angle) * distance, Math.sin(angle) * distance - 220 * t, 3 + i % 4 * 2);
    }
    ctx.strokeStyle = '#ffe19a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -124 * t, 50 + 106 * t, 14 + 28 * t, -.14, .15, 5.8);
    ctx.stroke();
  } else if (moment.kind === 'heart') {
    const heart = new Path2D('M0 -74 C -51 -144 -150 -126 -136 -38 C -132 26 -65 91 0 136 C 65 91 132 26 136 -38 C 150 -126 51 -144 0 -74Z');
    glow(0, 0, 190 + 70 * t, '#adff8f9e');
    ctx.scale(1 + .35 * t, 1 + .35 * t);
    ctx.strokeStyle = '#f3ffcb';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#acff73';
    ctx.shadowBlur = 17;
    ctx.stroke(heart);
  } else {
    ctx.strokeStyle = '#fff1c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(dx * .2, dy * .15 + 42, dx, dy + 28);
    ctx.stroke();
    glow(dx, dy, 67, '#ffd278ad');
    ctx.translate(dx, dy);
    const color = ctx.createLinearGradient(-18, -25, 21, 25);
    color.addColorStop(0, '#fff1af');
    color.addColorStop(.35, '#ffbc64');
    color.addColorStop(1, '#e87533');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.bezierCurveTo(-27, 22, -34, -36, -1, -36);
    ctx.bezierCurveTo(33, -37, 34, 19, 0, 26);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
