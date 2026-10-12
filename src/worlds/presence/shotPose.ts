const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };

export function prepareShot(charge: number) {
  const c = clamp(charge), lift = smooth(c / .56), air = clamp((c - .30) / .65);
  return { x: .23 - lift * .10, y: 1.07 + lift * .96, z: -.40 + lift * .13,
    jump: c < .30 ? -.105 * Math.sin(Math.PI * c / .30) : .30 * Math.sin(Math.PI * air),
    pitch: -.12 * (1 - lift), guide: 1 - smooth((c - .65) / .25) * .25 };
}

export function shotRecovery(remaining: number, initialJump: number) {
  const time = Math.max(0, .65 - remaining), down = smooth(time / .35);
  return { jump: Math.max(0, initialJump) * (1 - down) - .065 * Math.sin(Math.PI * clamp((time - .35) / .23)),
    reach: 1 - smooth((time - .17) / .48), guide: 1 - smooth(time / .12), wrist: smooth(time / .08) * (1 - smooth((time - .38) / .27)) };
}
