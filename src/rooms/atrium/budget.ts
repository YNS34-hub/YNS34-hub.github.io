import { Quaternion, Vector3 } from "three";

export class ReflectionBudget {
  private last = -Infinity;
  private warmup = 2;
  private position = new Vector3(Infinity,Infinity,Infinity);
  private rotation = new Quaternion();
  constructor(private readonly hz: number) {}
  invalidate() { this.warmup = Math.max(1,this.warmup); }
  take(now: number, position: Vector3, rotation: Quaternion, active: boolean, visible: boolean) {
    if (!visible || !Number.isFinite(now) || now-this.last < 1/this.hz) return false;
    const moved=this.position.distanceToSquared(position)>.000016 || Math.abs(this.rotation.dot(rotation))<.999999;
    if (!moved && !active && !this.warmup) return false;
    this.last=now;this.position.copy(position);this.rotation.copy(rotation);this.warmup=Math.max(0,this.warmup-1);return true;
  }
}
