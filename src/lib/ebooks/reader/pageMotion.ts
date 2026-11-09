// Exact critically damped spring: consistent pacing at 60/120 Hz and after a slow frame.
export function stepPageSpring(value: number, velocity: number, target: number, dt: number) {
  const response = 12;
  const offset = value - target;
  const impulse = velocity + response * offset;
  const decay = Math.exp(-response * dt);
  return {
    value: target + (offset + impulse * dt) * decay,
    velocity: (velocity - response * impulse * dt) * decay,
  };
}
