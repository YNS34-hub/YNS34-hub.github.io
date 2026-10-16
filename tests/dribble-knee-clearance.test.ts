import { describe, expect, it } from 'vitest';
import { Bone, Group, Vector3 } from 'three';
import { LimbIK } from '../src/worlds/presence/ik';
import { dribbleLegWindow, sampleDribbleKneePole } from '../src/worlds/presence/courtLocomotion';
import {betweenLegsDepthOffset} from '../src/worlds/presence/dribbleMotion';

// Real low-package, right-hand between-legs receiving leg at phase .65.
// Keep captured bone lengths and ankle; compare the coordinated ball/knee route.
const capture = {
  root: [0, -.3144, 4],
  hip: [-.0909006, .6274456, 4.0000804],
  knee: [-.3535926, .4893810, 3.7025741],
  ankle: [-.3298025, .112, 3.8801300],
  ball: [-.38, .4840565, 3.63],
} as const;
type LegCapture={root:readonly number[];hip:readonly number[];knee:readonly number[];ankle:readonly number[];ball:readonly number[]};
// Native sprint entry at a different run-clip phase: the raised leading ankle
// puts the original knee only 17.23 cm from the ball, below the 17.5 cm thigh gate.
const sprintCapture:LegCapture={
 root:[0,-.25954038362317583,1.049727696247059],
 hip:[.0878096749719165,.695904703414458,1.0552429963504597],
 knee:[.395295643673519,.6323516291415374,.7759719841157862],
 ankle:[.27258535216119967,.41698908833804404,1.1122302227424083],
 ball:[.4391207328940182,.6781426175227988,.6157053247955007],
};
const vector = (a: readonly number[], mirror = 1) => new Vector3(a[0] * mirror, a[1], a[2]);
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
// Keep the original failing ball as red evidence. The coordinated route now
// approaches forward of the knee instead of forcing the knee far outside the foot.
function routedBall(data:LegCapture,phase:number,mirror=1){
 const p=vector(data.ball,mirror),transfer=smooth((phase-.24)/.40);
 p.z+=(betweenLegsDepthOffset(phase)-.32*Math.sin(Math.PI*transfer)**4)*smooth(phase/.35);return p;
}

function capturedLeg(mirror = 1,data:LegCapture=capture) {
  const root = new Group(), hip = new Bone(), knee = new Bone(), ankle = new Bone();
  root.position.copy(vector(data.root,mirror));
  hip.position.copy(vector(data.hip, mirror).sub(root.position));
  knee.position.copy(vector(data.knee, mirror).sub(vector(data.hip, mirror)));
  ankle.position.copy(vector(data.ankle, mirror).sub(vector(data.knee, mirror)));
  root.add(hip); hip.add(knee); knee.add(ankle); root.updateMatrixWorld(true);
  return { root, hip, knee, ankle, solver: new LimbIK() };
}

function ballSegmentDistance(ball: Vector3, start: Vector3, end: Vector3) {
  const direction = end.clone().sub(start);
  const progress = Math.min(1, Math.max(0, ball.clone().sub(start).dot(direction) / direction.lengthSq()));
  return ball.distanceTo(start.clone().addScaledVector(direction, progress));
}

function solveCapturedLeg(phase: number, mirror = 1,data:LegCapture=capture,side=-1) {
  const leg = capturedLeg(mirror,data), target = vector(data.ankle, mirror);
  const pole = sampleDribbleKneePole(new Vector3(), side*mirror, dribbleLegWindow(phase));
  leg.root.localToWorld(pole);
  leg.solver.solve(leg.hip, leg.knee, leg.ankle, target, pole);
  return {
    hip: leg.hip.getWorldPosition(new Vector3()),
    knee: leg.knee.getWorldPosition(new Vector3()),
    ankle: leg.ankle.getWorldPosition(new Vector3()),
    target,
  };
}

