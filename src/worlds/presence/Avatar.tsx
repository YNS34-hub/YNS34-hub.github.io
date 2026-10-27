import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, Bone, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, SRGBColorSpace, TextureLoader, Vector3, type BufferGeometry, type Texture } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { usePalaceStore } from "../../systems/store";
import { useActivity } from "../activity";
import { roadView, useRoadRide } from "../road/state";
import { getRideMap } from "../road/maps";
import { ATHLETE,ATHLETE_DETAIL } from "./assets";
import { pedalPoint } from "./math";
import { presence, usePerspective, type AdventureRoom } from "./state";
import { LimbIK } from "./ik";
import { prepareShot, shotRecovery, shotFollowThroughTarget,shotGuideTarget,shotGuideWristDrop } from "./shotPose";
import { outfits, neutralProfile, useAppearance } from "./appearance";
import { dressAthlete, reshapeAthlete } from "./appearanceRig";
import { ankleFromContact, gripPoint, riderAnkle, riderPosture } from "./riderPose";
import {createRiderOutline} from "./riderOutline";
import {useAlpineVisuals} from "../alpine/visualPreferences";
import {motionPacks} from "../court/motionPacks";
import {useCourtPackages} from "../court/packagePreferences";
import {installBasketballAppearance} from "./basketballAppearance";
import {createBasketballFootwork,sampleShotFootwork,shotFootSettleTarget} from "./basketballFootwork";
import {sampleDribbleHandRotation,dribbleWristTarget,dribblePalmPoint,advanceDribbleHandRotation,sampleDribbleElbowPole} from "./dribblePalm";
import {sampleShotHandRotation} from "./shotHandRotation";
import {createCourtWristFrame,advanceCourtHandRotation} from './courtHandRotation';
import {advanceCourtFingerGrip} from './courtFingerGrip';
import {blendDribbleArmTarget,blendDribbleArmRotation} from "./dribbleArm";
import {captureAnimationContinuity,createAnimationContinuity,restoreAnimationContinuity} from "./animationContinuity";
import {blendShotGather} from "./shotGather";
import {createCourtLocomotion,sampleCourtLocomotion,dribbleLegWindow,sampleDribbleKneePole,sampleCourtClipWeights,advanceCourtTravel} from "./courtLocomotion";
import {dribbleRecoveryWindow} from "./dribblePose";
import {advanceCourtTorso,createCourtTorso} from './courtTorso';
import CourtFootContact from './CourtFootContact';

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
  const continuity=useMemo(createAnimationContinuity,[]),restoredMixer=useRef<AnimationMixer|null>(null);
  const torsoTarget=useMemo(createCourtTorso,[]);
  const courtClipWeights=useMemo(()=>({idle:1,walk:0,run:0}),[]);
  const quality=usePalaceStore(s=>s.effectiveQuality);
  const gltf = useGLTF(roomId==="basketball"&&quality!=="low"?ATHLETE_DETAIL:ATHLETE), root = useRef<Group>(null), helmet = useRef<Group>(null), cap = useRef<Group>(null), pack = useRef<Group>(null);
  const profile = useAppearance(s => s.personal && s.profile ? s.profile : neutralProfile), outfitId = useAppearance(s => s.selected[roomId]), outfit = outfits[outfitId];
  const rig = useMemo(() => {
    const object = clone(gltf.scene), bones = new Map<string, Bone>(), materials: Mesh["material"][] = [], geometries: BufferGeometry[] = [], textures=new Map<Texture,Texture>();
    object.traverse(child => {
      if (child instanceof Bone) bones.set(child.name, child);
      if (child instanceof Mesh) {
        child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
        if (headMap) for (const material of (Array.isArray(child.material)?child.material:[child.material])) if (material instanceof MeshStandardMaterial && /head/.test(material.name)) { material.map=headMap; material.normalScale.multiplyScalar(.35); }
        // 缓存的 GLTF 贴图不被改写；自有取样副本共用解码图像，卸载不会销毁其他角色的资源。
        for(const material of Array.isArray(child.material)?child.material:[child.material])if(material instanceof MeshStandardMaterial){
          for(const key of ['map','normalMap'] as const){const source=material[key];if(source){let owned=textures.get(source);if(!owned){owned=source.clone();owned.anisotropy=8;owned.needsUpdate=true;textures.set(source,owned);}material[key]=owned;}}
          material.normalScale.multiplyScalar(1.35);
        }
        child.geometry = reshapeAthlete(child.geometry, profile); geometries.push(child.geometry); dressAthlete(child, profile, outfitId);
        materials.push(child.material); child.castShadow = true; child.receiveShadow = true; child.raycast = () => {};
      }
    });
    const basketballAppearance=roomId==="basketball"?installBasketballAppearance(object,{outfitId,personalHead:!!headMap}):null;
    const outline=createRiderOutline(roomId==="basketball"?.28:1.1),skinned:SkinnedMesh[]=[];
    object.traverse(child=>{if(child instanceof SkinnedMesh&&!(Array.isArray(child.material)?child.material:[child.material]).every(material=>material.name==='m026_hair'))skinned.push(child);});
    // 先收集再添加壳体，避免 traverse 把新壳体再次当作主体而无限递归。
    if(outline)for(const mesh of skinned)outline.attach(mesh);
    const mixer = new AnimationMixer(object);
    const actions = gltf.animations.map(clip => mixer.clipAction(clip).play().setEffectiveWeight(clip.name === "idle" ? 1 : 0));
    mixer.setTime(.1); object.rotation.y=Math.PI; object.updateWorldMatrix(true,true);
    const seatedBase=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
    const animatedBase=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
    const feet=new Map([-1,1].map(side=>[side,bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!.getWorldQuaternion(new Quaternion())]));
    const soles=new Map([-1,1].map(side=>[side,new Vector3(0,-.112,-.064).applyQuaternion(feet.get(side)!.clone().invert())]));
    const hips=new Map([-1,1].map(side=>[side,{position:new Vector3(),quaternion:new Quaternion()}]));
    const animatedArms=new Map([-1,1].map(side=>[side,{wrist:new Vector3(),elbow:new Vector3(),rotation:new Quaternion()}]));
    const wristFrames=new Map([-1,1].map(side=>[side,createCourtWristFrame()]));
    const dribbleArmEntry={left:new Vector3(),right:new Vector3(),leftElbow:new Vector3(),rightElbow:new Vector3(),origin:new Vector3(),elapsed:0};
    const headBase=bones.get("Bip01_Head")!.getWorldQuaternion(new Quaternion()).invert();
    const spineBase = bones.get("Bip01_Spine2")!.getWorldQuaternion(new Quaternion()).invert();
    return { wristFrames,dribbleArmEntry,animatedArms,basketballAppearance, shotFeet:createBasketballFootwork(),shotFadeActive:false,shotFadeLeft:new Vector3(),shotFadeRight:new Vector3(),shotFadeOrigin:new Vector3(),shotFadeRemaining:0,leftGait:createCourtLocomotion(),rightGait:createCourtLocomotion(),gaitActive:false, object, bones, materials, geometries, textures, mixer, actions, seatedBase, animatedBase, feet, soles, outline, guideRest:new Quaternion(),dribbleOrientationActive:false,dribbleLeftRotation:new Quaternion(),dribbleRightRotation:new Quaternion(),footWorld:new Quaternion(), contact:new Vector3(), hips, headBase, spineBase, helmetOffset:new Vector3(), yaw: 0, effort: 0, ik: new LimbIK(), target: new Vector3(), pole: new Vector3(), point: new Vector3(), tangent: new Vector3(), direction: new Vector3(), head: new Vector3(), tilt: new Quaternion(), world: new Quaternion(), parent: new Quaternion(), axis: new Vector3(1, 0, 0), palm: new Vector3(), fingers: new Vector3(), width: new Vector3(), handMatrix: new Matrix4() };
  }, [gltf, profile, outfitId, headMap,roomId]);
  useEffect(() => {
    // StrictMode 会重播 effect；清理后的同一实例必须重新激活动作，不能留下静止绑定姿态。
    rig.basketballAppearance?.activate();rig.outline?.activate();
    rig.actions=gltf.animations.map(clip=>rig.mixer.clipAction(clip).reset().play().setEffectiveWeight(clip.name==="idle"?1:0));
    restoredMixer.current=null;
    return () => {
      rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.object);
      rig.outline?.dispose();rig.basketballAppearance?.dispose();
      rig.materials.flat().forEach(m => m.dispose());
      rig.textures.forEach(texture=>texture.dispose());
      rig.geometries.forEach(g => g.dispose());
      rig.object.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
      // 仅销毁自有形变几何。GLTF 原几何 / 纹理继续共享；本地头图由 LocalHead 单独持有。
    };
  }, [rig,gltf]);
  useFrame((_, rawDelta) => {
    if (!root.current) return;
    const palace = usePalaceStore.getState(), ride = useRoadRide.getState(), third = usePerspective.getState().views[roomId] === "third";
    root.current.visible = third && !(roomId !== "basketball" && ride.photo);
    if (!root.current.visible && roomId!=="basketball") return;
    if(root.current.visible)rig.outline?.update(_.gl,roomId!=="alpine-ride"||useAlpineVisuals.getState().outline);
    const riding = roomId !== "basketball" && ride.mounted;
    const blocked = !palace.started || !!palace.overlay || !!palace.focus || palace.mode === "index" || useActivity.getState().warming || document.hidden;
    // 换装使用原 settings 门控暂停物理；允许以零时间恢复新网格的当前 IK，避免换装时出现 T-pose。
    const dt = blocked ? 0 : Math.min(rawDelta, .06), speed = presence.speed;
    const authoredAction = !!presence.finishPose || presence.charge > 0 || presence.shot > 0;
    if(roomId==="basketball"){
      sampleCourtClipWeights(courtClipWeights,speed,authoredAction);
      presence.camera.getWorldDirection(rig.direction);
      advanceCourtTravel(presence.courtTravel,presence.velocity,rig.direction,dt,authoredAction);
    }
    if(roomId==="basketball"&&restoredMixer.current!==rig.mixer){restoreAnimationContinuity(continuity,rig.mixer,rig.actions,rig.animatedBase);restoredMixer.current=rig.mixer;}
    for (const action of rig.actions) {
      const clipName=action.getClip().name;
      const weight = roomId==="basketball"?(clipName==="idle"?courtClipWeights.idle:clipName==="walk"?courtClipWeights.walk:courtClipWeights.run):riding || authoredAction ? Number(clipName === "idle") : clipName === "idle" ? Number(speed < .12) : clipName === "walk" ? Number(speed >= .12 && speed < 3.5) : Number(speed >= 3.5);
      action.setEffectiveWeight(riding ? weight : action.getEffectiveWeight()+(weight-action.getEffectiveWeight())*(1-Math.exp(-dt*14)));
      if (clipName !== "idle") action.setEffectiveTimeScale(Math.min(1.55, Math.max(.45, speed / (clipName === "run" ? 5.4 : 1.9)))*(roomId==="basketball"?presence.courtTravel.playback:1));
    }
    // 恒定时间的 Mixer 会跳过相同值，不能依赖它擦掉上一帧 IK；显式恢复骑姿基准后再解算。
    for(const [name,pose] of riding?rig.seatedBase:rig.animatedBase){const bone=rig.bones.get(name)!;bone.position.copy(pose.position);bone.quaternion.copy(pose.quaternion);}
    if(!riding){
      rig.mixer.update(dt);
      // IK 是动画之上的一层；保留未加约束的姿态，避免常量轨道把抬手或骑姿永久留在人物身上。
      for(const [name,pose] of rig.animatedBase){const bone=rig.bones.get(name)!;pose.position.copy(bone.position);pose.quaternion.copy(bone.quaternion);}
      if(roomId==="basketball")captureAnimationContinuity(continuity,rig.mixer,rig.actions,rig.animatedBase);
    }
    if (riding) {
      const map = getRideMap(roomId); map.sample(roadView.distance, rig.point, rig.tangent);
      const normal = Math.hypot(rig.tangent.x, rig.tangent.z);
      rig.point.x += -rig.tangent.z / normal * roadView.offset; rig.point.z += rig.tangent.x / normal * roadView.offset;
      const px=roadView.walkX+3.2,pz=roadView.walkZ-3.2,py=map.ground(px,pz),p=roadView.mountProgress,e=p*p*(3-2*p);
      rig.point.y+=.012;
      root.current.position.set(px+(rig.point.x-px)*e,py+(rig.point.y-py)*e,pz+(rig.point.z-pz)*e);
      const yaw=-.95+Math.atan2(Math.sin(roadView.yaw+.95),Math.cos(roadView.yaw+.95))*e;
      root.current.rotation.set(Math.atan2(rig.tangent.y, normal)*e,yaw,-(roadView.lean+roadView.rock)*e,"YXZ");
      rig.effort += (Math.min(1, roadView.cadence / 88) - rig.effort) * (1 - Math.exp(-dt * 5));
      const posture = riderPosture(outfit.bike, rig.effort, roadView.brake, roadView.pedalAngle, palace.reducedMotion || ride.comfort,roadView.standing);
      rig.object.position.set(posture.hipShift, posture.hipBase+posture.hipRise, posture.hipForward); rig.object.rotation.y = Math.PI;
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
      // 看向路侧时头颈分担真实视线输入；不转动车身、不给默认骑姿叠加无关摇头循环。
      const glance=Math.max(-.8,Math.min(.8,roadView.headYaw));
      rotateBody("Bip01_Neck",glance*.28,0,1,0);rotateBody("Bip01_Head",glance*.50,0,1,0);
      // Rocketbox 的大腿挂在 Spine 下；腰部前倾时保留髋关节世界位置，随后只解算真实腿长。
      for(const side of[-1,1]){const thigh=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Thigh")!,hip=rig.hips.get(side)!;thigh.position.copy(thigh.parent!.worldToLocal(hip.position));thigh.parent!.getWorldQuaternion(rig.parent);thigh.quaternion.copy(rig.parent.invert().multiply(hip.quaternion));thigh.updateWorldMatrix(true,true);}
      root.current.updateWorldMatrix(true, true);
      for (const side of [-1, 1] as const) {
        gripPoint(outfit.bike, side, roadView.steer, rig.target); root.current.localToWorld(rig.target);
        // IK 终点是腕骨，刹车罩接触点是掌心；保留 gripPoint 的真实把位，补腕到掌的距离。
        if(outfit.bike==="road"){rig.point.set(0,.025,.035).applyAxisAngle(rig.axis.set(0,1,0),roadView.steer).transformDirection(root.current.matrixWorld).multiplyScalar(Math.hypot(.025,.035));rig.target.add(rig.point);}
        rig.pole.set(side * .42, outfit.bike === "city" ? 1.12 : 1.10, -.25); root.current.localToWorld(rig.pole);
        limb(side, "arm");
        if(import.meta.env.DEV){rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!.getWorldPosition(rig.point);root.current.userData[side===1?"rightWristError":"leftWristError"]=rig.point.distanceTo(rig.target);}
        // 手掌沿把位旋转，而不是保持站立动作的默认腕部朝向。
        rig.palm.set(0,-side,0).transformDirection(root.current.matrixWorld);
        rig.fingers.set(0,outfit.bike==="city"?-.10:-.28,-1).applyAxisAngle(rig.axis.set(0,1,0),roadView.steer).transformDirection(root.current.matrixWorld);
        orientHand(side);
        const ankle=riderAnkle(side,roadView.pedalAngle,rig.effort,palace.reducedMotion||ride.comfort);
        root.current.getWorldQuaternion(rig.footWorld);rig.footWorld.multiply(rig.feet.get(side)!);
        rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);rig.footWorld.premultiply(rig.tilt.setFromAxisAngle(rig.axis,ankle));
        pedalPoint(side, roadView.pedalAngle, rig.contact);root.current.localToWorld(rig.contact);
        ankleFromContact(rig.contact,rig.soles.get(side)!,rig.footWorld,rig.target);
        rig.pole.set(side * .21, .6, -.42); root.current.localToWorld(rig.pole); limb(side, "leg");
        const foot=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!;
        foot.parent!.getWorldQuaternion(rig.parent);
        foot.quaternion.copy(rig.parent.invert().multiply(rig.footWorld));foot.updateWorldMatrix(true,true);
        if(import.meta.env.DEV){foot.getWorldPosition(rig.point);rig.head.copy(rig.soles.get(side)!).applyQuaternion(rig.footWorld);rig.point.add(rig.head);root.current.userData[side===1?"rightSoleError":"leftSoleError"]=rig.point.distanceTo(rig.contact);}
      }
    } else {
      presence.camera.getWorldDirection(rig.direction);
      // 路线上步行眼高为 1.77 m；不能套用球场的 1.65 m，否则人物脚底悬空 12 cm。
      const finishPose = presence.finishPose, prep = prepareShot(presence.charge,motionPacks.shot[presence.shotPack]), recovery = shotRecovery(presence.shot,presence.shotJump,motionPacks.shot[presence.shotPack],presence.shotVerticalVelocity,presence.shotGuideAtRelease);
      const courtStance=roomId==="basketball"?(presence.finishPose?.stance??(presence.charge>0?Math.max(presence.shotStance*(1-presence.shotGather),prep.stance):presence.shot>0?presence.shotReleaseStance*recovery.reach:presence.dribbling?presence.dribbleStanceSeed+(presence.dribbleCrouch-presence.dribbleStanceSeed)*presence.dribbleBlend:presence.held?.08+(1-presence.holdBlend)*Math.max(0,presence.dribbleCrouch-.08):0)):0;
      presence.courtStance=courtStance;
      root.current.position.set(presence.camera.position.x,presence.camera.position.y-(roomId==="basketball"?1.65:1.77)+presence.jump-courtStance,presence.camera.position.z);
      const facing = Math.atan2(-rig.direction.x, -rig.direction.z);
      const travelDirection=roomId==="basketball"?presence.courtTravel.direction:1;
      const moving = speed > .3 && !authoredAction ? Math.atan2(-presence.velocity.x*travelDirection, -presence.velocity.z*travelDirection) : facing;
      const heading = facing + Math.max(-.65, Math.min(.65, Math.atan2(Math.sin(moving - facing), Math.cos(moving - facing))));
      rig.yaw = blocked ? heading : rig.yaw + Math.atan2(Math.sin(heading - rig.yaw), Math.cos(heading - rig.yaw)) * (1 - Math.exp(-dt * 18));
      if(roomId==="basketball"&&(presence.held||authoredAction)){
        const turn=Math.atan2(Math.sin(facing-rig.yaw),Math.cos(facing-rig.yaw));
        if(Math.abs(turn)>.65)rig.yaw=facing-Math.max(-.65,Math.min(.65,turn));
      }
      root.current.rotation.set(0, rig.yaw, 0);
      rig.object.position.set(0, 0, 0); rig.object.rotation.y = Math.PI; root.current.updateWorldMatrix(true, true);
      const settlePitch=Math.min(1,Math.max(0,(.65-presence.shot)/.16)),pitchBlend=settlePitch*settlePitch*(3-2*settlePitch);
      const torso=presence.courtTorso;
      if(roomId==="basketball"){
        if(authoredAction){
          const upper=presence.shot>0?prepareShot(presence.shotChargeAtRelease,motionPacks.shot[presence.shotPack]):prep;
          const upperBlend=presence.shot>0?recovery.reach:1;
          torsoTarget.pitch=finishPose?.torsoPitch??(presence.shot>0?presence.shotReleasePitch*(1-pitchBlend)+.03*recovery.reach*pitchBlend:prep.pitch);
          torsoTarget.turn=finishPose?.torsoTwist??presence.hand*upper.turn*upperBlend;
          torsoTarget.roll=finishPose?0:presence.hand*upper.roll*upperBlend;
        }else if(presence.held&&presence.dribbling){
          torsoTarget.pitch=presence.dribbleTorso;torsoTarget.turn=presence.dribbleTwist;
          torsoTarget.roll=-presence.hand*.024*dribbleRecoveryWindow(presence.dribblePhase);
        }else{
          torsoTarget.pitch=0;torsoTarget.turn=0;torsoTarget.roll=0;
        }
        advanceCourtTorso(torso,torsoTarget,dt);
        if(import.meta.env.DEV)root.current.userData.basketballTorso=torso;
      }
      const torsoActive=roomId==="basketball"&&(authoredAction||presence.held||Math.abs(torso.pitch)+Math.abs(torso.turn)+Math.abs(torso.roll)>1e-7);
      if(torsoActive)for(const side of[-1,1]){const thigh=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Thigh")!,hip=rig.hips.get(side)!;thigh.getWorldPosition(hip.position);thigh.getWorldQuaternion(hip.quaternion);}
      if(torsoActive){
        rotateBody("Bip01_Spine",torso.pitch,1,0,0);
        rotateBody("Bip01_Spine1",torso.turn+(presence.held||authoredAction?Math.atan2(Math.sin(facing-rig.yaw),Math.cos(facing-rig.yaw)):0),0,1,0);
        rotateBody("Bip01_Spine2",torso.roll,0,0,1);
      }else if (authoredAction) {
        rotateBody("Bip01_Spine", finishPose?.torsoPitch ?? (presence.shot > 0 ? presence.shotReleasePitch*(1-pitchBlend)+.03*recovery.reach*pitchBlend : prep.pitch), 1, 0, 0);
        rotateBody("Bip01_Spine1",(finishPose?.torsoTwist??0)+Math.atan2(Math.sin(facing-rig.yaw),Math.cos(facing-rig.yaw)),0,1,0);
      }
      if(torsoActive)for(const side of[-1,1]){const thigh=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Thigh")!,hip=rig.hips.get(side)!;thigh.position.copy(thigh.parent!.worldToLocal(hip.position));thigh.parent!.getWorldQuaternion(rig.parent);thigh.quaternion.copy(rig.parent.invert().multiply(hip.quaternion));thigh.updateWorldMatrix(true,true);}
      if(roomId==="basketball"&&(presence.held||authoredAction)){
        const look=Math.max(-.20,Math.min(.26,Math.asin(Math.max(-1,Math.min(1,rig.direction.y)))));
        // Eyes remain on the play; the head follows the aimed rim rather than the bouncing ball.
        const counterPitch=authoredAction?0:-torso.pitch;
        rotateBody("Bip01_Neck",look*.22+counterPitch*.35,1,0,0);rotateBody("Bip01_Head",look*.52+counterPitch*.50,1,0,0);
        rotateBody("Bip01_Neck",-torso.roll*.25,0,0,1);rotateBody("Bip01_Head",-torso.roll*.55,0,0,1);
      }
      let armFacing=facing;
      if(roomId==="basketball"&&presence.dribbling&&presence.held){
        rig.bones.get('Bip01_L_UpperArm')!.getWorldPosition(rig.head);rig.bones.get('Bip01_R_UpperArm')!.getWorldPosition(rig.point);
        armFacing=Math.atan2(rig.head.z-rig.point.z,rig.point.x-rig.head.x);
      }
      if(!presence.dribbling||!presence.held)rig.dribbleOrientationActive=false;
      if (presence.held || presence.finish !== "idle" || presence.shot>0) {
        if(presence.dribbling&&presence.held){
          if(!rig.dribbleOrientationActive){
            rig.dribbleLeftRotation.copy(presence.leftWristRotation);rig.dribbleRightRotation.copy(presence.rightWristRotation);rig.dribbleOrientationActive=true;
            rig.dribbleArmEntry.left.copy(presence.leftWrist);rig.dribbleArmEntry.right.copy(presence.rightWrist);rig.dribbleArmEntry.origin.copy(presence.camera.position);rig.dribbleArmEntry.elapsed=0;
            rig.dribbleArmEntry.leftElbow.copy(presence.leftElbow);rig.dribbleArmEntry.rightElbow.copy(presence.rightElbow);
          }
          rig.dribbleArmEntry.elapsed=Math.min(.18,rig.dribbleArmEntry.elapsed+dt);
          const enter=rig.dribbleArmEntry.elapsed/.18,armBlend=Math.min(presence.dribbleBlend,enter*enter*(3-2*enter));
          // Capture both arms before either IK solve. Their idle/walk/run pose
          // already follows the real mixer clock, torso and lowered body root.
          for(const side of[-1,1]){
            const base=rig.animatedArms.get(side)!,prefix="Bip01_"+(side===1?"R":"L")+"_";
            rig.bones.get(prefix+"Hand")!.getWorldPosition(base.wrist);rig.bones.get(prefix+"Hand")!.getWorldQuaternion(base.rotation);
            rig.bones.get(prefix+"Forearm")!.getWorldPosition(base.elbow);
          }
          for(const side of [-1,1]as const){
            const base=rig.animatedArms.get(side)!,influence=side<0?presence.dribbleLeftInfluence:presence.dribbleRightInfluence;
            orientPalm(side,true,dt,armFacing);
            const rotation=side<0?rig.dribbleLeftRotation:rig.dribbleRightRotation;
            dribbleWristTarget(rig.head,presence.dribbleContactPalm,rotation);
            blendDribbleArmTarget(rig.target,base.wrist,rig.head,influence);
            rig.head.copy(side===-1?rig.dribbleArmEntry.left:rig.dribbleArmEntry.right).add(presence.camera.position).sub(rig.dribbleArmEntry.origin);rig.target.lerp(rig.head,1-armBlend);
            rig.bones.get("Bip01_"+(side===1?"R":"L")+"_UpperArm")!.getWorldPosition(rig.point);
            sampleDribbleElbowPole(rig.pole,side,presence.dribblePhase,presence.dribbleMove==="between-legs"||presence.dribbleMove==="behind-back",dribbleRecoveryWindow(presence.dribblePhase),rig.point,armFacing);
            rig.head.copy(rig.pole);blendDribbleArmTarget(rig.pole,base.elbow,rig.head,influence);
            rig.head.copy(side<0?rig.dribbleArmEntry.leftElbow:rig.dribbleArmEntry.rightElbow).add(presence.camera.position).sub(rig.dribbleArmEntry.origin);rig.pole.lerp(rig.head,1-armBlend);
            if(influence>0||armBlend<1)limb(side,"arm");
            const handBone=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!;
            handBone.parent!.getWorldQuaternion(rig.parent);handBone.quaternion.copy(rig.parent.invert().multiply(rotation));handBone.updateWorldMatrix(true,true);
            handBone.getWorldPosition(rig.point);dribblePalmPoint(side<0?presence.dribbleLeftPalm:presence.dribbleRightPalm,rig.point,rotation);
            if(import.meta.env.DEV){const key=side<0?"basketballLeftAnimatedArm":"basketballRightAnimatedArm";root.current.userData[key]=base;}
            if(import.meta.env.DEV){rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!.getWorldPosition(rig.point);root.current.userData[side===1?"basketballRightWristError":"basketballLeftWristError"]=rig.point.distanceTo(rig.target);}
          }
          if(import.meta.env.DEV)root.current.userData.basketballDribbleArmBlend=armBlend;
          presence.dribblePalm.copy(presence.hand<0?presence.dribbleLeftPalm:presence.dribbleRightPalm);
        }else{
          const guide=finishPose?.guide??(presence.shot>0?recovery.guide:prep.guide),twoHands=finishPose?.twoHands??(presence.held&&presence.charge===0?1:0);
          for(const side of [-1,1]as const){
            if(presence.held)rig.target.copy(presence.charge>0&&presence.shotGather<1?presence.shotBallTarget:presence.ball);
            else if(finishPose)rig.target.set(finishPose.ball.x,finishPose.ball.y,finishPose.ball.z);
            else shotFollowThroughTarget(rig.target,presence.releaseHand,presence.releaseBody,presence.camera.position,presence.shotJump,presence.jump,presence.shotReleaseStance,courtStance);
            const dominant=side===presence.hand,follow=dominant?(presence.held||finishPose?1:recovery.reach):guide;
            const guideRelease=!presence.held&&!finishPose&&!dominant&&presence.shot>0;
            rig.target.y-=dominant?.115:finishPose?.03:presence.charge>0?shotGuideWristDrop(prep.y):.13;
            rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);
            rig.target.addScaledVector(rig.axis,dominant?-presence.hand*.025:-presence.hand*.14*guide);
            if(twoHands>0){
              if(presence.held)rig.head.copy(presence.ball);else if(finishPose)rig.head.set(finishPose.ball.x,finishPose.ball.y,finishPose.ball.z);else rig.head.copy(presence.releaseHand);
              rig.head.y-=.045;rig.head.addScaledVector(rig.axis,side*(finishPose?.handSpread??motionPacks.hands[useCourtPackages.getState().packs.hands].spread));rig.target.lerp(rig.head,twoHands);
            }
            if(!presence.held&&!finishPose)rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!.getWorldPosition(rig.head);
            else{rig.head.set(side*.38,1.11,-.23);root.current.localToWorld(rig.head);}
            rig.target.lerp(rig.head,1-follow);
            if(finishPose&&!presence.held&&finishPose.elapsed>.95){const t=Math.min(1,(finishPose.elapsed-.95)/.35);rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!.getWorldPosition(rig.head);rig.target.lerp(rig.head,t*t*(3-2*t));}
            if(presence.held&&presence.holdBlend<1){rig.head.copy(side<0?presence.holdLeftSeed:presence.holdRightSeed).add(presence.camera.position).sub(presence.holdOrigin);rig.target.lerp(rig.head,1-presence.holdBlend);}
            if(finishPose&&finishPose.elapsed<.16){rig.head.copy(side<0?presence.finishLeftSeed:presence.finishRightSeed).add(presence.camera.position).sub(presence.finishOrigin);const t=finishPose.elapsed/.16;rig.target.lerp(rig.head,1-t*t*(3-2*t));}
            if(presence.charge>0&&presence.shotGather<1)blendShotGather(rig.target,side<0?presence.shotLeftSeed:presence.shotRightSeed,presence.shotOrigin,presence.camera.position,presence.shotGather*presence.shotGatherDuration,presence.shotGatherDuration);
            const shotRelease=!presence.held&&!finishPose&&presence.shot>0;
            if(shotRelease){
              const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!;
              hand.getWorldPosition(rig.head);hand.getWorldQuaternion(rig.guideRest);
              if(guideRelease)shotGuideTarget(rig.target,side<0?presence.shotReleaseLeftWrist:presence.shotReleaseRightWrist,presence.releaseBody,presence.camera.position,presence.shotJump,presence.jump,presence.shotReleaseStance,courtStance,rig.head,presence.shot);
            }
            rig.pole.set(side*(authoredAction?(dominant?.20:.36):roomId==="basketball"?.70:.50),authoredAction?1.12:1.02,-.32);root.current.localToWorld(rig.pole);limb(side,"arm");
            if(guideRelease){
              const t=Math.min(1,Math.max(0,(.65-presence.shot)/.24)),fade=t*t*(3-2*t);
              const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!;
              rig.world.copy(side<0?presence.shotReleaseLeftRotation:presence.shotReleaseRightRotation).slerp(rig.guideRest,fade);
              hand.parent!.getWorldQuaternion(rig.parent);hand.quaternion.copy(rig.parent.invert().multiply(rig.world));hand.updateWorldMatrix(true,true);
            }else if(shotRelease){
              const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!;
              rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);
              sampleShotHandRotation(rig.world,side<0?presence.shotReleaseLeftRotation:presence.shotReleaseRightRotation,rig.guideRest,rig.axis,presence.shot,recovery.wrist);
              hand.parent!.getWorldQuaternion(rig.parent);hand.quaternion.copy(rig.parent.invert().multiply(rig.world));hand.updateWorldMatrix(true,true);
            }else orientPalm(side,false);
            if(authoredAction&&dominant&&!shotRelease)rotateBody("Bip01_"+(side>0?"R":"L")+"_Hand",-.42*(finishPose?.wrist??recovery.wrist),1,0,0);
            if(import.meta.env.DEV){rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!.getWorldPosition(rig.point);root.current.userData[side===1?"basketballRightWristError":"basketballLeftWristError"]=rig.point.distanceTo(rig.target);}
          }
        }
      }
      if(import.meta.env.DEV&&roomId==="basketball")root.current.userData.basketballPackages={...useCourtPackages.getState().packs};
      if(roomId!=="basketball"||authoredAction||!presence.held&&speed<=.12)rig.gaitActive=false;
      if (finishPose || presence.charge > 0 || presence.shot > 0 || roomId==="basketball"&&(presence.dribbling||presence.held||presence.holdBlend<1||speed>.12)) {
        const shotFeet=roomId==="basketball"&&!finishPose&&(presence.charge>0||presence.shot>0)?sampleShotFootwork(rig.shotFeet,{charge:presence.charge,shotRemaining:presence.shot,releaseCharge:presence.shotChargeAtRelease,jump:presence.jump,stance:courtStance,hand:presence.hand,pack:motionPacks.shot[presence.shotPack],yaw:presence.shotFacing,origin:presence.shotFootOrigin,position:presence.camera.position,leftSeed:presence.shotLeftFootSeed,rightSeed:presence.shotRightFootSeed,landingOrigin:presence.shotLanded?presence.shotLandOrigin:presence.shotFootOrigin,floorY:.112}):null;
        if(!shotFeet||presence.charge>0||presence.shot<=0)rig.shotFadeActive=false;
        if(shotFeet&&presence.shot>0&&presence.shotLanded&&presence.shot<.16&&!rig.shotFadeActive){
          rig.shotFadeLeft.copy(presence.leftFoot);rig.shotFadeRight.copy(presence.rightFoot);
          rig.shotFadeOrigin.copy(presence.camera.position);rig.shotFadeRemaining=presence.shot;rig.shotFadeActive=true;
        }
        if(import.meta.env.DEV&&shotFeet)root.current.userData.basketballFootwork=shotFeet;
        const ordinary=roomId==="basketball"&&!authoredAction;
        const gap=presence.dribbling&&presence.dribbleMove==="between-legs"?dribbleLegWindow(presence.dribblePhase):0;
        for(const side of [-1,1] as const){
          if(shotFeet){
            const goal=side<0?shotFeet.left:shotFeet.right;
            rig.target.set(goal.x,goal.y,goal.z);
            const anchor=presence.shotLanded?presence.shotLandOrigin:presence.shotFootOrigin;
            const drift=Math.hypot(presence.camera.position.x-anchor.x,presence.camera.position.z-anchor.z);
            const blend=Math.max(0,Math.min(1,(drift-.18)/.26))*shotFeet.plantDriftWeight;
            if(blend>0){
              rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!.getWorldPosition(rig.head);
              rig.head.y+=courtStance-Math.min(0,presence.jump);rig.target.lerp(rig.head,blend);
            }
            // A single fade from the actual ankle avoids accelerating a moving
            // recovery target again. Horizontal body translation remains free.
            if(rig.shotFadeActive){
              rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!.getWorldPosition(rig.head);
              rig.head.y+=courtStance-Math.min(0,presence.jump);
              shotFootSettleTarget(rig.target,side<0?rig.shotFadeLeft:rig.shotFadeRight,rig.shotFadeOrigin,presence.camera.position,rig.head,presence.shot,rig.shotFadeRemaining);
            }
            // The development probe publishes the final applied ankle goal.
            goal.x=rig.target.x;goal.y=rig.target.y;goal.z=rig.target.z;
          }
          else if (finishPose) { const foot = side === 1 ? finishPose.rightFoot : finishPose.leftFoot; rig.target.set(foot.x, foot.y, foot.z); }
          else if(presence.dribbling||presence.held||presence.holdBlend<1||roomId==="basketball"&&speed>.12){rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Foot")!.getWorldPosition(rig.target);rig.target.y+=courtStance-Math.min(0,presence.jump);}
          else { rig.target.set(side * .13, .095 + Math.max(0, presence.jump) * .06, side === presence.hand ? -.075 : .075); root.current.localToWorld(rig.target);rig.target.y+=courtStance; if (presence.jump < 0) rig.target.y -= presence.jump; }
          if(ordinary){
            // The between-legs bounce uses the same phase as the physical ball.
            // Both ankles and the knee plane open before the ball reaches the floor.
            if(presence.held&&speed<.12||gap>0){
              rig.head.copy(rig.target);root.current.worldToLocal(rig.head);
              const width=gap>0?.28:presence.dribbling?.20:.18;
              const weight=gap>0?gap:1;
              rig.head.x+=(side*width-rig.head.x)*weight;
              if(presence.dribbleMove==="between-legs"&&speed<.12)rig.head.z+=((side===presence.hand?.12:-.12)-rig.head.z)*gap;
              root.current.localToWorld(rig.head);rig.target.copy(rig.head);
            }
            const gait=side<0?rig.leftGait:rig.rightGait;
            if(!rig.gaitActive){
              const actual=side<0?presence.leftFoot:presence.rightFoot;
              rig.head.set(actual.x-root.current.position.x,actual.y,actual.z-root.current.position.z);
              sampleCourtLocomotion(gait,rig.head,0,true);
            }
            rig.head.set(rig.target.x-root.current.position.x,rig.target.y,rig.target.z-root.current.position.z);
            sampleCourtLocomotion(gait,rig.head,dt);
            rig.target.set(gait.x+root.current.position.x,gait.y,gait.z+root.current.position.z);
          }
          if(ordinary)sampleDribbleKneePole(rig.pole,side,gap);else rig.pole.set(side*.2,.65,-.40);root.current.localToWorld(rig.pole);limb(side,"leg");
          const foot = rig.bones.get("Bip01_" + (side === 1 ? "R" : "L") + "_Foot")!;
          root.current.getWorldQuaternion(rig.world); rig.world.multiply(rig.feet.get(side)!);if(ordinary){const lift=Math.max(0,Math.min(1,(rig.target.y-.112)/.12));rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);rig.world.premultiply(rig.tilt.setFromAxisAngle(rig.axis,-(speed>3.5?.20:.12)*lift));}if(ordinary&&gap>0){rig.axis.set(0,1,0);rig.world.premultiply(rig.tilt.setFromAxisAngle(rig.axis,-side*.15*gap));}if(shotFeet){rig.axis.set(1,0,0).transformDirection(root.current.matrixWorld);rig.world.premultiply(rig.tilt.setFromAxisAngle(rig.axis,side<0?shotFeet.leftToe:shotFeet.rightToe));} foot.parent!.getWorldQuaternion(rig.parent);
          foot.quaternion.copy(rig.parent.invert().multiply(rig.world)); foot.updateWorldMatrix(true, true);
        }
        if(ordinary)rig.gaitActive=true;
      }
    }
    // Contact/release keeps its world target; empty hands follow their actual
    // forearms so turning the body cannot countertwist an otherwise idle wrist.
    if(roomId==="basketball")for(const side of[-1,1]as const){
      const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand")!;
      const frame=rig.wristFrames.get(side)!;hand.parent!.getWorldQuaternion(rig.parent);
      if(presence.dribbling&&presence.held){frame.parent.copy(rig.parent);frame.ready=true;frame.free=false;continue;}
      hand.getWorldQuaternion(rig.guideRest);rig.world.copy(side<0?presence.leftWristRotation:presence.rightWristRotation);
      advanceCourtHandRotation(rig.world,rig.guideRest,rig.parent,frame,!presence.held&&!authoredAction&&presence.finish==="idle",dt);
      hand.quaternion.copy(rig.parent.invert().multiply(rig.world));hand.updateWorldMatrix(true,true);
    }
    // 在原骨骼与 IK 上补掌面朝向 / 指节小幅握持；没有独立动作钟，也不改变球的物理坐标。
    if(roomId==="basketball")advanceCourtFingerGrip(presence.courtFingerGrip,presence,dt);
    for (const side of [-1,1]) {
      const grip = riding ? .68 : roomId==="basketball"?(side<0?presence.courtFingerGrip.left:presence.courtFingerGrip.right):presence.held&&!presence.dribbling?.20:0;
      for (let finger=1;finger<=4;finger++) for (let joint=0;joint<=2;joint++) {
        const bone = rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Finger"+finger+(joint||""));
        if (bone) bone.quaternion.multiply(rig.tilt.setFromAxisAngle(rig.axis.set(0,0,1),grip*(joint===0?.26:joint===1?.42:.30)*(riding?1:1+finger*.07)));
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
    if(roomId==="basketball"){rig.bones.get("Bip01_L_Forearm")!.getWorldPosition(presence.leftElbow);rig.bones.get("Bip01_R_Forearm")!.getWorldPosition(presence.rightElbow);}
    if(roomId==="basketball"){rig.bones.get("Bip01_L_Hand")!.getWorldQuaternion(presence.leftWristRotation);rig.bones.get("Bip01_R_Hand")!.getWorldQuaternion(presence.rightWristRotation);rig.bones.get("Bip01_L_Hand")!.getWorldPosition(presence.leftWrist);rig.bones.get("Bip01_R_Hand")!.getWorldPosition(presence.rightWrist);rig.bones.get("Bip01_L_Foot")!.getWorldPosition(presence.leftFoot);rig.bones.get("Bip01_R_Foot")!.getWorldPosition(presence.rightFoot);}
  }, -2);
  function rotateBody(name: string, angle: number, x: number, y: number, z: number) {
    const bone = rig.bones.get(name); if (!bone?.parent || !root.current) return;
    rig.axis.set(x, y, z).transformDirection(root.current.matrixWorld);
    bone.getWorldQuaternion(rig.world); rig.world.premultiply(rig.tilt.setFromAxisAngle(rig.axis, angle));
    bone.parent.getWorldQuaternion(rig.parent); bone.quaternion.copy(rig.parent.invert().multiply(rig.world)); bone.updateWorldMatrix(true, true);
  }
  function orientPalm(side: -1|1, dribble: boolean,dt=0,frameYaw=0) {
    const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand"); if (!hand?.parent || !root.current) return;
    if(dribble){sampleDribbleHandRotation(rig.world,side,presence.dribblePhase,frameYaw,rig.direction);applyHandRotation(side,true,dt);return;}
    hand.getWorldPosition(rig.point);
    {
      if(presence.held)rig.palm.subVectors(presence.ball,rig.point);
      else if(presence.finishPose)rig.palm.set(presence.finishPose.ball.x,presence.finishPose.ball.y,presence.finishPose.ball.z).sub(rig.point);
      else rig.palm.set(0,1,0);
      if(rig.palm.lengthSq()<1e-8)rig.palm.set(0,1,0);else rig.palm.normalize();
    }
    // Both athlete hands curl into local +Y; their bone transforms already mirror Z.
    if(roomId!=="basketball")rig.palm.multiplyScalar(side);
    rig.fingers.copy(rig.direction).addScaledVector(rig.palm,-rig.direction.dot(rig.palm));
    if (rig.fingers.lengthSq()<.01){
      const x=Math.abs(rig.palm.x),y=Math.abs(rig.palm.y),z=Math.abs(rig.palm.z);
      rig.fingers.set(x<=y&&x<=z?1:0,y<x&&y<=z?1:0,z<x&&z<y?1:0);
    }
    orientHand(side,dribble,dt);
  }
  function orientHand(side:-1|1,dribble=false,dt=0){
    const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand");if(!hand?.parent)return;
    rig.fingers.addScaledVector(rig.palm,-rig.fingers.dot(rig.palm)).normalize(); rig.width.crossVectors(rig.fingers,rig.palm).normalize(); rig.palm.crossVectors(rig.width,rig.fingers);
    rig.handMatrix.makeBasis(rig.fingers,rig.palm,rig.width); rig.world.setFromRotationMatrix(rig.handMatrix);
    applyHandRotation(side,dribble,dt);
  }
  function applyHandRotation(side:-1|1,dribble=false,dt=0){
    const hand=rig.bones.get("Bip01_"+(side===1?"R":"L")+"_Hand");if(!hand?.parent)return;
    if(dribble){
      const previous=side<0?rig.dribbleLeftRotation:rig.dribbleRightRotation,base=rig.animatedArms.get(side)!;
      rig.guideRest.copy(rig.world);blendDribbleArmRotation(rig.world,base.rotation,rig.guideRest,side<0?presence.dribbleLeftInfluence:presence.dribbleRightInfluence);
      advanceDribbleHandRotation(previous,rig.world,dt);rig.world.copy(previous);
    }
    hand.parent.getWorldQuaternion(rig.parent);
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
    if (a && b && c) rig.ik.solve(a, b, c, rig.target, rig.pole, roomId==="basketball"&&kind==="arm");
  }
  return <><group ref={root} name="visitor-athlete" visible={false}>
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
  </group>{roomId==='basketball'&&<CourtFootContact actor={root} bones={rig.bones}/>}</>;
}
