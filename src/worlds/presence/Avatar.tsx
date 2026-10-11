import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, Bone, Group, Mesh, Quaternion, SkinnedMesh, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { usePalaceStore } from "../../systems/store";
import { useActivity } from "../activity";
import { roadView, useRoadRide } from "../road/state";
import { getRideMap } from "../road/maps";
import { ATHLETE } from "./assets";
import { pedalPoint } from "./math";
import { presence, usePerspective, type AdventureRoom } from "./state";
import { LimbIK } from "./ik";
import { HOOPS } from "../basketballPhysics";

export default function SportAvatar({ roomId }: { roomId: AdventureRoom }) {
  const gltf = useGLTF(ATHLETE), root = useRef<Group>(null), helmet = useRef<Group>(null);
  const rig = useMemo(() => {
    const object = clone(gltf.scene), bones = new Map<string, Bone>(), materials: Mesh["material"][] = [];
    object.traverse(child => {
      if (child instanceof Bone) bones.set(child.name, child);
      if (child instanceof Mesh) {
        child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
        materials.push(child.material); child.castShadow = true; child.receiveShadow = true; child.raycast = () => {};
      }
    });
    const mixer = new AnimationMixer(object);
    const actions = gltf.animations.map(clip => mixer.clipAction(clip).play().setEffectiveWeight(clip.name === "idle" ? 1 : 0));
    mixer.setTime(.1); object.rotation.y=Math.PI; object.updateWorldMatrix(true,true);
    const seatedBase=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
    const animatedBase=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
    const feet=new Map([-1,1].map(side=>[side,bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!.getWorldQuaternion(new Quaternion())]));
    const hips=new Map([-1,1].map(side=>[side,{position:new Vector3(),quaternion:new Quaternion()}]));
    const headBase=bones.get("Bip01_Head")!.getWorldQuaternion(new Quaternion()).invert();
    return { object, bones, materials, mixer, actions, seatedBase, animatedBase, feet, hips, headBase, helmetOffset:new Vector3(), ik: new LimbIK(), target: new Vector3(), pole: new Vector3(), point: new Vector3(), tangent: new Vector3(), direction: new Vector3(), head: new Vector3(), tilt: new Quaternion(), world: new Quaternion(), parent: new Quaternion(), axis: new Vector3(1, 0, 0) };
  }, [gltf]);
  useEffect(() => {
    // StrictMode 会重播 effect；清理后的同一实例必须重新激活动作，不能留下静止绑定姿态。
    rig.actions=gltf.animations.map(clip=>rig.mixer.clipAction(clip).reset().play().setEffectiveWeight(clip.name==="idle"?1:0));
    return () => {
      rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.object);
      rig.materials.flat().forEach(m => m.dispose());
      rig.object.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
      // 几何与纹理仍由 GLTF 缓存共享，不能在人物卸载时销毁其他实例仍引用的资源。
    };
  }, [rig,gltf]);
  useFrame((_, rawDelta) => {
    if (!root.current) return;
    const palace = usePalaceStore.getState(), ride = useRoadRide.getState(), third = usePerspective.getState().views[roomId] === "third";
    root.current.visible = third && !(roomId !== "basketball" && ride.photo);
    if (!root.current.visible) return;
    const riding = roomId !== "basketball" && ride.mounted;
    const blocked = !palace.started || !!palace.overlay || !!palace.focus || palace.mode === "index" || useActivity.getState().warming || document.hidden;
    if(blocked)return;
    const dt = Math.min(rawDelta, .06), speed = presence.speed;
    for (const action of rig.actions) {
      const weight = riding ? Number(action.getClip().name === "idle") : action.getClip().name === "idle" ? Number(speed < .12) : action.getClip().name === "walk" ? Number(speed >= .12 && speed < 3.5) : Number(speed >= 3.5);
      action.setEffectiveWeight(riding ? weight : action.getEffectiveWeight()+(weight-action.getEffectiveWeight())*(1-Math.exp(-Math.min(rawDelta,.06)*14)));
      if (action.getClip().name !== "idle") action.setEffectiveTimeScale(Math.min(1.55, Math.max(.45, speed / (action.getClip().name === "run" ? 5.4 : 1.9))));
    }
    // 恒定时间的 Mixer 会跳过相同值，不能依赖它擦掉上一帧 IK；显式恢复骑姿基准后再解算。
    for(const [name,pose] of riding?rig.seatedBase:rig.animatedBase){const bone=rig.bones.get(name)!;bone.position.copy(pose.position);bone.quaternion.copy(pose.quaternion);}
    if(!riding){
      rig.mixer.update(dt);
      // IK 是动画之上的一层；保留未加约束的姿态，避免常量轨道把抬手或骑姿永久留在人物身上。
      for(const [name,pose] of rig.animatedBase){const bone=rig.bones.get(name)!;pose.position.copy(bone.position);pose.quaternion.copy(bone.quaternion);}
    }
    if (riding) {
      const map = getRideMap(roomId); map.sample(roadView.distance, rig.point, rig.tangent);
      const normal = Math.hypot(rig.tangent.x, rig.tangent.z);
      rig.point.x += -rig.tangent.z / normal * roadView.offset; rig.point.z += rig.tangent.x / normal * roadView.offset;
      const px=roadView.walkX+3.2,pz=roadView.walkZ-3.2,py=map.ground(px,pz),p=roadView.mountProgress,e=p*p*(3-2*p);
      rig.point.y+=.012;
      root.current.position.set(px+(rig.point.x-px)*e,py+(rig.point.y-py)*e,pz+(rig.point.z-pz)*e);
      const yaw=-.95+Math.atan2(Math.sin(roadView.yaw+.95),Math.cos(roadView.yaw+.95))*e;
      root.current.rotation.set(Math.atan2(rig.tangent.y, normal)*e,yaw,-roadView.lean*e,"YXZ");
      rig.object.position.set(0, .065, .19); rig.object.rotation.y = Math.PI;
      // 躯干前倾、手握刹车罩，脚踝追随同一真实曲柄相位；不用独立的假踏频。
      root.current.updateWorldMatrix(true, true);
      for(const side of[-1,1]){const thigh=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Thigh")!,hip=rig.hips.get(side)!;thigh.getWorldPosition(hip.position);thigh.getWorldQuaternion(hip.quaternion);}
      rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);
      for (const [name, angle] of [["Bip01_Spine", -.97], ["Bip01_Spine1", -.10], ["Bip01_Head", .90]] as const) {
        const bone = rig.bones.get(name);
        if (bone?.parent) {
          bone.getWorldQuaternion(rig.world); rig.world.premultiply(rig.tilt.setFromAxisAngle(rig.axis, angle));
          bone.parent.getWorldQuaternion(rig.parent); bone.quaternion.copy(rig.parent.invert().multiply(rig.world)); bone.updateWorldMatrix(true,true);
        }
      }
      // Rocketbox 的大腿挂在 Spine 下；腰部前倾时保留髋关节世界位置，随后只解算真实腿长。
      for(const side of[-1,1]){const thigh=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Thigh")!,hip=rig.hips.get(side)!;thigh.position.copy(thigh.parent!.worldToLocal(hip.position));thigh.parent!.getWorldQuaternion(rig.parent);thigh.quaternion.copy(rig.parent.invert().multiply(hip.quaternion));thigh.updateWorldMatrix(true,true);}
      root.current.updateWorldMatrix(true, true);
      for (const side of [-1, 1] as const) {
        rig.axis.set(0,1,0);rig.target.set(side*.21,.09,-.28).applyAxisAngle(rig.axis,roadView.steer*.5);rig.target.y+=.90;rig.target.z-=.39;root.current.localToWorld(rig.target);
        rig.pole.set(side * .48, 1.15, -.38); root.current.localToWorld(rig.pole);
        limb(side, "arm");
        pedalPoint(side, roadView.pedalAngle, rig.target); rig.target.y += .118; root.current.localToWorld(rig.target);
        rig.pole.set(side * .21, .6, -.42); root.current.localToWorld(rig.pole); limb(side, "leg");
        const foot=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!;
        root.current.getWorldQuaternion(rig.world);rig.world.multiply(rig.feet.get(side)!);foot.parent!.getWorldQuaternion(rig.parent);
        foot.quaternion.copy(rig.parent.invert().multiply(rig.world));foot.updateWorldMatrix(true,true);
      }
    } else {
      presence.camera.getWorldDirection(rig.direction);
      root.current.position.set(presence.camera.position.x, presence.camera.position.y - 1.65 + presence.jump, presence.camera.position.z);
      root.current.rotation.set(0, Math.atan2(-rig.direction.x, -rig.direction.z), 0);
      rig.object.position.set(0, 0, 0); rig.object.rotation.y = Math.PI; root.current.updateWorldMatrix(true, true);
      if (presence.held || presence.finish !== "idle" || presence.shot>0) {
        if(presence.held)rig.target.copy(presence.ball);
        else if(presence.finish!=="idle"){const hoop=HOOPS.reduce((a,b)=>Math.abs(a.z-presence.camera.position.z)<Math.abs(b.z-presence.camera.position.z)?a:b);rig.target.set(hoop.x,3.23,hoop.z);}
        else{rig.target.copy(presence.releaseHand);const wrist=rig.bones.get("Bip01_R_Hand")!;wrist.getWorldPosition(rig.head);rig.target.lerp(rig.head,Math.pow(1-presence.shot/.65,2));}
        rig.target.y -= .045; rig.target.x -= presence.hand * .04;
        rig.pole.set(presence.hand * .65, 1.1, -.22); root.current.localToWorld(rig.pole); limb(presence.hand as -1 | 1, "arm");
        if (!presence.dribbling && presence.finish === "idle") {
          rig.target.copy(presence.ball); rig.target.x -= presence.hand * .15;
          rig.pole.set(-presence.hand * .54, 1.18, -.22); root.current.localToWorld(rig.pole); limb(-presence.hand as -1 | 1, "arm");
        }
      }
      if(presence.jump>.06){
        for(const side of [-1,1] as const){
          rig.target.set(side*.12,.11+Math.min(.28,presence.jump*.22),side===1?.09:.21);root.current.localToWorld(rig.target);
          rig.pole.set(side*.2,.65,-.40);root.current.localToWorld(rig.pole);limb(side,"leg");
        }
      }
    }
    if (helmet.current) {
      helmet.current.visible = riding; const head = rig.bones.get("Bip01_Head");
      if (head && riding) {
        head.getWorldPosition(rig.head);head.getWorldQuaternion(rig.world);rig.world.multiply(rig.headBase);
        rig.helmetOffset.set(0,.20,0).applyQuaternion(rig.world);rig.head.add(rig.helmetOffset);root.current.worldToLocal(rig.head);helmet.current.position.copy(rig.head);
        root.current.getWorldQuaternion(rig.parent);helmet.current.quaternion.copy(rig.parent.invert().multiply(rig.world));
      }
    }
  }, -2);
  function limb(side: -1 | 1, kind: "arm" | "leg") {
    // 模型面向 +Z，外层翻向 -Z 后右肢位于 +X。
    const prefix = "Bip01_" + (side === 1 ? "R" : "L") + "_";
    const a = rig.bones.get(prefix + (kind === "arm" ? "UpperArm" : "Thigh"));
    const b = rig.bones.get(prefix + (kind === "arm" ? "Forearm" : "Calf"));
    const c = rig.bones.get(prefix + (kind === "arm" ? "Hand" : "Foot"));
    if (a && b && c) rig.ik.solve(a, b, c, rig.target, rig.pole);
  }
  return <group ref={root} name="visitor-athlete" visible={false}>
    <primitive object={rig.object} dispose={null} />
    <group ref={helmet} visible={false} raycast={() => {}}>
      <mesh scale={[.113, .079, .157]} castShadow><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#e4e9e8" roughness={.48} /></mesh>
      {[-1, 0, 1].map(i => <mesh key={i} position={[i * .046, .063, -.014]} rotation={[-.12, 0, 0]}><boxGeometry args={[.014, .013, .15]} /><meshStandardMaterial color="#273943" roughness={.7} /></mesh>)}
      {[-1,1].map(side=><mesh key={"strap"+side} position={[side*.093,-.073,0]} rotation={[.12,0,side*.22]}><cylinderGeometry args={[.003,.003,.14,6]}/><meshStandardMaterial color="#334751" roughness={.8}/></mesh>)}
    </group>
  </group>;
}
