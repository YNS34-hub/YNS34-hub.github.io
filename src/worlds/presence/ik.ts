import { Bone, Quaternion, Vector3 } from "three";

// 两段骨骼解算只改变当前人物的骨骼；夹紧不可达目标，避免伸长四肢或产生无效四元数。
export class LimbIK {
  private a = new Vector3(); private b = new Vector3(); private c = new Vector3();
  private direction = new Vector3(); private side = new Vector3(); private elbow = new Vector3();
  private current = new Vector3(); private desired = new Vector3();
  private rotation = new Quaternion(); private world = new Quaternion(); private parent = new Quaternion();
  private hingeAxis = new Vector3(); private hingeCurrent = new Vector3(); private hingeDesired = new Vector3(); private hingeCross = new Vector3();
  private align(bone: Bone, tip: Bone, target: Vector3) {
    bone.getWorldPosition(this.a); tip.getWorldPosition(this.b);
    this.current.subVectors(this.b, this.a).normalize(); this.desired.subVectors(target, this.a).normalize();
    this.rotation.setFromUnitVectors(this.current, this.desired);
    bone.getWorldQuaternion(this.world); this.world.premultiply(this.rotation);
    bone.parent?.getWorldQuaternion(this.parent); this.parent.invert();
    bone.quaternion.copy(this.parent.multiply(this.world)); bone.updateWorldMatrix(true, true);
  }
  solve(top: Bone, middle: Bone, end: Bone, target: Vector3, pole: Vector3, preserveBendPlane = false) {
    top.getWorldPosition(this.a); middle.getWorldPosition(this.b); end.getWorldPosition(this.c);
    const upper = this.a.distanceTo(this.b), lower = this.b.distanceTo(this.c);
    if (upper < .0001 || lower < .0001) return;
    this.direction.subVectors(target, this.a); const distance = this.direction.length();
    if (distance < .0001) return; this.direction.divideScalar(distance);
    const reach = Math.max(Math.abs(upper - lower) + .0001, Math.min(upper + lower - .0001, distance));
    const along = (upper * upper + reach * reach - lower * lower) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    this.side.subVectors(pole, this.a).addScaledVector(this.direction, -this.side.dot(this.direction));
    if (this.side.lengthSq() < .00001) this.side.set(1, 0, 0).addScaledVector(this.direction, -this.direction.x);
    if (this.side.lengthSq() < .00001) this.side.set(0, 0, 1);
    this.side.normalize(); this.elbow.copy(this.a).addScaledVector(this.direction, along).addScaledVector(this.side, height);
    this.align(top, middle, this.elbow);
    if(preserveBendPlane){
      top.getWorldPosition(this.a);middle.getWorldPosition(this.b);end.getWorldPosition(this.c);
      this.hingeAxis.subVectors(this.b,this.a).normalize();
      this.hingeCurrent.subVectors(this.c,this.b);this.hingeCurrent.addScaledVector(this.hingeAxis,-this.hingeCurrent.dot(this.hingeAxis));
      this.hingeDesired.subVectors(target,this.b);this.hingeDesired.addScaledVector(this.hingeAxis,-this.hingeDesired.dot(this.hingeAxis));
      // Rotate around the upper segment before bending the elbow. A shortest-arc
      // swing alone leaves the forearm bending sideways through the skin weights.
      if(this.hingeCurrent.lengthSq()>1e-9&&this.hingeDesired.lengthSq()>1e-9){
        this.hingeCurrent.normalize();this.hingeDesired.normalize();this.hingeCross.crossVectors(this.hingeCurrent,this.hingeDesired);
        const angle=Math.atan2(this.hingeCross.dot(this.hingeAxis),this.hingeCurrent.dot(this.hingeDesired));
        this.rotation.setFromAxisAngle(this.hingeAxis,angle);top.getWorldQuaternion(this.world);this.world.premultiply(this.rotation);
        top.parent?.getWorldQuaternion(this.parent);top.quaternion.copy(this.parent.invert().multiply(this.world));top.updateWorldMatrix(true,true);
      }
    }
    this.align(middle, end, target);
  }
}
