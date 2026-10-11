import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, Bone, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, SRGBColorSpace, TextureLoader, Vector3, type BufferGeometry, type Texture } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { usePalaceStore } from "../../systems/store";
import { useActivity } from "../activity";
import { roadView, useRoadRide } from "../road/state";
import { getRideMap } from "../road/maps";
import { ATHLETE } from "./assets";
import { pedalPoint } from "./math";
import { presence, usePerspective, type AdventureRoom } from "./state";
import { LimbIK } from "./ik";
import { prepareShot, shotRecovery } from "./shotPose";
import { outfits, neutralProfile, useAppearance } from "./appearance";
import { dressAthlete, reshapeAthlete } from "./appearanceRig";
import { gripPoint, riderPosture } from "./riderPose";

export default function SportPresence({roomId}:{roomId:AdventureRoom}) {
  const head = useAppearance(s => s.personal ? s.head : null);
  return head ? <LocalHead roomId={roomId} url={head}/> : <SportAvatar roomId={roomId}/>;
}
function LocalHead({roomId,url}:{roomId:AdventureRoom;url:string}) {
  const [map,setMap] = useState<Texture|null>(null);
  useEffect(() => {
    let active=true;
    const owned=new TextureLoader().load(url,texture=>{if(!active){texture.dispose();return;}texture.colorSpace=SRGBColorSpace;texture.flipY=false;texture.needsUpdate=true;setMap(texture);},undefined,()=>{if(active)setMap(null);});
    // 专用本地贴图损坏时继续显示基础角色；不会让整个球场 / 路线陷入资源错误。
    return()=>{active=false;owned.dispose();};
  },[url]);
  return <SportAvatar roomId={roomId} headMap={map??undefined}/>;
}
function SportAvatar({ roomId, headMap }: { roomId: AdventureRoom; headMap?: Texture }) {
  const gltf = useGLTF(ATHLETE), root = useRef<Group>(null), helmet = useRef<Group>(null), cap = useRef<Group>(null), pack = useRef<Group>(null);
  const profile = useAppearance(s => s.personal && s.profile ? s.profile : neutralProfile), outfitId = useAppearance(s => s.selected[roomId]), outfit = outfits[outfitId];
  const rig = useMemo(() => {
    const object = clone(gltf.scene), bones = new Map<string, Bone>(), materials: Mesh["material"][] = [], geometries: BufferGeometry[] = [];
    object.traverse(child => {
      if (child instanceof Bone) bones.set(child.name, child);
      if (child instanceof Mesh) {
        child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
        if (headMap) for (const material of (Array.isArray(child.material)?child.material:[child.material])) if (material instanceof MeshStandardMaterial && /head/.test(material.name)) { material.map=headMap; material.normalScale.multiplyScalar(.35); }
        child.geometry = reshapeAthlete(child.geometry, profile); geometries.push(child.geometry); dressAthlete(child, profile, outfitId);
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
    const spineBase = bones.get("Bip01_Spine2")!.getWorldQuaternion(new Quaternion()).invert();
    return { object, bones, materials, geometries, mixer, actions, seatedBase, animatedBase, feet, hips, headBase, spineBase, helmetOffset:new Vector3(), yaw: 0, effort: 0, ik: new LimbIK(), target: new Vector3(), pole: new Vector3(), point: new Vector3(), tangent: new Vector3(), direction: new Vector3(), head: new Vector3(), tilt: new Quaternion(), world: new Quaternion(), parent: new Quaternion(), axis: new Vector3(1, 0, 0), palm: new Vector3(), fingers: new Vector3(), width: new Vector3(), handMatrix: new Matrix4() };
  }, [gltf, profile, outfitId, headMap]);
  useEffect(() => {
    // StrictMode 会重播 effect；清理后的同一实例必须重新激活动作，不能留下静止绑定姿态。
    rig.actions=gltf.animations.map(clip=>rig.mixer.clipAction(clip).reset().play().setEffectiveWeight(clip.name==="idle"?1:0));
    return () => {
      rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.object);
      rig.materials.flat().forEach(m => m.dispose());
      rig.geometries.forEach(g => g.dispose());
      rig.object.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
      // 仅销毁自有形变几何。GLTF 原几何 / 纹理继续共享；本地头图由 LocalHead 单独持有。
    };
  }, [rig,gltf]);
  useFrame((_, rawDelta) => {
    if (!root.current) return;
    const palace = usePalaceStore.getState(), ride = useRoadRide.getState(), third = usePerspective.getState().views[roomId] === "third";
    root.current.visible = third && !(roomId !== "basketball" && ride.photo);
    if (!root.current.visible) return;
    const riding = roomId !== "basketball" && ride.mounted;
    const blocked = !palace.started || !!palace.overlay || !!palace.focus || palace.mode === "index" || useActivity.getState().warming || document.hidden;
    // 换装使用原 settings 门控暂停物理；允许以零时间恢复新网格的当前 IK，避免换装时出现 T-pose。
    const dt = blocked ? 0 : Math.min(rawDelta, .06), speed = presence.speed;
    const authoredAction = !!presence.finishPose || presence.charge > 0 || presence.shot > 0;
    for (const action of rig.actions) {
      const weight = riding || authoredAction ? Number(action.getClip().name === "idle") : action.getClip().name === "idle" ? Number(speed < .12) : action.getClip().name === "walk" ? Number(speed >= .12 && speed < 3.5) : Number(speed >= 3.5);
      action.setEffectiveWeight(riding ? weight : action.getEffectiveWeight()+(weight-action.getEffectiveWeight())*(1-Math.exp(-dt*14)));
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
      rig.effort += (Math.min(1, roadView.cadence / 88) - rig.effort) * (1 - Math.exp(-dt * 5));
      const posture = riderPosture(outfit.bike, rig.effort, roadView.brake, roadView.pedalAngle, palace.reducedMotion || ride.comfort);
      rig.object.position.set(posture.hipShift, .065, .19); rig.object.rotation.y = Math.PI;
      // 躯干前倾、手握刹车罩，脚踝追随同一真实曲柄相位；不用独立的假踏频。
      root.current.updateWorldMatrix(true, true);
      for(const side of[-1,1]){const thigh=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Thigh")!,hip=rig.hips.get(side)!;thigh.getWorldPosition(hip.position);thigh.getWorldQuaternion(hip.quaternion);}
      rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);
      for (const [name, angle] of [["Bip01_Spine", posture.spine], ["Bip01_Spine1", posture.spine1], ["Bip01_Head", posture.head]] as const) {
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
        gripPoint(outfit.bike, side, roadView.steer, rig.target); root.current.localToWorld(rig.target);
        rig.pole.set(side * .42, outfit.bike === "city" ? 1.12 : 1.10, -.25); root.current.localToWorld(rig.pole);
        limb(side, "arm");
        pedalPoint(side, roadView.pedalAngle, rig.target); rig.target.y += .118; root.current.localToWorld(rig.target);
        rig.pole.set(side * .21, .6, -.42); root.current.localToWorld(rig.pole); limb(side, "leg");
        const foot=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!;
        root.current.getWorldQuaternion(rig.world);rig.world.multiply(rig.feet.get(side)!);foot.parent!.getWorldQuaternion(rig.parent);
        foot.quaternion.copy(rig.parent.invert().multiply(rig.world));foot.updateWorldMatrix(true,true);
        rotateBody(foot.name, posture.ankle * side, 1, 0, 0);
      }
    } else {
      presence.camera.getWorldDirection(rig.direction);
      root.current.position.set(presence.camera.position.x, presence.camera.position.y - 1.65 + presence.jump, presence.camera.position.z);
      const facing = Math.atan2(-rig.direction.x, -rig.direction.z);
      const moving = speed > .3 && !authoredAction ? Math.atan2(-presence.velocity.x, -presence.velocity.z) : facing;
      const heading = facing + Math.max(-.65, Math.min(.65, Math.atan2(Math.sin(moving - facing), Math.cos(moving - facing))));
      rig.yaw = blocked ? heading : rig.yaw + Math.atan2(Math.sin(heading - rig.yaw), Math.cos(heading - rig.yaw)) * (1 - Math.exp(-dt * 18));
      root.current.rotation.set(0, rig.yaw, 0);
      rig.object.position.set(0, 0, 0); rig.object.rotation.y = Math.PI; root.current.updateWorldMatrix(true, true);
      const finishPose = presence.finishPose, prep = prepareShot(presence.charge), recovery = shotRecovery(presence.shot, presence.shotJump);
      if (authoredAction) {
        rotateBody("Bip01_Spine", finishPose?.torsoPitch ?? (presence.shot > 0 ? .03 * recovery.reach : prep.pitch), 1, 0, 0);
        if (finishPose) rotateBody("Bip01_Spine1", finishPose.torsoTwist, 0, 1, 0);
      } else if (presence.dribbling) {
        rotateBody("Bip01_Spine", -.08 - Math.min(.08, speed * .014), 1, 0, 0);
      }
      if (presence.held || presence.finish !== "idle" || presence.shot>0) {
        if(presence.held)rig.target.copy(presence.ball);
        else if (finishPose) rig.target.set(finishPose.ball.x, finishPose.ball.y, finishPose.ball.z);
        else {
          rig.target.copy(presence.releaseHand); rig.head.set(presence.hand * .18, 1.03, -.23); root.current.localToWorld(rig.head);
          rig.target.lerp(rig.head, 1 - recovery.reach);
        }
        rig.target.y -= presence.dribbling ? -.075 : .115;
        rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld); rig.target.addScaledVector(rig.axis,-presence.hand*.025);
        rig.pole.set(presence.hand * (authoredAction ? .34 : .52), 1.02, -.38); root.current.localToWorld(rig.pole); limb(presence.hand as -1 | 1, "arm");
        orientPalm(presence.hand as -1|1, presence.dribbling);
        if (authoredAction) rotateBody("Bip01_" + (presence.hand > 0 ? "R" : "L") + "_Hand", -.42 * (finishPose?.wrist ?? recovery.wrist), 1, 0, 0);
        if (!presence.dribbling) {
          const guide = finishPose?.guide ?? (presence.shot > 0 ? recovery.guide : 1);
          if (presence.held) rig.target.copy(presence.ball);
          else if (finishPose) rig.target.set(finishPose.ball.x, finishPose.ball.y, finishPose.ball.z);
          else rig.target.copy(presence.releaseHand);
          rig.target.y -= .03;
          rig.head.set(-presence.hand * .48, 1.13, -.14); root.current.localToWorld(rig.head);
          rig.target.lerp(rig.head, 1 - guide);
          rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld); rig.target.addScaledVector(rig.axis,-presence.hand*.14*guide);
          rig.pole.set(-presence.hand * .50, 1.02, -.24); root.current.localToWorld(rig.pole); limb(-presence.hand as -1 | 1, "arm");
          orientPalm(-presence.hand as -1|1,false);
        }
      }
      if (finishPose || presence.charge > 0 || presence.shot > 0) {
        for(const side of [-1,1] as const){
          if (finishPose) { const foot = side === 1 ? finishPose.rightFoot : finishPose.leftFoot; rig.target.set(foot.x, foot.y, foot.z); }
          else { rig.target.set(side * .13, .095 + Math.max(0, presence.jump) * .06, side === presence.hand ? -.075 : .075); root.current.localToWorld(rig.target); if (presence.jump < 0) rig.target.y -= presence.jump; }
          rig.pole.set(side*.2,.65,-.40);root.current.localToWorld(rig.pole);limb(side,"leg");
          const foot = rig.bones.get("Bip01_" + (side === 1 ? "R" : "L") + "_Foot")!;
          root.current.getWorldQuaternion(rig.world); rig.world.multiply(rig.feet.get(side)!); foot.parent!.getWorldQuaternion(rig.parent);
          foot.quaternion.copy(rig.parent.invert().multiply(rig.world)); foot.updateWorldMatrix(true, true);
        }
      }
    }
    // 在原骨骼与 IK 上补掌面朝向 / 指节小幅握持；没有独立动作钟，也不改变球的物理坐标。
    for (const side of [-1,1]) {
      const grip = riding ? .68 : presence.held && !presence.dribbling ? .20 : 0;
      for (let finger=1;finger<=4;finger++) for (let joint=0;joint<=2;joint++) {
        const bone = rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Finger"+finger+(joint||""));
        if (bone) bone.quaternion.multiply(rig.tilt.setFromAxisAngle(rig.axis.set(0,0,1),grip*(joint===0?.26:joint===1?.42:.30)));
      }
    }
    if (helmet.current) {
      helmet.current.visible = riding && outfit.bike === "road"; const head = rig.bones.get("Bip01_Head");
      if (head && riding) {
        head.getWorldPosition(rig.head);head.getWorldQuaternion(rig.world);rig.world.multiply(rig.headBase);
        rig.helmetOffset.set(0,.20,0).applyQuaternion(rig.world);rig.head.add(rig.helmetOffset);root.current.worldToLocal(rig.head);helmet.current.position.copy(rig.head);
        root.current.getWorldQuaternion(rig.parent);helmet.current.quaternion.copy(rig.parent.invert().multiply(rig.world));
      }
    }
    accessory(cap.current, "Bip01_Head", rig.headBase, [0, .178, 0], outfit.cap);
    accessory(pack.current, "Bip01_Spine2", rig.spineBase, [0, -.025, .168], outfit.backpack);
  }, -2);
  function rotateBody(name: string, angle: number, x: number, y: number, z: number) {
    const bone = rig.bones.get(name); if (!bone?.parent || !root.current) return;
    rig.axis.set(x, y, z).transformDirection(root.current.matrixWorld);
    bone.getWorldQuaternion(rig.world); rig.world.premultiply(rig.tilt.setFromAxisAngle(rig.axis, angle));
    bone.parent.getWorldQuaternion(rig.parent); bone.quaternion.copy(rig.parent.invert().multiply(rig.world)); bone.updateWorldMatrix(true, true);
  }
  function orientPalm(side: -1|1, dribble: boolean) {
    const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand"); if (!hand?.parent || !root.current) return;
    hand.getWorldPosition(rig.point);
    if (dribble) rig.palm.set(0,-1,0); else rig.palm.subVectors(presence.held?presence.ball:rig.target,rig.point).normalize();
    if (rig.palm.lengthSq()<.01) rig.palm.set(0,1,0);
    rig.palm.multiplyScalar(side); rig.fingers.copy(rig.direction).addScaledVector(rig.palm,-rig.direction.dot(rig.palm));
    if (rig.fingers.lengthSq()<.01) rig.fingers.set(0,0,-1).transformDirection(root.current.matrixWorld);
    rig.fingers.normalize(); rig.width.crossVectors(rig.fingers,rig.palm).normalize(); rig.palm.crossVectors(rig.width,rig.fingers);
    rig.handMatrix.makeBasis(rig.fingers,rig.palm,rig.width); rig.world.setFromRotationMatrix(rig.handMatrix); hand.parent.getWorldQuaternion(rig.parent);
    hand.quaternion.copy(rig.parent.invert().multiply(rig.world)); hand.updateWorldMatrix(true,true);
  }
  function accessory(group: Group | null, name: string, basis: Quaternion, offset: [number, number, number], visible: boolean) {
    if (!group || !root.current) return; group.visible = visible; const bone = rig.bones.get(name); if (!visible || !bone) return;
    bone.getWorldPosition(rig.head); bone.getWorldQuaternion(rig.world); rig.world.multiply(basis);
    rig.helmetOffset.set(...offset).applyQuaternion(rig.world); rig.head.add(rig.helmetOffset); root.current.worldToLocal(rig.head); group.position.copy(rig.head);
    root.current.getWorldQuaternion(rig.parent); group.quaternion.copy(rig.parent.invert().multiply(rig.world));
  }
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
    <group ref={cap} visible={false} name="visitor-cap" raycast={() => {}}>
      <mesh scale={[.109,.072,.115]} castShadow><sphereGeometry args={[1,24,12,0,Math.PI*2,0,Math.PI*.54]}/><meshStandardMaterial color="#6e644b" roughness={.92}/></mesh>
      <mesh position={[0,-.003,-.115]} scale={[.116,.007,.085]} castShadow><sphereGeometry args={[1,24,8]}/><meshStandardMaterial color="#635a42" roughness={.91}/></mesh>
      <mesh position={[0,.072,0]}><sphereGeometry args={[.007,8,6]}/><meshStandardMaterial color="#655c47" roughness={.9}/></mesh>
    </group>
    <group ref={pack} visible={false} name="visitor-daypack" raycast={() => {}}>
      <mesh scale={[.152,.205,.090]} castShadow><sphereGeometry args={[1,20,16]}/><meshStandardMaterial color="#242a2d" roughness={.91}/></mesh>
      <mesh position={[0,-.064,.070]} scale={[.120,.090,.050]} castShadow><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#30383c" roughness={.92}/></mesh>
      {[-1,1].map(side => <mesh key={side} position={[side*.105,.05,-.075]} rotation={[.24,0,side*-.10]}><boxGeometry args={[.025,.35,.012]}/><meshStandardMaterial color="#41494b" roughness={.94}/></mesh>)}
      <mesh position={[0,.086,.086]}><boxGeometry args={[.175,.005,.007]}/><meshStandardMaterial color="#84918e" metalness={.3} roughness={.55}/></mesh>
    </group>
  </group>;
}
