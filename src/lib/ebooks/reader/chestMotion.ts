export const chestDuration = 5.2;
const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t=unit(value); return t*t*t*(10+t*(-15+6*t)); };

// Anticipate, lift, hold long enough to look inside, then gently close.
export function chestPose(elapsed: number) {
  const opening = smooth((elapsed-.18)/.95);
  const closing = smooth((elapsed-3.95)/1.1);
  return {
    open: opening*(1-closing),
    light: smooth((elapsed-.28)/.65)*(1-smooth((elapsed-3.7)/1.15)),
    unlock: smooth(elapsed/.18)*(1-smooth((elapsed-.3)/.35)),
  };
}
