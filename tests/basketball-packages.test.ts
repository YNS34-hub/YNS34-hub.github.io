import {describe,it,expect,vi,afterEach} from 'vitest';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';
import {dribblePose} from '../src/worlds/presence/dribblePose';
import {motionPacks,defaultPacks,normalizePacks,type MotionPackSelection} from '../src/worlds/court/motionPacks';
import {FinishMotion} from '../src/worlds/court/finishing';
import {BallPhysics,HOOPS} from '../src/worlds/basketballPhysics';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const advance = (m: DribbleMotion, seconds: number, speed = 0) => { let p = m.sample(speed); for (let t = 0; t < seconds; t += 1 / 120) p = m.advance(Math.min(1 / 120, seconds - t), speed); return copy(p); };
describe('coordinated left and right hand changes',() => {
  for (const style of ['balanced', 'low', 'wide'] as const) for (const hand of [-1, 1] as const) for (const phase of [.20, .44, .80]) it(`${style} ${hand} switches from phase ${phase} only on a catch, with continuous ball and both palms`, () => {
    const m = new DribbleMotion(hand, style); advance(m, motionPacks.dribble[style].period * phase); let previous = copy(m.sample(0)); m.requestHand(-hand); expect(m.hand).toBe(hand); let changes = 0;
    for (let i = 0; i < 240; i++) {
      const p = m.advance(1 / 120, 0);
      for (const key of ['ball', 'leftPalm', 'rightPalm'] as const) { const a = p[key], b = previous[key]; expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(.095); expect(Object.values(a).every(Number.isFinite)).toBe(true); }
      expect(p.ball.y).toBeGreaterThanOrEqual(.12 - 1e-7);
      if (p.hand !== previous.hand) { expect(p.hand).toBe(-hand); expect(Math.min(p.phase, 1 - p.phase)).toBeLessThan(.05); changes++; }
      previous = copy(p);
    }
    expect(changes).toBe(1); expect(m.hand).toBe(-hand);
  });
  it('keeps physical gravity and floor contact for every dribble style', () => {
    const dp = .0001;
    for (const style of Object.keys(motionPacks.dribble) as MotionPackSelection['dribble'][]) { const options = motionPacks.dribble[style], period = options.period; const y = (p: number) => dribblePose(p, 0, 1, undefined, period, options).ball.y; for (const p of [.2, .72]) expect((y(p + dp) - 2 * y(p) + y(p - dp)) / (dp * period) ** 2).toBeCloseTo(-9.81, 4); expect(y(.44)).toBeCloseTo(.12); expect(y(0)).toBeCloseTo(y(1)); }
  });
  it('has a genuinely lower bounce and distinct lateral reach without frame-rate dependent hand commits', () => {
    const normal = new DribbleMotion(1, 'balanced'), low = new DribbleMotion(1, 'low'), wide = new DribbleMotion(1, 'wide'); expect(low.sample(0).ball.y).toBeLessThan(normal.sample(0).ball.y - .15); expect(wide.sample(0).ball.x).toBeGreaterThan(normal.sample(0).ball.x + .08);
    for (const fps of [30, 60, 120]) { const m = new DribbleMotion(1); m.requestHand(-1); for (let i = 0; i < fps * 2; i++) m.advance(1 / fps, 6.2); expect(m.hand).toBe(-1); }
  });
  for (const hand of [-1, 1]) it(`${hand} starts the wide dribble at the actual protective hold position without snapping`, () => {
    const seed = { x: .12 * hand, y: 1.13, z: -.34 }, m = new DribbleMotion(hand, 'wide'); m.seedPosition(seed);
    expect(copy(m.sample(0).ball)).toEqual(seed);
    const next = copy(m.advance(1 / 120, 0).ball);
    expect(Math.hypot(next.x - seed.x, next.y - seed.y, next.z - seed.z)).toBeLessThan(.06);
  });
  for (const hand of [-1, 1]) it(`${hand} changes low to wide without ball or palm jumps at either catch`, () => {
    const m = new DribbleMotion(hand, 'low'); advance(m, motionPacks.dribble.low.period * .65); let previous = copy(m.sample());
    for (let i = 0; i < 240; i++) {
      const p = m.advance(1 / 120, 0, 'wide');
      for (const key of ['ball', 'leftPalm', 'rightPalm'] as const) { const a = p[key], b = previous[key]; expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(.095); expect(Object.values(a).every(Number.isFinite)).toBe(true); }
      expect(p.hand).toBe(hand); previous = copy(p);
    }
    const expected = dribblePose(previous.phase, 0, hand, undefined, motionPacks.dribble.wide.period, motionPacks.dribble.wide);
    for (const axis of ['x', 'y', 'z'] as const) expect(previous.ball[axis]).toBeCloseTo(expected.ball[axis], 8);
  });

  it('freezes a pending crossover while paused and finishes it after resuming', () => {
    const m = new DribbleMotion(1); advance(m, .13); m.requestHand(-1); advance(m, .10); const before = copy(m.sample());
    for (let i = 0; i < 30; i++) expect(copy(m.advance(1 / 30, 0, undefined, false, true))).toEqual(before);
    expect(m.hand).toBe(1); advance(m, 2); expect(m.hand).toBe(-1);
  });
});
describe('real finish packages retain authoritative ball physics',() => {
  for (const kind of ['layup', 'dunk'] as const) for (const id of Object.keys(motionPacks[kind])) for (const hand of [-1, 1]) for (const hoop of HOOPS) it(`${kind}/${id}/${hand}/${hoop.z} releases once and scores after real downward crossing`, () => {
    const packs = { ...defaultPacks, [kind]: id } as MotionPackSelection, front = hoop.z < 0 ? 1 : -1;
    const input = { held: true, position: { x: -.3 * hand, y: 1.65, z: hoop.z + front * 2.1 }, direction: { x: 0, y: 0, z: -front }, speed: 5, hand, packs };
    const motion = new FinishMotion(), ball = new BallPhysics(); ball.pickup(); expect(motion.start(kind, input).allowed).toBe(true); let releases = 0, madeEvents = 0;
    for (let t = 0; t < 3; t += 1 / 120) { const p = motion.advance(1 / 120); if (p?.release) { releases++; for (const axis of ['x', 'y', 'z'] as const) expect(p.ball[axis]).toBeCloseTo(p.release.origin[axis], 2); expect(Object.values(p.release.velocity).every(Number.isFinite)).toBe(true); ball.launch(p.release.origin, p.release.velocity); expect(ball.stats.made).toBe(0); } madeEvents += ball.step(1 / 120).filter(event => event === 'made').length; }
    expect(releases).toBe(1); expect(ball.stats.shots).toBe(1); expect(ball.stats.made).toBe(1); expect(madeEvents).toBe(1); expect(motion.active).toBe(false);
  });
  for (const kind of ['layup', 'dunk'] as const) for (const id of Object.keys(motionPacks[kind])) it(`${kind}/${id} gathers from the real ball and preserves possession, approach and facing gates`, () => {
    const packs = { ...defaultPacks, [kind]: id } as MotionPackSelection, input = { held: true, position: { x: 0, y: 1.65, z: -9.8 }, direction: { x: 0, y: 0, z: -1 }, speed: 5, hand: 1, packs };
    for (const invalid of [{ ...input, held: false }, { ...input, position: { x: 0, y: 1.65, z: 0 } }, { ...input, direction: { x: 0, y: 0, z: 1 } }, ...(kind === 'dunk' ? [{ ...input, speed: 0 }] : [])]) { const denied = new FinishMotion(); expect(denied.start(kind, invalid).allowed).toBe(false); expect(denied.advance(1 / 120)).toBeNull(); }
    const ball = { x: .31, y: .40, z: -10.2 }, m = new FinishMotion(); expect(m.start(kind, { ...input, ball }).allowed).toBe(true); expect(m.advance(0, true)!.ball).toEqual(ball); const next = m.advance(1 / 120)!.ball; expect(Math.hypot(next.x - ball.x, next.y - ball.y, next.z - ball.z)).toBeLessThan(.06);
  });
  it('keeps two-hand support through release, freezes the chosen package, and pauses without drift', () => {
    const packs = { ...defaultPacks, dunk: 'two-hand' } as MotionPackSelection, m = new FinishMotion(), baseline = new FinishMotion(), input = { held: true, position: { x: 0, y: 1.65, z: -9.8 }, direction: { x: 0, y: 0, z: -1 }, speed: 5, hand: 1 };
    m.start('dunk', { ...input, packs }); baseline.start('dunk', { ...input, packs: { ...packs } }); packs.dunk = 'one-hand'; packs.hands = 'protect'; const p = m.advance(.06)!; expect(p.handSpread).toBe(motionPacks.hands.natural.spread); expect(p).toEqual(baseline.advance(.06)); const paused = m.advance(.06, true)!; expect(paused).toEqual(p); let release;
    for (let i = 0; i < 200; i++) { const next = m.advance(1 / 120); expect(next).toEqual(baseline.advance(1 / 120)); if (next && next.elapsed > .16) expect(next.twoHands).toBeGreaterThan(.95); if (next?.release) { release = next; break; } }
    expect(release?.twoHands).toBeGreaterThan(.95); expect(release?.package).toBe('two-hand'); expect(release?.handSpread).toBe(motionPacks.hands.natural.spread);
  });
  it('makes the protective hand package visibly gather nearer the body', () => {
    const input = { held: true, position: { x: 0, y: 1.65, z: -9.8 }, direction: { x: 0, y: 0, z: -1 }, speed: 5, hand: 1, ball: { x: .31, y: .40, z: -10.2 } }, natural = new FinishMotion(), protect = new FinishMotion();
    natural.start('layup', { ...input, packs: { ...defaultPacks, hands: 'natural' } }); protect.start('layup', { ...input, packs: { ...defaultPacks, hands: 'protect' } });
    let a = natural.advance(0, true)!, b = protect.advance(0, true)!;
    for (let i = 0; i < 28; i++) { a = natural.advance(1 / 120)!; b = protect.advance(1 / 120)!; }
    expect(Math.abs(b.ball.x - b.position.x)).toBeLessThan(Math.abs(a.ball.x - a.position.x) - .035);
  });

  it('normalizes corrupted choices without affecting existing appearance or private library storage', async () => {
    expect(normalizePacks({ dribble: 'unknown', dunk: 'two-hand' })).toEqual({ ...defaultPacks, dunk: 'two-hand' }); expect(normalizePacks(null)).toEqual(defaultPacks);
    const values = new Map([['existing-library', 'keep'], ['memory-palace:appearance:v1', 'keep-profile']]); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }); const { useCourtPackages } = await import('../src/worlds/court/packagePreferences'); useCourtPackages.getState().select('dribble', 'low'); expect(values.get('existing-library')).toBe('keep'); expect(values.get('memory-palace:appearance:v1')).toBe('keep-profile');
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } }); expect(() => useCourtPackages.getState().select('dunk', 'two-hand')).not.toThrow();
  });
});