describe('between-legs receiving knee clearance', () => {
  for(const mirror of [1,-1])it(`clears the captured leading sprint knee ${mirror} while preserving its raised ankle and limb lengths`,()=>{
    const oldBall=vector(sprintCapture.ball,mirror),ball=routedBall(sprintCapture,.2263414634073653,mirror),oldHip=vector(sprintCapture.hip,mirror),oldKnee=vector(sprintCapture.knee,mirror),oldAnkle=vector(sprintCapture.ankle,mirror);
    expect(ballSegmentDistance(oldBall,oldHip,oldKnee)).toBeLessThan(.175);
    const pose=solveCapturedLeg(.2263414634073653,mirror,sprintCapture,1);
    expect(ballSegmentDistance(ball,pose.hip,pose.knee)).toBeGreaterThanOrEqual(.19);
    expect(ballSegmentDistance(ball,pose.knee,pose.ankle)).toBeGreaterThanOrEqual(.19);
    expect(pose.ankle.distanceTo(oldAnkle)).toBeLessThan(1e-8);
    expect(pose.hip.distanceTo(oldHip)).toBeLessThan(1e-12);
    expect(pose.hip.distanceTo(pose.knee)).toBeCloseTo(oldHip.distanceTo(oldKnee),10);
    expect(pose.knee.distanceTo(pose.ankle)).toBeCloseTo(oldKnee.distanceTo(oldAnkle),10);
  });
  it('reproduces the original native collision before checking the improved knee plane', () => {
    const ball = vector(capture.ball), hip = vector(capture.hip), knee = vector(capture.knee), ankle = vector(capture.ankle);
    expect(ballSegmentDistance(ball, hip, knee)).toBeLessThan(.12);
    expect(ballSegmentDistance(ball, knee, ankle)).toBeLessThan(.12);
  });

  for (const mirror of [1, -1]) it(`clears the captured low bounce without moving the ${mirror === 1 ? 'left' : 'right'} ankle`, () => {
    const pose = solveCapturedLeg(.65, mirror), ball = routedBall(capture,.65,mirror);
    // Basketball radius .12 m plus conservative leg radius .045 m.
    expect(ballSegmentDistance(ball, pose.hip, pose.knee)).toBeGreaterThanOrEqual(.165);
    expect(ballSegmentDistance(ball, pose.knee, pose.ankle)).toBeGreaterThanOrEqual(.165);
    expect(ball.distanceTo(pose.ankle)).toBeGreaterThanOrEqual(.185);
    expect(pose.ankle.distanceTo(pose.target)).toBeLessThan(1e-8);
    expect(pose.hip.distanceTo(vector(capture.hip, mirror))).toBeLessThan(1e-12);
    expect(pose.hip.distanceTo(pose.knee)).toBeCloseTo(vector(capture.hip).distanceTo(vector(capture.knee)), 10);
    expect(pose.knee.distanceTo(pose.ankle)).toBeCloseTo(vector(capture.knee).distanceTo(vector(capture.ankle)), 10);
  });

  it('mirrors the full solved receiving-leg trajectory for either ball hand', () => {
    for (let phase = 0; phase <= 1; phase += 1 / 120) {
      const left = solveCapturedLeg(phase), right = solveCapturedLeg(phase, -1);
      expect(left.knee.x).toBeCloseTo(-right.knee.x, 10);
      expect(left.knee.y).toBeCloseTo(right.knee.y, 10);
      expect(left.knee.z).toBeCloseTo(right.knee.z, 10);
    }
  });

  it('opens and recovers the knee continuously while keeping the planted ankle in place', () => {
    let previous = solveCapturedLeg(0), maximumStep = 0;
    for (let index = 1; index <= 240; index++) {
      const pose = solveCapturedLeg(index / 240);
      maximumStep = Math.max(maximumStep, pose.knee.distanceTo(previous.knee));
      expect(pose.ankle.distanceTo(pose.target)).toBeLessThan(1e-8);
      previous = pose;
    }
    expect(maximumStep).toBeGreaterThan(.001);
    expect(maximumStep).toBeLessThan(.012);
    expect(previous.knee.distanceTo(solveCapturedLeg(0).knee)).toBeLessThan(1e-10);
    for (const phase of [0, .26, .66, 1]) {
      const before = solveCapturedLeg(Math.max(0, phase - .0001));
      const after = solveCapturedLeg(Math.min(1, phase + .0001));
      expect(before.knee.distanceTo(after.knee)).toBeLessThan(1e-6);
    }
  });
});

describe('dribble knee-pole input and allocation behavior', () => {
  it('keeps the open knee plane close to the planted foot instead of forcing both knees far outward',()=>{
    for(const side of [-1,1]){
      const pole=sampleDribbleKneePole(new Vector3(),side,1);
      expect(Math.abs(pole.x)).toBeLessThanOrEqual(.36);expect(pole.z).toBeLessThanOrEqual(-.38);
    }
  });
  for (const side of [-1, 1]) it(`preserves the ordinary ${side === -1 ? 'left' : 'right'} knee plane at a closed gap`, () => {
    expect(sampleDribbleKneePole(new Vector3(), side, 0).toArray()).toEqual([side * .24, .65, -.40]);
  });

  it('reuses a caller-owned output for every frame', () => {
    const output = new Vector3();
    for (let index = 0; index <= 240; index++) expect(sampleDribbleKneePole(output, -1, dribbleLegWindow(index / 240))).toBe(output);
  });

  for (const gap of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) it(`safely closes a damaged or negative gap ${gap}`, () => {
    expect(sampleDribbleKneePole(new Vector3(), -1, gap).toArray()).toEqual([-.24, .65, -.40]);
  });

  it('caps an oversized gap rather than bending the knee beyond the authored clearance', () => {
    expect(sampleDribbleKneePole(new Vector3(), 1, 10)).toEqual(sampleDribbleKneePole(new Vector3(), 1, 1));
  });

  for (const side of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) it(`keeps an invalid side finite ${side}`, () => {
    const output = sampleDribbleKneePole(new Vector3(Number.NaN, Number.NaN, Number.NaN), side, .5);
    expect(output.toArray().every(Number.isFinite)).toBe(true);
  });
});
