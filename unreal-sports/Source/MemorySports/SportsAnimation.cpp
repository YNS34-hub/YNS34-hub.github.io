#include "SportsAnimation.h"
#include "SportsCharacter.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimSequence.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Animation/AnimNode_SequencePlayer.h"
#include "Animation/AnimNodeSpaceConversions.h"
#include "AnimNodes/AnimNode_TwoWayBlend.h"
#include "BoneControllers/AnimNode_ModifyBone.h"
#include "BoneControllers/AnimNode_TwoBoneIK.h"

// 游戏线程只复制目标，动画工作线程只计算姿态，避免跨线程读取可变角色状态。
struct FSportsAnimationProxy : FAnimInstanceProxy
{
    FAnimNode_SequencePlayer_Standalone Idle, Walk, Run, Jump, Fall, Land;
    FAnimNode_TwoWayBlend WalkRun, Locomotion, AirPose, AirLocomotion, GroundPose;
    FAnimNode_ConvertLocalToComponentSpace ToComponent;
    FAnimNode_ModifyBone Pelvis, Spine, LeftClavicle, RightClavicle, LeftWrist, RightWrist;
    FAnimNode_ModifyBone Fingers[30];
    FAnimNode_TwoBoneIK LeftHand, RightHand, LeftFoot, RightFoot;
    FAnimNode_ConvertComponentToLocalSpace ToLocal;
    float SmoothedSpeed = 0;
    FVector LeftHandLocal = FVector::ZeroVector, RightHandLocal = FVector::ZeroVector;
    bool bHasHandTargets = false;
    bool bWasFalling = false;
    float LandAge = 1, LeftGrip = 0, RightGrip = 0;
    FSportsAnimationProxy(UAnimInstance *Instance) : FAnimInstanceProxy(Instance)
    {
        WalkRun.A.SetLinkNode(&Walk);
        WalkRun.B.SetLinkNode(&Run);
        Locomotion.A.SetLinkNode(&Idle);
        Locomotion.B.SetLinkNode(&WalkRun);
        AirPose.A.SetLinkNode(&Jump);
        AirPose.B.SetLinkNode(&Fall);
        AirLocomotion.A.SetLinkNode(&Locomotion);
        AirLocomotion.B.SetLinkNode(&AirPose);
        GroundPose.A.SetLinkNode(&AirLocomotion);
        GroundPose.B.SetLinkNode(&Land);
        ToComponent.LocalPose.SetLinkNode(&GroundPose);
        Pelvis.ComponentPose.SetLinkNode(&ToComponent);
        Spine.ComponentPose.SetLinkNode(&Pelvis);
        LeftClavicle.ComponentPose.SetLinkNode(&Spine);
        RightClavicle.ComponentPose.SetLinkNode(&LeftClavicle);
        RightHand.ComponentPose.SetLinkNode(&RightClavicle);
        LeftHand.ComponentPose.SetLinkNode(&RightHand);
        RightFoot.ComponentPose.SetLinkNode(&LeftHand);
        LeftFoot.ComponentPose.SetLinkNode(&RightFoot);
        LeftWrist.ComponentPose.SetLinkNode(&LeftFoot);
        RightWrist.ComponentPose.SetLinkNode(&LeftWrist);
        for (int I = 0; I < 30; ++I)
        {
            Fingers[I].ComponentPose.SetLinkNode(I ? &Fingers[I - 1] : &RightWrist);
            Fingers[I].RotationMode = BMM_Additive;
            Fingers[I].RotationSpace = BCS_BoneSpace;
            const TCHAR *Names[] = {TEXT("thumb"), TEXT("index"), TEXT("middle"), TEXT("ring"), TEXT("pinky")};
            Fingers[I].BoneToModify.BoneName = FName(*FString::Printf(TEXT("%s_%02d_%s"),
                Names[(I % 15) / 3], I % 3 + 1, I < 15 ? TEXT("l") : TEXT("r")));
        }
        ToLocal.ComponentPose.SetLinkNode(&Fingers[29]);
        Pelvis.BoneToModify.BoneName = TEXT("pelvis");
        Pelvis.TranslationMode = BMM_Additive;
        Pelvis.TranslationSpace = BCS_ComponentSpace;
        Pelvis.RotationMode = BMM_Ignore;
        Spine.BoneToModify.BoneName = TEXT("spine_02");
        Spine.RotationMode = BMM_Additive;
        Spine.RotationSpace = BCS_WorldSpace;
        for (auto *Clavicle : {&LeftClavicle, &RightClavicle})
        {
            Clavicle->RotationMode = BMM_Additive;
            Clavicle->RotationSpace = BCS_WorldSpace;
        }
        LeftClavicle.BoneToModify.BoneName = TEXT("clavicle_l");
        RightClavicle.BoneToModify.BoneName = TEXT("clavicle_r");
        for (auto *Wrist : {&LeftWrist, &RightWrist})
        {
            Wrist->RotationMode = BMM_Additive;
            Wrist->RotationSpace = BCS_BoneSpace;
        }
        LeftWrist.BoneToModify.BoneName = TEXT("hand_l");
        RightWrist.BoneToModify.BoneName = TEXT("hand_r");
        auto Setup = [](FAnimNode_TwoBoneIK &Node, const TCHAR *Bone) {
            Node.IKBone.BoneName = Bone;
            Node.EffectorLocationSpace = BCS_WorldSpace;
            Node.JointTargetLocationSpace = BCS_WorldSpace;
            Node.bAllowStretching = false;
            Node.bMaintainEffectorRelRot = true;
            Node.Alpha = 0;
        };
        Setup(LeftHand, TEXT("hand_l"));
        Setup(RightHand, TEXT("hand_r"));
        Setup(LeftFoot, TEXT("foot_l"));
        Setup(RightFoot, TEXT("foot_r"));
    }
    virtual FAnimNode_Base *GetCustomRootNode() override
    {
        return &ToLocal;
    }
    virtual void Initialize(UAnimInstance *Instance) override
    {
        auto *Animation = CastChecked<USportsAnimation>(Instance);
        Animation->Clips.Empty();
        for (const TCHAR *Path :
             {TEXT("/Game/Characters/Mannequins/Anims/Unarmed/MM_Idle.MM_Idle"),
              TEXT("/Game/Characters/Mannequins/Anims/Unarmed/Walk/MF_Unarmed_Walk_Fwd.MF_Unarmed_Walk_Fwd"),
              TEXT("/Game/Characters/Mannequins/Anims/Unarmed/Jog/MF_Unarmed_Jog_Fwd.MF_Unarmed_Jog_Fwd"),
              TEXT("/Game/Characters/Mannequins/Anims/Unarmed/Jump/MM_Jump.MM_Jump"),
              TEXT("/Game/Characters/Mannequins/Anims/Unarmed/Jump/MM_Fall_Loop.MM_Fall_Loop"),
              TEXT("/Game/Characters/Mannequins/Anims/Unarmed/Jump/MM_Land.MM_Land")})
            Animation->Clips.Add(LoadObject<UAnimSequence>(nullptr, Path));
        Idle.SetSequence(Animation->Clips[0]);
        Walk.SetSequence(Animation->Clips[1]);
        Run.SetSequence(Animation->Clips[2]);
        Jump.SetSequence(Animation->Clips[3]);
        Fall.SetSequence(Animation->Clips[4]);
        Land.SetSequence(Animation->Clips[5]);
        Idle.SetLoopAnimation(true);
        Walk.SetLoopAnimation(true);
        Run.SetLoopAnimation(true);
        Jump.SetLoopAnimation(false);
        Fall.SetLoopAnimation(true);
        Land.SetLoopAnimation(false);
        FAnimInstanceProxy::Initialize(Instance);
    }
    virtual void PreUpdate(UAnimInstance *Instance, float Dt) override
    {
        FAnimInstanceProxy::PreUpdate(Instance, Dt);
        auto *P = Cast<ASportsCharacter>(Instance->TryGetPawnOwner());
        if (!P)
            return;
        const float Speed = P->bCycling ? 0 : P->GetVelocity().Size2D();
        SmoothedSpeed = FMath::FInterpTo(SmoothedSpeed, Speed, Dt, 9);
        Locomotion.Alpha = FMath::Clamp(SmoothedSpeed / 115.f, 0.f, 1.f);
        WalkRun.Alpha = FMath::Clamp((SmoothedSpeed - 340.f) / 250.f, 0.f, 1.f);
        Walk.SetPlayRate(FMath::Clamp(SmoothedSpeed / 240.f, .7f, 1.5f));
        Run.SetPlayRate(FMath::Clamp(SmoothedSpeed / 520.f, .8f, 1.25f));
        const bool Falling = !P->bCycling && P->GetCharacterMovement()->IsFalling();
        if (Falling && !bWasFalling)
            Jump.SetAccumulatedTime(0);
        if (!Falling && bWasFalling)
        {
            Land.SetAccumulatedTime(0);
            LandAge = 0;
        }
        bWasFalling = Falling;
        LandAge += Dt;
        // 起跳、滞空和落地使用本机模板的连续片段；手臂随后独立求解，不回到外张姿势。
        AirLocomotion.Alpha = FMath::FInterpTo(AirLocomotion.Alpha, Falling ? 1.f : 0.f, Dt, 16);
        AirPose.Alpha = FMath::FInterpTo(AirPose.Alpha, P->GetVelocity().Z < 20 ? 1.f : 0.f, Dt, 10);
        GroundPose.Alpha = !P->bCycling && !Falling ?
            FMath::Sin(FMath::Clamp(LandAge / .3f, 0.f, 1.f) * PI) * .75f : 0.f;
        Pelvis.Alpha = 1;
        Pelvis.Translation = FVector(0, 0, P->bCycling ? -12.f : -P->PoseCrouch);
        Spine.Alpha = 1;
        const FVector Axis = P->GetActorRightVector();
        Spine.Rotation = FQuat(Axis, FMath::DegreesToRadians(
            P->bCycling ? (P->bSprintActive ? 33.f : 23.f) : P->PoseLean)).Rotator();
        const FVector Origin = P->GetActorLocation(), F = P->GetActorForwardVector(), R = P->GetActorRightVector();
        const FTransform PawnBasis = P->GetActorTransform();
        const FVector NextLeft = PawnBasis.InverseTransformPosition(P->LeftTarget);
        const FVector NextRight = PawnBasis.InverseTransformPosition(P->RightTarget);
        if (!bHasHandTargets)
        {
            LeftHandLocal = NextLeft;
            RightHandLocal = NextRight;
            bHasHandTargets = true;
        }
        // 在角色局部空间缓动目标，既让抬手/放手连续，也不在走动时拖住手臂。
        const float HandSpeed = P->Ball && P->Ball->bReleased ? 26.f : 22.f;
        LeftHandLocal = FMath::VInterpTo(LeftHandLocal, NextLeft, Dt, HandSpeed);
        RightHandLocal = FMath::VInterpTo(RightHandLocal, NextRight, Dt, HandSpeed);
        RightHand.Alpha = FMath::FInterpTo(RightHand.Alpha, P->RightIK, Dt, 18);
        LeftHand.Alpha = FMath::FInterpTo(LeftHand.Alpha, P->LeftIK, Dt, 18);
        RightHand.EffectorLocation = PawnBasis.TransformPosition(RightHandLocal);
        LeftHand.EffectorLocation = PawnBasis.TransformPosition(LeftHandLocal);
        const float LeftLift = FMath::SmoothStep(35.f, 80.f, float(LeftHandLocal.Z));
        const float RightLift = FMath::SmoothStep(35.f, 80.f, float(RightHandLocal.Z));
        const float ElbowHeight = P->ActiveAction >= 2 ? 58.f : 43.f;
        LeftClavicle.Alpha = RightClavicle.Alpha = P->bCycling ? 0.f : 1.f;
        LeftClavicle.Rotation = FQuat(F, FMath::DegreesToRadians(-9.f * LeftLift)).Rotator();
        RightClavicle.Rotation = FQuat(F, FMath::DegreesToRadians(9.f * RightLift)).Rotator();
        const auto Elbow = [&](float Sign, float Lift) {
            // 每只手独立选肘部极点：闲置手贴身下垂，发力手才向身体前上方抬起。
            return Origin + F * FMath::Lerp(12.f, 55.f, Lift) + R * (Sign * FMath::Lerp(28.f, 24.f, Lift)) +
                   FVector(0, 0, FMath::Lerp(20.f, ElbowHeight, Lift));
        };
        RightHand.JointTargetLocation = Elbow(1, RightLift);
        LeftHand.JointTargetLocation = Elbow(-1, LeftLift);
        LeftWrist.Alpha = !P->bCycling && P->ActiveAction && P->bLeftHand ? .8f * LeftLift : 0.f;
        RightWrist.Alpha = !P->bCycling && P->ActiveAction && !P->bLeftHand ? .8f * RightLift : 0.f;
        const bool Holding = P->Ball && !P->Ball->bReleased;
        LeftWrist.Rotation = RightWrist.Rotation = FQuat(FVector::RightVector,
            FMath::DegreesToRadians(Holding ? -18.f : 60.f)).Rotator();
        const bool BothHands = P->bCharging || (P->ActiveAction == 1 && Holding) ||
            (P->ActiveAction == 3 && P->DunkPack == 1 && Holding);
        const float NextLeftGrip = P->bCycling ? 1.f :
            (Holding && (P->bLeftHand || BothHands) ? .42f * P->LeftIK : .06f);
        const float NextRightGrip = P->bCycling ? 1.f :
            (Holding && (!P->bLeftHand || BothHands) ? .42f * P->RightIK : .06f);
        LeftGrip = FMath::FInterpTo(LeftGrip, NextLeftGrip, Dt, 16);
        RightGrip = FMath::FInterpTo(RightGrip, NextRightGrip, Dt, 16);
        for (int I = 0; I < 30; ++I)
        {
            const int Joint = I % 3, Finger = (I % 15) / 3;
            const float Grip = I < 15 ? LeftGrip : RightGrip;
            const float Angles[] = {36, 48, 26};
            const float Curl = Angles[Joint] * Grip * (Finger == 0 ? .55f : 1.f);
            // 两侧骨架的指节轴相反，沿局部 Y 轴求四元数能保持左右一致的向掌心弯曲。
            Fingers[I].Alpha = P->bDisableIK ? 0.f : 1.f;
            Fingers[I].Rotation = FQuat(FVector::RightVector, FMath::DegreesToRadians(Curl)).Rotator();
        }
        RightFoot.Alpha = LeftFoot.Alpha = P->bCycling ? 1.f : 0.f;
        if (P->bCycling && P->Bike)
        {
            const auto Transform = P->Bike->GetActorTransform();
            const double A = P->PedalAngle;
            LeftHand.Alpha = RightHand.Alpha = 1;
            LeftHand.EffectorLocation = P->LeftTarget;
            RightHand.EffectorLocation = P->RightTarget;
            LeftHand.JointTargetLocation = Origin + F * 27 - R * 34 + FVector(0, 0, 15);
            RightHand.JointTargetLocation = Origin + F * 27 + R * 34 + FVector(0, 0, 15);
            LeftFoot.EffectorLocation = Transform.TransformPosition(FVector(-8 - 17 * cos(A), -12, -56 - 17 * sin(A)));
            RightFoot.EffectorLocation = Transform.TransformPosition(FVector(-8 + 17 * cos(A), 12, -56 + 17 * sin(A)));
            LeftFoot.JointTargetLocation = Origin + F * 80 - R * 22;
            RightFoot.JointTargetLocation = Origin + F * 80 + R * 22;
        }
        else if (P->bCharging || P->ActiveAction >= 2)
        {
            LeftFoot.Alpha = RightFoot.Alpha = 1;
            const float Lift = P->ActiveAction >= 2 ?
                FMath::Sin(FMath::Clamp((P->FinishPhase - .25f) / .75f, 0.f, 1.f) * PI) : 0.f;
            LeftFoot.EffectorLocation = Origin - R * 15 - F * (15 * Lift) + FVector(0, 0, -83 + 17 * Lift);
            RightFoot.EffectorLocation = Origin + R * 15 + F * (35 * Lift) + FVector(0, 0, -83 + 42 * Lift);
            LeftFoot.JointTargetLocation = Origin + F * 85 - R * 22;
            RightFoot.JointTargetLocation = Origin + F * 85 + R * 22;
        }
        if (P->bDisableIK)
        {
            Pelvis.Alpha = Spine.Alpha = LeftHand.Alpha = RightHand.Alpha = LeftFoot.Alpha = RightFoot.Alpha = 0;
            LeftWrist.Alpha = RightWrist.Alpha = 0;
            LeftClavicle.Alpha = RightClavicle.Alpha = 0;
        }
    }
};
FAnimInstanceProxy *USportsAnimation::CreateAnimInstanceProxy()
{
    return new FSportsAnimationProxy(this);
}
void USportsAnimation::DestroyAnimInstanceProxy(FAnimInstanceProxy *Proxy)
{
    delete static_cast<FSportsAnimationProxy *>(Proxy);
}
