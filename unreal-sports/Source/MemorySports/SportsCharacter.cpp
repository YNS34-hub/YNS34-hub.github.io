#include "SportsCharacter.h"
#include "SportsWorld.h"
#include "SportsMath.h"
#include "SportsMotion.h"
#include "SportsAnimation.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InputComponent.h"
#include "PhysicsEngine/BodyInstance.h"
#include "PhysicalMaterials/PhysicalMaterial.h"
#include "Animation/AnimSequence.h"
#include "Kismet/GameplayStatics.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Engine/Engine.h"
#include "UnrealClient.h"
#include "Materials/MaterialInterface.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Sound/SoundBase.h"
#include "Components/AudioComponent.h"
#include "Engine/GameViewportClient.h"
#include "DynamicRHI.h"
#include "ImageUtils.h"
#include "Async/Async.h"
#include "HAL/ThreadSafeCounter.h"
#include "Modules/ModuleManager.h"

namespace
{
FThreadSafeCounter PendingSportsPhotos;
void ConfigureSportsPhotos()
{
    static FDelegateHandle Handle;
    if (Handle.IsValid())
        return;
    FModuleManager::LoadModuleChecked<IModuleInterface>(TEXT("ImageWrapper"));
    Handle = UGameViewportClient::OnScreenshotCaptured().AddLambda(
        [](int32 Width, int32 Height, const TArray<FColor> &Pixels) {
            const FString Filename = FScreenshotRequest::GetFilename();
            if (PendingSportsPhotos.Increment() > 3)
            {
                PendingSportsPhotos.Decrement();
                UE_LOG(LogTemp, Warning, TEXT("SPORTS_PHOTO_BUSY %s"), *Filename);
                return;
            }
            // 视口回读仍由引擎在渲染后完成；PNG 压缩和磁盘写入不能阻塞动作和物理帧。
            Async(EAsyncExecution::ThreadPool, [Width, Height, Filename, Copy = TArray<FColor>(Pixels)]() {
                TArray64<uint8> PNG;
                FImageUtils::PNGCompressImageArray(Width, Height, MakeArrayView(Copy), PNG);
                const bool Saved = FFileHelper::SaveArrayToFile(PNG, *Filename);
                UE_LOG(LogTemp, Display, TEXT("SPORTS_PHOTO_SAVED %s %d"), *Filename, int32(Saved));
                PendingSportsPhotos.Decrement();
            });
        });
}
} // namespace

ASportsBall::ASportsBall()
{
    PrimaryActorTick.bCanEverTick = true;
    Body = CreateDefaultSubobject<USphereComponent>(TEXT("BallCollision"));
    RootComponent = Body;
    Body->InitSphereRadius(12.1);
    Body->SetCollisionProfileName(TEXT("PhysicsActor"));
    Visual = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PebbledLeather"));
    Visual->SetupAttachment(Body);
    Visual->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere")));
    Visual->SetRelativeScale3D(FVector(.242));
    Visual->SetCollisionProfileName(TEXT("NoCollision"));
    Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Body->SetLinearDamping(.03);
    Body->SetAngularDamping(.08);
    Body->BodyInstance.bUseCCD = true;
    Body->SetNotifyRigidBodyCollision(true);
    Body->OnComponentHit.AddDynamic(this, &ASportsBall::OnCollision);
}
void ASportsBall::BeginPlay()
{
    Super::BeginPlay();
    BounceSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/MemorySports/Sounds/Bounce.Bounce"));
    RimSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/MemorySports/Sounds/Rim.Rim"));
    SwishSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/MemorySports/Sounds/Swish.Swish"));
}
void ASportsBall::Hold(const FVector &Position)
{
    Body->SetSimulatePhysics(false);
    Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    SetActorLocation(Position);
    Previous = Position;
}
void ASportsBall::Release(const FVector &Velocity)
{
    bReleased = true;
    bScored = false;
    Body->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    Body->SetSimulatePhysics(true);
    Body->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);
    Body->SetMassOverrideInKg(NAME_None, .62, true);
    Body->SetPhysicsLinearVelocity(Velocity);
    Body->SetPhysicsAngularVelocityInRadians(FVector::CrossProduct(Velocity.GetSafeNormal2D(), FVector::UpVector) * 14);
    Previous = GetActorLocation();
    UE_LOG(LogTemp, Display, TEXT("SPORTS_BALL_RELEASE position %s velocity %s"), *Previous.ToString(),
           *Velocity.ToString());
}
void ASportsBall::OnCollision(UPrimitiveComponent *HitComponent, AActor *OtherActor,
                              UPrimitiveComponent *OtherComponent, FVector Impulse, const FHitResult &Hit)
{
    if (bReleased)
        UE_LOG(LogTemp, Verbose, TEXT("SPORTS_BALL_HIT %s material %s at %s impulse %s"), *GetNameSafe(OtherComponent),
               OtherComponent ? *GetNameSafe(OtherComponent->GetMaterial(0)) : TEXT("None"),
               *Hit.ImpactPoint.ToString(), *Impulse.ToString());
    const double Now = FPlatformTime::Seconds();
    if (bReleased && Impulse.Size() > 30 && Now - LastImpactSound > .07)
    {
        const bool RimContact = OtherComponent && GetNameSafe(OtherComponent->GetMaterial(0)).Contains(TEXT("Rim"));
        UGameplayStatics::PlaySoundAtLocation(this, RimContact ? RimSound.Get() : BounceSound.Get(), Hit.ImpactPoint,
                                              float(FMath::Clamp(Impulse.Size() / 1500., .09, .45)),
                                              FMath::FRandRange(.94f, 1.06f));
        LastImpactSound = Now;
    }
}
void ASportsBall::Tick(float Dt)
{
    Super::Tick(Dt);
    const FVector Now = GetActorLocation();
    if (bReleased && Previous.Z > Rim.Z && Now.Z <= Rim.Z && Previous.Z > Now.Z)
    {
        const FVector Crossing = FMath::Lerp(Previous, Now, (Previous.Z - Rim.Z) / (Previous.Z - Now.Z));
        UE_LOG(LogTemp, Display, TEXT("SPORTS_BALL_CROSSING %.2f cm at %s rim %s"), FVector::Dist2D(Crossing, Rim),
               *Crossing.ToString(), *Rim.ToString());
    }
    if (bReleased && !bScored && SportsMath::CrossedBasket(Previous, Now, Rim))
    {
        bScored = true;
        Score++;
        LastCrossing = FMath::Lerp(Previous, Now, (Previous.Z - Rim.Z) / (Previous.Z - Now.Z));
        if (Scene)
            Scene->ReactToBasket(LastCrossing, Body->GetPhysicsLinearVelocity(), ReleaseAction == 3);
        if (auto *Player = Cast<ASportsCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
        {
            Player->LastBasketAt = Player->SessionSeconds;
            Player->LastBasketScore = Score;
        }
        UE_LOG(LogTemp, Display, TEXT("MEMORY_SPORTS_SCORE %d"), Score);
        UGameplayStatics::PlaySoundAtLocation(this, SwishSound, Rim, .48f);
    }
    Previous = Now;
}

ASportsCharacter::ASportsCharacter()
{
    PrimaryActorTick.bCanEverTick = true;
    GetCapsuleComponent()->InitCapsuleSize(31, 90);
    bUseControllerRotationYaw = false;
    GetCharacterMovement()->MaxWalkSpeed = 350;
    GetCharacterMovement()->JumpZVelocity = 370;
    GetCharacterMovement()->GravityScale = 1.25;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0, 650, 0);
    Boom = CreateDefaultSubobject<USpringArmComponent>(TEXT("FollowCamera"));
    Boom->SetupAttachment(RootComponent);
    Boom->TargetArmLength = 340;
    Boom->SocketOffset = FVector(0, 42, 55);
    Boom->bUsePawnControlRotation = true;
    Boom->bEnableCameraLag = true;
    Boom->CameraLagSpeed = 9;
    Boom->CameraLagMaxDistance = 45;
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("PlayerCamera"));
    Camera->SetupAttachment(Boom);
    Camera->FieldOfView = 64;
}
void ASportsCharacter::BeginPlay()
{
    Super::BeginPlay();
    BounceSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/MemorySports/Sounds/Bounce.Bounce"));
    ShiftSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/MemorySports/Sounds/Shift.Shift"));
    LastFrameWall = FPlatformTime::Seconds();
    MetricsStarted = LastFrameWall;
    ConfigureSportsPhotos();
    auto *Personal = LoadObject<USkeletalMesh>(
        nullptr, TEXT("/Game/PrivateAvatar/PersonalAthlete/SkeletalMeshes/PersonalAthlete.PersonalAthlete"));
    bPersonalAvatar = Personal != nullptr;
    GetMesh()->SetSkeletalMeshAsset(Personal ? Personal : LoadObject<USkeletalMesh>(
        nullptr, TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple")));
    GetMesh()->SetRelativeLocation(FVector(0, 0, -90));
    GetMesh()->SetRelativeRotation(FRotator(0, -90, 0));
    GetMesh()->SetCollisionProfileName(TEXT("NoCollision"));
    GetMesh()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    GetMesh()->SetAnimInstanceClass(USportsAnimation::StaticClass());
    GetMesh()->AddTickPrerequisiteActor(this);
    FString Loadout;
    TSharedPtr<FJsonObject> Selection;
    if (FFileHelper::LoadFileToString(Loadout, *(FPaths::ProjectSavedDir() / TEXT("motion-loadout.json"))) &&
        FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Loadout), Selection) && Selection.IsValid())
    {
        double Value = 0;
        if (Selection->TryGetNumberField(TEXT("shot"), Value) && FMath::IsFinite(Value))
            ShotPack = int32(FMath::Clamp(Value, 0., 2.));
        if (Selection->TryGetNumberField(TEXT("layup"), Value) && FMath::IsFinite(Value))
            LayupPack = int32(FMath::Clamp(Value, 0., 2.));
        if (Selection->TryGetNumberField(TEXT("dunk"), Value) && FMath::IsFinite(Value))
            DunkPack = int32(FMath::Clamp(Value, 0., 1.));
    }
    if (auto *PC = Cast<APlayerController>(GetController()))
    {
        PC->SetControlRotation(FRotator(-12, 0, 0));
        PC->SetInputMode(FInputModeGameOnly());
        PC->bShowMouseCursor = false;
    }
}
void ASportsCharacter::InitializeMode(ASportsWorld *World)
{
    Scene = World;
    bCycling = World->bCycling;
    SetActorLocation(World->Start, false, nullptr, ETeleportType::TeleportPhysics);
    if (bCycling)
    {
        GetCharacterMovement()->DisableMovement();
        Bike = GetWorld()->SpawnActor<AActor>();
        auto *Root = NewObject<USceneComponent>(Bike);
        Bike->SetRootComponent(Root);
        Root->RegisterComponent();
        Scene->BuildBike(Bike);
        double Distance = 0;
        FString Save;
        TSharedPtr<FJsonObject> Obj;
        if (FFileHelper::LoadFileToString(Save, *(FPaths::ProjectSavedDir() / TEXT("ride-progress.json"))) &&
            FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Save), Obj) && Obj.IsValid())
        {
            double Stored = 0;
            if (Obj->TryGetNumberField(TEXT("distance"), Stored) && FMath::IsFinite(Stored))
                Distance = FMath::Clamp(Stored, 0., Scene->RouteLengthM - 2);
            if (Obj->TryGetNumberField(TEXT("gear"), Stored))
                Gear = FMath::Clamp(int32(Stored), 1, 12);
        }
        FVector P, T;
        Scene->SampleRoute(Distance, P, T);
        SetActorLocation(P + FVector(0, 0, 105), false, nullptr, ETeleportType::TeleportPhysics);
        SetActorRotation(FRotator(0, T.Rotation().Yaw, 0));
        if (GetController())
            GetController()->SetControlRotation(FRotator(-9, T.Rotation().Yaw, 0));
        ProgressM = Distance;
        Boom->TargetArmLength = 470;
        Boom->SocketOffset = FVector(0, 35, 45);
        Feedback = TEXT("Find your cadence.");
        RideAudio = UGameplayStatics::SpawnSoundAttached(
            LoadObject<USoundBase>(nullptr, TEXT("/Game/MemorySports/Sounds/RideWind.RideWind")), Camera, NAME_None,
            FVector::ZeroVector, EAttachLocation::KeepRelativeOffset, true, 0.f, 1.f, 0.f, nullptr, nullptr, false);
    }
    else
    {
        Ball = GetWorld()->SpawnActor<ASportsBall>();
        Ball->Rim = World->Rim;
        Ball->Scene = World;
        Ball->Visual->SetMaterial(
            0, LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/MemorySports/Materials/M_Ball.M_Ball")));
        auto *Physical = NewObject<UPhysicalMaterial>(Ball);
        Physical->Restitution = .78f;
        Physical->Friction = .45f;
        Physical->RestitutionCombineMode = EFrictionCombineMode::Max;
        Physical->bOverrideRestitutionCombineMode = true;
        Ball->Body->SetPhysMaterialOverride(Physical);
        Ball->Body->IgnoreActorWhenMoving(this, true);
        GetCapsuleComponent()->IgnoreActorWhenMoving(Ball, true);
        Ball->Body->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);
        Feedback = TEXT("E to dribble. Hold and release LMB to shoot.");
    }
}
void ASportsCharacter::SetupPlayerInputComponent(UInputComponent *I)
{
    Super::SetupPlayerInputComponent(I);
    I->BindAxis(TEXT("MoveForward"), this, &ASportsCharacter::MoveForward);
    I->BindAxis(TEXT("MoveRight"), this, &ASportsCharacter::MoveRight);
    I->BindAxis(TEXT("Turn"), this, &ASportsCharacter::Turn);
    I->BindAxis(TEXT("LookUp"), this, &ASportsCharacter::Look);
    I->BindAxis(TEXT("TurnStick"), this, &ASportsCharacter::TurnStick);
    I->BindAxis(TEXT("LookStick"), this, &ASportsCharacter::LookStick);
    I->BindAction(TEXT("Shoot"), IE_Pressed, this, &ASportsCharacter::BeginShot);
    I->BindAction(TEXT("Shoot"), IE_Released, this, &ASportsCharacter::EndShot);
    I->BindAction(TEXT("ShotPack"), IE_Pressed, this, &ASportsCharacter::CycleShot);
    I->BindAction(TEXT("LayupPack"), IE_Pressed, this, &ASportsCharacter::CycleLayup);
    I->BindAction(TEXT("DunkPack"), IE_Pressed, this, &ASportsCharacter::CycleDunk);
    I->BindAction(TEXT("Layup"), IE_Pressed, this, &ASportsCharacter::BeginLayup);
    I->BindAction(TEXT("Dunk"), IE_Pressed, this, &ASportsCharacter::BeginDunk);
    I->BindAction(TEXT("Aim"), IE_Pressed, this, &ASportsCharacter::BeginAim);
    I->BindAction(TEXT("Aim"), IE_Released, this, &ASportsCharacter::EndAim);
    I->BindAction(TEXT("Sprint"), IE_Pressed, this, &ASportsCharacter::BeginSprint);
    I->BindAction(TEXT("Sprint"), IE_Released, this, &ASportsCharacter::EndSprint);
    I->BindAction(TEXT("Dribble"), IE_Pressed, this, &ASportsCharacter::ToggleDribble);
    I->BindAction(TEXT("ChangeHand"), IE_Pressed, this, &ASportsCharacter::ChangeHand);
    I->BindAction(TEXT("Jump"), IE_Pressed, this, &ASportsCharacter::JumpOrHop);
    I->BindAction(TEXT("Brake"), IE_Pressed, this, &ASportsCharacter::BeginBrake);
    I->BindAction(TEXT("Brake"), IE_Released, this, &ASportsCharacter::EndBrake);
    I->BindAction(TEXT("GearDown"), IE_Pressed, this, &ASportsCharacter::Easier);
    I->BindAction(TEXT("GearUp"), IE_Pressed, this, &ASportsCharacter::Harder);
    I->BindAction(TEXT("Reset"), IE_Pressed, this, &ASportsCharacter::ResetAthlete);
    I->BindAction(TEXT("Camera"), IE_Pressed, this, &ASportsCharacter::ToggleCamera);
    I->BindAction(TEXT("Help"), IE_Pressed, this, &ASportsCharacter::ToggleHelp);
    I->BindAction(TEXT("CourtMode"), IE_Pressed, this, &ASportsCharacter::CourtMode);
    I->BindAction(TEXT("RideMode"), IE_Pressed, this, &ASportsCharacter::RideMode);
    I->BindAction(TEXT("Pause"), IE_Pressed, this, &ASportsCharacter::TogglePause).bExecuteWhenPaused = true;
    I->BindAction(TEXT("Evidence"), IE_Pressed, this, &ASportsCharacter::Screenshot).bExecuteWhenPaused = true;
    I->BindAction(TEXT("Quit"), IE_Pressed, this, &ASportsCharacter::QuitGame).bExecuteWhenPaused = true;
}
void ASportsCharacter::MoveForward(float V)
{
    Throttle = V;
    if (!bCycling && !bPaused && !bFinishing && Controller)
        AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::X),
                         V);
}
void ASportsCharacter::MoveRight(float V)
{
    SteeringInput = V;
    if (!bCycling && !bPaused && !bFinishing && Controller)
        AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::Y),
                         V);
}
void ASportsCharacter::Turn(float V)
{
    if (FMath::Abs(V) > .001f)
        LastLookAt = FPlatformTime::Seconds();
    if (!bPaused)
        AddControllerYawInput(V * .8f);
}
void ASportsCharacter::Look(float V)
{
    if (FMath::Abs(V) > .001f)
        LastLookAt = FPlatformTime::Seconds();
    if (!bPaused)
        AddControllerPitchInput(V * .6f);
}
void ASportsCharacter::TurnStick(float V)
{
    Turn(V * GetWorld()->GetDeltaSeconds() * 95);
}
void ASportsCharacter::LookStick(float V)
{
    Look(V * GetWorld()->GetDeltaSeconds() * 75);
}
void ASportsCharacter::BeginAim()
{
    bAiming = true;
    InputEvents++;
}
void ASportsCharacter::EndAim()
{
    bAiming = false;
}
void ASportsCharacter::BeginSprint()
{
    bSprint = true;
    InputEvents++;
    GetCharacterMovement()->MaxWalkSpeed = 610;
}
void ASportsCharacter::EndSprint()
{
    bSprint = false;
    GetCharacterMovement()->MaxWalkSpeed = 350;
}
void ASportsCharacter::BeginShot()
{
    if (!bCycling && !bPaused && !bFinishing && PendingRelease < 0 && ShotRecovery <= 0)
    {
        InputEvents++;
        if (Ball && Ball->bReleased)
        {
            Ball->bReleased = false;
            Ball->bScored = false;
        }
        bCharging = true;
        ActiveAction = 1;
        bDribbling = false;
        Charge = 0;
        ShotStarted = FPlatformTime::Seconds();
        UE_LOG(LogTemp, Display, TEXT("SPORTS_SHOT_PRESS %.6f"), ShotStarted);
    }
}
void ASportsCharacter::EndShot()
{
    if (bCharging)
    {
        Charge = FMath::Min(1.2, FPlatformTime::Seconds() - ShotStarted);
        bCharging = false;
        ShotCharge = Charge;
        UE_LOG(LogTemp, Display, TEXT("SPORTS_SHOT_TIMING held %.6f ideal %.3f"), ShotCharge,
               SportsMotion::Shot(ShotPack).Ideal);
        const auto &Pack = SportsMotion::Shot(ShotPack);
        PendingRelease = Pack.Gather;
        ShotRecovery = Pack.Gather + .55;
        LaunchCharacter(FVector(0, 0, Pack.JumpVelocity), false, true);
        Attempts++;
        InputEvents++;
    }
}
void ASportsCharacter::SaveLoadout() const
{
    auto O = MakeShared<FJsonObject>();
    O->SetNumberField(TEXT("shot"), ShotPack);
    O->SetNumberField(TEXT("layup"), LayupPack);
    O->SetNumberField(TEXT("dunk"), DunkPack);
    FString Text;
    FJsonSerializer::Serialize(O, TJsonWriterFactory<>::Create(&Text));
    FFileHelper::SaveStringToFile(Text, *(FPaths::ProjectSavedDir() / TEXT("motion-loadout.json")));
}
void ASportsCharacter::CycleShot()
{
    if (bCycling || bPaused || bCharging || bFinishing || ShotRecovery > 0)
        return;
    ShotPack = (ShotPack + 1) % 3;
    InputEvents++;
    SaveLoadout();
    Feedback = FString::Printf(TEXT("SHOT: %s  /  %.2fs rhythm"), SportsMotion::Shot(ShotPack).Name,
                               SportsMotion::Shot(ShotPack).Ideal);
}
void ASportsCharacter::CycleLayup()
{
    if (bCycling || bPaused || bCharging || bFinishing || ShotRecovery > 0)
        return;
    LayupPack = (LayupPack + 1) % 3;
    InputEvents++;
    SaveLoadout();
    Feedback = FString::Printf(TEXT("LAYUP: %s  /  F near the rim"), SportsMotion::Finish(false, LayupPack).Name);
}
void ASportsCharacter::CycleDunk()
{
    if (bCycling || bPaused || bCharging || bFinishing || ShotRecovery > 0)
        return;
    DunkPack = (DunkPack + 1) % 2;
    InputEvents++;
    SaveLoadout();
    Feedback = FString::Printf(TEXT("DUNK: %s  /  G near the rim"), SportsMotion::Finish(true, DunkPack).Name);
}
void ASportsCharacter::BeginLayup()
{
    StartFinish(false);
}
void ASportsCharacter::BeginDunk()
{
    StartFinish(true);
}
void ASportsCharacter::StartFinish(bool Dunk)
{
    if (bCycling || bPaused || bFinishing || bCharging || ShotRecovery > 0 || !Ball)
        return;
    FinishDistance = FVector::Dist2D(GetActorLocation(), Ball->Rim);
    if (!SportsMotion::CanFinish(FinishDistance, Dunk, GetCharacterMovement()->IsMovingOnGround()))
    {
        Feedback = Dunk ? TEXT("Move within 3.7m, then G to dunk.") : TEXT("Move within 5.6m, then F to lay up.");
        ActionNotice = Feedback;
        NoticeUntil = SessionSeconds + 2.8;
        return;
    }
    bFinishing = true;
    bFinishLaunched = false;
    FinishClock = FinishPhase = 0;
    ActiveAction = Dunk ? 3 : 2;
    FinishDirection = (Ball->Rim - GetActorLocation()).GetSafeNormal2D();
    SetActorRotation(FinishDirection.Rotation());
    GetCharacterMovement()->StopMovementImmediately();
    bDribbling = false;
    Ball->bReleased = Ball->bScored = false;
    Attempts++;
    InputEvents++;
    Feedback = SportsMotion::Finish(Dunk, Dunk ? DunkPack : LayupPack).Name;
}
void ASportsCharacter::RelaxArms()
{
    // 手腕放在同侧髋部外侧，肩到手近乎垂直；移动时只保留小幅自然摆臂。
    const FVector Origin = GetActorLocation(), Forward = GetActorForwardVector(), Side = GetActorRightVector();
    const float Swing = FMath::Clamp(GetVelocity().Size2D() / 350., 0., 1.) * 6 * FMath::Sin(DribbleTime * 8);
    LeftTarget = Origin + Forward * (5 + Swing) - Side * 24 + FVector(0, 0, -8);
    RightTarget = Origin + Forward * (5 - Swing) + Side * 24 + FVector(0, 0, -8);
    LeftIK = RightIK = 1;
}
void ASportsCharacter::UpdateFinish(float Dt)
{
    const bool Dunk = ActiveAction == 3;
    const auto &Pack = SportsMotion::Finish(Dunk, Dunk ? DunkPack : LayupPack);
    FinishClock += Dt;
    FinishPhase = float(FMath::Clamp(FinishClock / Pack.Release, 0., 1.));
    const FVector Side = GetActorRightVector();
    const double Hand = bLeftHand ? -1. : 1.;
    PoseCrouch = float(FinishClock < Pack.Gather ? 14 * FMath::Sin(FinishClock / Pack.Gather * PI) : 0);
    PoseLean = FinishClock < Pack.Release ? -6.f : 7.f;
    if (!bFinishLaunched && FinishClock >= Pack.Gather)
    {
        bFinishLaunched = true;
        // 只给角色有限的起跳冲量；不移动篮圈、不给篮球预设计分。
        const double Travel = FMath::Max(0., FinishDistance - (Dunk ? 42. : 95.));
        const double Speed = FMath::Min(720., Travel / (Pack.Release - Pack.Gather));
        const FVector Lateral = Side * Pack.Lateral * Hand / (Pack.Release - Pack.Gather);
        LaunchCharacter(FinishDirection * Speed + Lateral + FVector(0, 0, Pack.JumpVelocity), true, true);
    }
    const double Lift = FMath::SmoothStep(Pack.Gather * .65, Pack.Release - .04, FinishClock);
    const double Euro = Pack.Lateral * Hand * FMath::Sin(FMath::Clamp(FinishClock / Pack.Release, 0., 1.) * PI);
    const FVector Position = GetActorLocation() + FinishDirection * FMath::Lerp(32., Dunk ? 39. : 43., Lift) +
        Side * (Hand * FMath::Lerp(24., Pack.TwoHands ? 0. : 13., Lift) + Euro * .22) +
        FVector(0, 0, FMath::Lerp(-5., Pack.HandHeight, Lift));
    RelaxArms();
    const FVector RelaxedLeft = LeftTarget, RelaxedRight = RightTarget;
    if (Pack.TwoHands || FinishClock < Pack.Gather)
    {
        LeftIK = RightIK = 1;
        LeftTarget = Position - Side * 11;
        RightTarget = Position + Side * 11;
    }
    else if (bLeftHand)
    {
        LeftIK = 1;
        LeftTarget = Position - Side * 6 + FVector(0, 0, Dunk ? 9 : -9);
    }
    else
    {
        RightIK = 1;
        RightTarget = Position + Side * 6 + FVector(0, 0, Dunk ? 9 : -9);
    }
    if (!Ball->bReleased)
    {
        Ball->Hold(Position);
        if (FinishClock >= Pack.Release)
        {
            const double Distance = FVector::Dist2D(Position, Ball->Rim);
            const bool AtRim = Dunk && Position.Z > Ball->Rim.Z + 12.1 && Distance < 62.;
            const double Flight = AtRim ? Pack.Flight : (Dunk ? .65 : Pack.Flight);
            Ball->ReleaseAction = AtRim ? 3 : 2;
            LastReleaseKind = Dunk && !AtRim ? TEXT("ADJUSTED FLOATER") : Pack.Name;
            LastReleaseAt = SessionSeconds;
            LastShotDistanceM = FinishDistance / 100.;
            LastTimingError = 0;
            Ball->Release(SportsMath::ShotVelocity(Position, Ball->Rim, Flight,
                                                   GetWorld()->GetGravityZ(), Ball->Body->GetLinearDamping()));
            Feedback = AtRim ? TEXT("POWER FINISH  /  watch the rim") : TEXT("SOFT TOUCH  /  follow through");
            UE_LOG(LogTemp, Display, TEXT("SPORTS_FINISH_RELEASE %s height %.1f distance %.1f dunkReach %d"),
                   Pack.Name, Position.Z, Distance, int32(AtRim));
            GetCharacterMovement()->Velocity.X *= .14;
            GetCharacterMovement()->Velocity.Y *= .14;
        }
    }
    const double Recover = FMath::Clamp((Pack.Release + .40 - FinishClock) / .32, 0., 1.);
    if (Ball->bReleased)
    {
        // 出手后沿连续轨迹放下手臂，避免 IK 权重归零后跳回外张的基础姿势。
        const float Settle = float(FMath::SmoothStep(0., 1., Recover));
        LeftTarget = FMath::Lerp(RelaxedLeft, LeftTarget, Settle);
        RightTarget = FMath::Lerp(RelaxedRight, RightTarget, Settle);
    }
    if (FinishClock > Pack.Release + .58 && GetCharacterMovement()->IsMovingOnGround())
    {
        bFinishing = false;
        ActiveAction = 0;
        FinishPhase = PoseCrouch = PoseLean = 0;
    }
    if (Ball->bScored)
        Feedback = TEXT("BUCKET  /  E to retrieve");
}
void ASportsCharacter::ToggleDribble()
{
    if (!bCycling && !bPaused && !bCharging && !bFinishing && PendingRelease < 0)
    {
        InputEvents++;
        bDribbling = !bDribbling;
        if (Ball)
        {
            Ball->bReleased = false;
            Ball->bScored = false;
        }
    }
}
void ASportsCharacter::ChangeHand()
{
    if (!bCycling && !bPaused && !bCharging && !bFinishing && ShotRecovery <= 0)
    {
        bLeftHand = !bLeftHand;
        InputEvents++;
    }
}
void ASportsCharacter::JumpOrHop()
{
    if (!bCycling && !bPaused && !bFinishing && !bCharging && PendingRelease < 0)
    {
        Jump();
        InputEvents++;
    }
}
void ASportsCharacter::BeginBrake()
{
    if (bCycling)
    {
        bBraking = true;
        InputEvents++;
    }
}
void ASportsCharacter::EndBrake()
{
    bBraking = false;
}
void ASportsCharacter::Easier()
{
    if (bCycling)
    {
        Gear = FMath::Max(1, Gear - 1);
        UGameplayStatics::PlaySound2D(this, ShiftSound, .3f);
        InputEvents++;
    }
}
void ASportsCharacter::Harder()
{
    if (bCycling)
    {
        Gear = FMath::Min(12, Gear + 1);
        UGameplayStatics::PlaySound2D(this, ShiftSound, .3f);
        InputEvents++;
    }
}
void ASportsCharacter::ToggleCamera()
{
    bFirstPerson = !bFirstPerson;
    Boom->TargetArmLength = bFirstPerson ? 0 : (bCycling ? 470 : 340);
    Boom->SocketOffset = bFirstPerson ? FVector(13, 0, 65) : FVector(0, 42, 55);
    GetMesh()->SetOwnerNoSee(bFirstPerson);
    InputEvents++;
}
void ASportsCharacter::ToggleHelp()
{
    bShowHelp = !bShowHelp;
    InputEvents++;
}
void ASportsCharacter::SaveRide() const
{
    if (!bCycling)
        return;
    auto Obj = MakeShared<FJsonObject>();
    Obj->SetNumberField(TEXT("distance"), ProgressM);
    Obj->SetNumberField(TEXT("gear"), Gear);
    FString Data;
    FJsonSerializer::Serialize(Obj, TJsonWriterFactory<>::Create(&Data));
    FFileHelper::SaveStringToFile(Data, *(FPaths::ProjectSavedDir() / TEXT("ride-progress.json")));
}
void ASportsCharacter::CourtMode()
{
    SaveRide();
    UGameplayStatics::OpenLevel(this, TEXT("TrainingHall"));
}
void ASportsCharacter::RideMode()
{
    SaveRide();
    UGameplayStatics::OpenLevel(this, TEXT("LakesideRide"));
}
void ASportsCharacter::TogglePause()
{
    bPaused = !bPaused;
    Throttle = Steering = SteeringInput = 0;
    bCharging = false;
    bAiming = false;
    bBraking = false;
    SaveRide();
    InputEvents++;
    UGameplayStatics::SetGamePaused(this, bPaused);
    Feedback = bPaused ? TEXT("PAUSED  /  ESC to resume") : TEXT("Back in motion.");
    WriteTelemetry();
}
void ASportsCharacter::ResetAthlete()
{
    Recoveries++;
    InputEvents++;
    if (!Scene)
        return;
    SpeedMps = 0;
    Throttle = Steering = SteeringInput = 0;
    bCharging = false;
    bDribbling = false;
    PendingRelease = -1;
    ShotRecovery = 0;
    bFinishing = bFinishLaunched = false;
    ActiveAction = 0;
    FinishPhase = PoseCrouch = PoseLean = 0;
    RiderPower = 0;
    bSprintActive = false;
    if (bCycling)
    {
        // 到达开放式路线的终点后，R 明确开始新一程；普通恢复仍返回最近道路。
        if (ProgressM >= Scene->RouteLengthM - 10)
            ProgressM = 0;
        FVector P, T;
        Scene->SampleRoute(ProgressM, P, T);
        SetActorLocation(P + FVector(0, 0, 105), false, nullptr, ETeleportType::TeleportPhysics);
        SetActorRotation(FRotator(0, T.Rotation().Yaw, 0));
        if (Controller)
            Controller->SetControlRotation(FRotator(-9, T.Rotation().Yaw, 0));
    }
    else
    {
        SetActorLocation(Scene->Start, false, nullptr, ETeleportType::TeleportPhysics);
        if (Ball)
            Ball->bReleased = false;
    }
    Feedback = TEXT("Recovered safely.");
}
void ASportsCharacter::BikeStep(double Dt)
{
    if (!Scene)
        return;
    const FVector Forward = GetActorForwardVector();
    FCollisionQueryParams Query;
    Query.AddIgnoredActor(this);
    if (Bike)
        Query.AddIgnoredActor(Bike);
    FHitResult Ground, Ahead;
    const FVector Here = GetActorLocation();
    const bool OnGround = GetWorld()->LineTraceSingleByChannel(Ground, Here + FVector(0, 0, 250),
                                                               Here - FVector(0, 0, 450), ECC_Visibility, Query);
    GetWorld()->LineTraceSingleByChannel(Ahead, Here + Forward * 160 + FVector(0, 0, 250),
                                         Here + Forward * 160 - FVector(0, 0, 550), ECC_Visibility, Query);
    Grade = OnGround && Ahead.bBlockingHit
                ? FMath::Clamp((Ahead.ImpactPoint.Z - Ground.ImpactPoint.Z) / 160., -.22, .22)
                : 0;
    const double RouteProgress = Scene->ClosestProgress(Here);
    FVector Center, Tangent;
    Scene->SampleRoute(RouteProgress, Center, Tangent);
    const bool Gravel = FVector::Dist2D(Center, Here) > 335;
    const double GearRatio = FMath::Lerp(.82, 3.8, (Gear - 1) / 11.);
    Cadence = SpeedMps / (2 * PI * .34 * GearRatio) * 60;
    const bool Brake = bBraking || Throttle < -.05;
    const bool Pedal = Throttle > .05 && !Brake;
    // 耐力耗尽后须恢复到 30% 才能再次冲刺，避免临界值反复跳变。
    if (Stamina <= .08)
        bSprintExhausted = true;
    if (Stamina >= .30)
        bSprintExhausted = false;
    bSprintActive = bSprint && Pedal && !bSprintExhausted;
    const double Efficiency = FMath::Clamp(1 - FMath::Abs(Cadence - 82) / 140., .3, 1.);
    const double RequestedPower = Pedal ? (bSprintActive ? 650. : 195.) *
        FMath::Clamp(double(Throttle), 0., 1.) * (bSprintActive ? FMath::Max(.65, Efficiency) : Efficiency) : 0;
    RiderPower = Brake ? 0. : FMath::FInterpTo(RiderPower, RequestedPower, float(Dt), 5.f);
    SpeedMps = FMath::Clamp(
        SpeedMps +
            SportsMath::BikeAcceleration(SpeedMps, Grade, RiderPower, Brake, Gravel, GearRatio,
                                           bSprintActive ? 115. : 75.) * Dt,
        0., 24.);
    Stamina = FMath::Clamp(Stamina + (bSprintActive ? -.09 : (Pedal ? .025 : .06)) * Dt, 0., 1.);
    Steering = FMath::FInterpTo(Steering, SteeringInput, float(Dt), 7.f);
    const double SteeringAngle = Steering * SportsMath::BikeSteeringLimit(SpeedMps);
    const double YawStep = FMath::RadiansToDegrees(SpeedMps / 1.08 * FMath::Tan(SteeringAngle) * Dt);
    FRotator R = GetActorRotation();
    R.Yaw += YawStep;
    R.Pitch = FMath::RadiansToDegrees(FMath::Atan(Grade));
    SetActorRotation(R);
    FVector Next = Here + GetActorForwardVector() * SpeedMps * 100 * Dt;
    if (OnGround)
        Next.Z = Ground.ImpactPoint.Z + 105;
    FHitResult Hit;
    SetActorLocation(Next, true, &Hit);
    if (Hit.bBlockingHit && FMath::Abs(Hit.Normal.Z) < .5)
        SpeedMps *= .35;
    if (!OnGround || GetActorLocation().Z < 200)
        ResetAthlete();
    ProgressM = RouteProgress;
    if (SpeedMps > .15)
        RideSeconds += Dt;
    const float Lean =
        FMath::RadiansToDegrees(FMath::Atan(SpeedMps * SpeedMps * FMath::Tan(SteeringAngle) / (9.81 * 1.08)));
    if (Bike)
    {
        Bike->SetActorLocation(GetActorLocation() - FVector(0, 0, 15));
        Bike->SetActorRotation(FRotator(R.Pitch, R.Yaw, FMath::Clamp(Lean, -32.f, 32.f)));
        GetMesh()->SetRelativeRotation((FQuat(FVector::ForwardVector, FMath::DegreesToRadians(FMath::Clamp(Lean, -32.f, 32.f))) *
                                       FQuat(FRotator(0, -90, 0))).Rotator());
        const FQuat BarTurn(FVector::UpVector, SteeringAngle);
        LeftTarget = Bike->GetActorTransform().TransformPosition(FVector(41, 0, 22) + BarTurn.RotateVector(FVector(0, -21, 0)));
        RightTarget = Bike->GetActorTransform().TransformPosition(FVector(41, 0, 22) + BarTurn.RotateVector(FVector(0, 21, 0)));
        if (Scene->Handlebar)
            Scene->Handlebar->SetRelativeRotation((BarTurn *
                FQuat::FindBetweenNormals(FVector::UpVector, FVector::RightVector)).Rotator());
        LeftIK = RightIK = 1;
    }
    WheelAngle += SpeedMps / .34 * Dt;
    if (Pedal)
        PedalAngle += FMath::Max(35., Cadence) / 60 * 2 * PI * Dt;
    for (int I = 0; I < Scene->Wheels.Num(); ++I)
        if (auto *Wheel = Scene->Wheels[I])
            Wheel->SetRelativeRotation((FQuat(FVector::UpVector, I == 1 ? SteeringAngle : 0) *
                FQuat(FVector::RightVector, WheelAngle) * FQuat(FRotator(0, 0, 90))).Rotator());
    for (int I = 0; I < Scene->Pedals.Num(); ++I)
    {
        const float Side = I == 0 ? -1.f : 1.f;
        Scene->Pedals[I]->SetRelativeLocation(
            FVector(-8 + Side * 17 * cos(PedalAngle), Side * 12, -56 + Side * 17 * sin(PedalAngle)));
        if (Scene->Cranks.IsValidIndex(I))
        {
            const FVector D(Side * 17 * cos(PedalAngle), 0, Side * 17 * sin(PedalAngle));
            Scene->Cranks[I]->SetRelativeLocation(FVector(-8, Side * 9, -56) + D * .5);
            Scene->Cranks[I]->SetRelativeRotation(FQuat::FindBetweenNormals(FVector::UpVector, D.GetSafeNormal()).Rotator());
        }
    }
}
void ASportsCharacter::UpdateBasketball(float Dt)
{
    if (!Ball)
        return;
    if (bFinishing)
    {
        UpdateFinish(Dt);
        return;
    }
    const auto &Pack = SportsMotion::Shot(ShotPack);
    PoseCrouch = FMath::FInterpTo(PoseCrouch, bCharging ? 12.f : 0.f, Dt, 12.f);
    PoseLean = 0;
    const FVector Forward = GetActorForwardVector(), Side = GetActorRightVector(), Origin = GetActorLocation();
    RelaxArms();
    DribbleTime += Dt;
    if (bCharging)
        Charge = FMath::Min(1.2, FPlatformTime::Seconds() - ShotStarted);
    HandBlend = FMath::FInterpTo(HandBlend, bLeftHand ? -1.f : 1.f, Dt, 14);
    const float HandSide = HandBlend;
    FVector Position = Origin + Forward * 32 + Side * HandSide * 30 + FVector(0, 0, 2);
    if (bDribbling)
    {
        const double Phase = DribbleTime / .52;
        Position.Z = Origin.Z - 90 + 12.1 + (98 - 12.1) * FMath::Square(FMath::Cos(Phase * PI));
        const int32 BounceIndex = FMath::FloorToInt(Phase + .5);
        if (BounceIndex != LastBounce)
        {
            UGameplayStatics::PlaySoundAtLocation(this, BounceSound, Position, .27f);
            LastBounce = BounceIndex;
        }
    }
    if (bCharging || PendingRelease >= 0)
    {
        const double Lift = bCharging ? FMath::SmoothStep(0., .30, Charge) : 1.;
        Position = Origin + Forward * FMath::Lerp(33., 26., Lift) + Side * HandSide * 9 +
                   FVector(0, 0, FMath::Lerp(4., Pack.HandHeight, Lift));
        LeftIK = RightIK = 1;
        LeftTarget = Position - Side * 11 + FVector(0, 0, bLeftHand ? -8 : 0);
        RightTarget = Position + Side * 11 + FVector(0, 0, bLeftHand ? 0 : -8);
    }
    if (!Ball->bReleased)
    {
        Ball->Hold(Position);
        const float Contact =
            bDribbling ? float(FMath::Clamp((FMath::Abs(FMath::Cos(DribbleTime / .52 * PI)) - .5) * 2, 0., 1.)) : 1;
        if (bLeftHand && !bCharging && PendingRelease < 0)
        {
            LeftIK = Contact;
            LeftTarget = Position + (bDribbling ? FVector(0, 0, 11) : -Side * 10);
        }
        else if (!bLeftHand && !bCharging && PendingRelease < 0)
        {
            RightIK = Contact;
            RightTarget = Position + (bDribbling ? FVector(0, 0, 11) : Side * 10);
        }
    }
    if (PendingRelease >= 0)
    {
        PendingRelease -= Dt;
        if (PendingRelease < 0)
        {
            const double Distance = FVector::Dist2D(Position, Ball->Rim),
                         Time = FMath::Clamp(.82 + Distance / 1400. + Pack.FlightBias, .85, 1.75);
            // 真实释放点计算抛体速度；计分只读取 Chaos 球体的实际下降穿框。
            FVector Target = Ball->Rim;
            Target.Y += FMath::Clamp((ShotCharge - Pack.Ideal) * 95., -55., 55.);
            Ball->ReleaseAction = 1;
            LastReleaseAt = SessionSeconds;
            LastTimingError = ShotCharge - Pack.Ideal;
            LastShotDistanceM = Distance / 100.;
            LastReleaseKind = TEXT("JUMP SHOT");
            Ball->Release(SportsMath::ShotVelocity(Position, Target, Time, GetWorld()->GetGravityZ(),
                                                   Ball->Body->GetLinearDamping()));
            Feedback =
                FMath::Abs(ShotCharge - Pack.Ideal) < .055 ? TEXT("CLEAN RELEASE") : TEXT("Follow through. Watch the arc.");
        }
    }
    ShotRecovery = FMath::Max(0., ShotRecovery - Dt);
    if (ShotRecovery == 0 && !bCharging)
        ActiveAction = 0;
    if (Ball->bReleased && ShotRecovery > 0)
    {
        const FVector Follow = Origin + Forward * 24 + Side * (bLeftHand ? -10 : 10) + FVector(0, 0, 120);
        if (bLeftHand)
        {
            LeftTarget = FMath::Lerp(LeftTarget, Follow, float(FMath::SmoothStep(0., .28, ShotRecovery)));
        }
        else
        {
            RightTarget = FMath::Lerp(RightTarget, Follow, float(FMath::SmoothStep(0., .28, ShotRecovery)));
        }
    }
    if (Ball->bScored)
        Feedback = TEXT("BUCKET  /  E to retrieve");
    if (bAiming && Controller)
    {
        const FRotator Aim = (Scene->Rim - GetActorLocation()).Rotation();
        FRotator R = GetActorRotation();
        R.Yaw = FMath::FixedTurn(R.Yaw, Aim.Yaw, Dt * 360);
        SetActorRotation(R);
        Controller->SetControlRotation(FMath::RInterpTo(
            Controller->GetControlRotation(), (Scene->Rim - Camera->GetComponentLocation()).Rotation(), Dt, 5.f));
    }
}
void ASportsCharacter::Tick(float Dt)
{
    Super::Tick(Dt);
    if (!Scene)
        return;
    const double Wall = FPlatformTime::Seconds();
    FrameIntervals.Add((Wall - LastFrameWall) * 1000);
    LastFrameWall = Wall;
    if (FrameIntervals.Num() > 36000)
        FrameIntervals.RemoveAt(0);
    if (!bPaused)
    {
        SessionSeconds += Dt;
        if (bCycling)
        {
            FixedTime = FMath::Min(.08, FixedTime + Dt);
            while (FixedTime >= 1. / 120)
            {
                BikeStep(1. / 120);
                FixedTime -= 1. / 120;
            }
        }
        else
            UpdateBasketball(Dt);
    }
    if (bCycling && !bPaused && Controller && Wall - LastLookAt > 1.8)
        Controller->SetControlRotation(
            FMath::RInterpTo(Controller->GetControlRotation(), FRotator(-9, GetActorRotation().Yaw, 0), Dt, 3.5f));
    if (!bFirstPerson)
    {
        Boom->TargetArmLength =
            FMath::FInterpTo(Boom->TargetArmLength, bAiming ? 290.f : (bCycling ? 470.f : 340.f), Dt, 7.f);
        Boom->SocketOffset = FMath::VInterpTo(
            Boom->SocketOffset, bAiming ? FVector(0, 85, 75) : FVector(0, 42, bCycling ? 45 : 55), Dt, 7.f);
    }
    const float Fov = bAiming ? 54.f : 64.f +
        float(bCycling ? FMath::Min(SpeedMps * .72, 11.) + (bSprintActive ? 4. : 0.) : 0.);
    Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView, Fov, Dt, 7));
    if (RideAudio)
    {
        RideAudio->SetVolumeMultiplier(float(FMath::Clamp(SpeedMps / 15., 0., 1.)) * .55f);
        RideAudio->SetPitchMultiplier(float(.8 + FMath::Min(SpeedMps * .035, .6)));
    }
    TelemetryTime += Dt;
    if (TelemetryTime > 1)
    {
        WriteTelemetry();
        TelemetryTime = 0;
        SaveRide();
    }
}
void ASportsCharacter::WriteTelemetry()
{
    auto O = MakeShared<FJsonObject>();
    O->SetStringField(TEXT("mode"), bCycling ? TEXT("cycling") : TEXT("basketball"));
    O->SetNumberField(TEXT("inputEvents"), InputEvents);
    O->SetNumberField(TEXT("recoveries"), Recoveries);
    O->SetNumberField(TEXT("renderedFrames"), double(RenderedFrames));
    O->SetNumberField(TEXT("viewportWidth"), ViewportWidth);
    O->SetNumberField(TEXT("viewportHeight"), ViewportHeight);
    O->SetNumberField(TEXT("renderedFps"),
                      RenderedFrames / FMath::Max(.001, FPlatformTime::Seconds() - MetricsStarted));
    O->SetNumberField(TEXT("gpuFrameMs"), FPlatformTime::ToMilliseconds(RHIGetGPUFrameCycles()));
    O->SetBoolField(TEXT("worldRenderingEnabled"), GEngine && GEngine->GameViewport &&
                                                       !GEngine->GameViewport->bDisableWorldRendering &&
                                                       GEngine->GameViewport->EngineShowFlags.Rendering);
    O->SetNumberField(TEXT("speedMps"), SpeedMps);
    O->SetNumberField(TEXT("distanceM"), ProgressM);
    O->SetNumberField(TEXT("grade"), Grade);
    O->SetNumberField(TEXT("gear"), Gear);
    O->SetNumberField(TEXT("riderPowerW"), RiderPower);
    O->SetNumberField(TEXT("stamina"), Stamina);
    O->SetNumberField(TEXT("cadence"), Cadence);
    O->SetBoolField(TEXT("sprintActive"), bSprintActive);
    O->SetBoolField(TEXT("braking"), bBraking || Throttle < -.05);
    O->SetNumberField(TEXT("cameraFov"), Camera->FieldOfView);
    O->SetBoolField(TEXT("personalAvatar"), bPersonalAvatar);
    O->SetStringField(TEXT("avatarMesh"), GetNameSafe(GetMesh()->GetSkeletalMeshAsset()));
    O->SetNumberField(TEXT("shotPack"), ShotPack);
    O->SetNumberField(TEXT("layupPack"), LayupPack);
    O->SetNumberField(TEXT("dunkPack"), DunkPack);
    O->SetNumberField(TEXT("activeAction"), ActiveAction);
    O->SetNumberField(TEXT("finishPhase"), FinishPhase);
    O->SetNumberField(TEXT("score"), Ball ? Ball->Score : 0);
    O->SetNumberField(TEXT("attempts"), Attempts);
    O->SetBoolField(TEXT("firstPerson"), bFirstPerson);
    O->SetBoolField(TEXT("paused"), bPaused);
    O->SetBoolField(TEXT("dribbling"), bDribbling);
    O->SetBoolField(TEXT("leftHanded"), bLeftHand);
    O->SetBoolField(TEXT("charged"), bCharging);
    O->SetNumberField(TEXT("charge"), Charge);
    O->SetNumberField(TEXT("sessionSeconds"), SessionSeconds);
    O->SetNumberField(TEXT("lastTimingErrorMs"), LastTimingError * 1000.);
    O->SetNumberField(TEXT("lastShotDistanceM"), LastShotDistanceM);
    O->SetNumberField(TEXT("lastBasketScore"), LastBasketScore);
    O->SetNumberField(TEXT("netReactions"), Scene ? Scene->NetReactions : 0);
    O->SetNumberField(TEXT("netStrength"), Scene ? Scene->NetStrength : 0);
    O->SetNumberField(TEXT("netClock"), Scene ? Scene->NetClock : 0);
    TArray<TSharedPtr<FJsonValue>> P;
    for (double V : {GetActorLocation().X, GetActorLocation().Y, GetActorLocation().Z})
        P.Add(MakeShared<FJsonValueNumber>(V));
    O->SetArrayField(TEXT("position"), P);
    O->SetNumberField(TEXT("handTargetErrorCm"),
                      bLeftHand ? FVector::Distance(GetMesh()->GetSocketLocation(TEXT("hand_l")), LeftTarget)
                                : FVector::Distance(GetMesh()->GetSocketLocation(TEXT("hand_r")), RightTarget));
    const auto ArmDownAngle = [&](const TCHAR *Upper, const TCHAR *Hand) {
        const FVector Direction = (GetMesh()->GetSocketLocation(Hand) - GetMesh()->GetSocketLocation(Upper)).GetSafeNormal();
        return FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(-Direction.Z, -1., 1.)));
    };
    O->SetNumberField(TEXT("leftArmDownAngleDeg"), ArmDownAngle(TEXT("upperarm_l"), TEXT("hand_l")));
    O->SetNumberField(TEXT("rightArmDownAngleDeg"), ArmDownAngle(TEXT("upperarm_r"), TEXT("hand_r")));
    const auto JointAngle = [&](const FString &A, const FString &B, const FString &C) {
        const FVector First = (GetMesh()->GetSocketLocation(FName(*B)) - GetMesh()->GetSocketLocation(FName(*A))).GetSafeNormal();
        const FVector Second = (GetMesh()->GetSocketLocation(FName(*C)) - GetMesh()->GetSocketLocation(FName(*B))).GetSafeNormal();
        return FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(FVector::DotProduct(First, Second), -1., 1.)));
    };
    for (const FString Suffix : {FString(TEXT("l")), FString(TEXT("r"))})
    {
        O->SetNumberField(Suffix == TEXT("l") ? TEXT("leftElbowBendDeg") : TEXT("rightElbowBendDeg"),
            JointAngle(TEXT("upperarm_") + Suffix, TEXT("lowerarm_") + Suffix, TEXT("hand_") + Suffix));
        O->SetNumberField(Suffix == TEXT("l") ? TEXT("leftIndexCurlDeg") : TEXT("rightIndexCurlDeg"),
            JointAngle(TEXT("index_01_") + Suffix, TEXT("index_02_") + Suffix, TEXT("index_03_") + Suffix));
    }
    if (bCycling && Scene && Scene->Pedals.Num() == 2)
    {
        O->SetNumberField(TEXT("leftFootErrorCm"), FVector::Distance(GetMesh()->GetSocketLocation(TEXT("foot_l")),
                                                                     Scene->Pedals[0]->GetComponentLocation()));
        O->SetNumberField(TEXT("rightFootErrorCm"), FVector::Distance(GetMesh()->GetSocketLocation(TEXT("foot_r")),
                                                                      Scene->Pedals[1]->GetComponentLocation()));
    }
    if (Ball)
    {
        O->SetBoolField(TEXT("ballReleased"), Ball->bReleased);
        O->SetBoolField(TEXT("ballScored"), Ball->bScored);
        O->SetNumberField(TEXT("ballHeightCm"), Ball->GetActorLocation().Z);
        O->SetNumberField(TEXT("ballSpeedCmps"), Ball->Body->GetPhysicsLinearVelocity().Size());
    }
    O->SetNumberField(TEXT("meshExtentX"), GetMesh()->Bounds.BoxExtent.X);
    O->SetNumberField(TEXT("meshExtentY"), GetMesh()->Bounds.BoxExtent.Y);
    O->SetNumberField(TEXT("meshExtentZ"), GetMesh()->Bounds.BoxExtent.Z);
    O->SetNumberField(TEXT("headHeightCm"), GetMesh()->GetSocketLocation(TEXT("head")).Z - GetActorLocation().Z + 90);
    O->SetNumberField(TEXT("cameraArmCm"), FVector::Distance(Camera->GetComponentLocation(), GetActorLocation()));
    if (FrameIntervals.Num() > 20)
    {
        TArray<double> Sorted = FrameIntervals;
        Sorted.Sort();
        double Sum = 0;
        for (double V : Sorted)
            Sum += V;
        O->SetNumberField(TEXT("fps"), 1000 * Sorted.Num() / Sum);
        O->SetNumberField(TEXT("p95Ms"), Sorted[FMath::FloorToInt((Sorted.Num() - 1) * .95)]);
        O->SetNumberField(TEXT("maxMs"), Sorted.Last());
    }
    FString Text;
    FJsonSerializer::Serialize(O, TJsonWriterFactory<>::Create(&Text));
    FFileHelper::SaveStringToFile(Text, *(FPaths::ProjectSavedDir() / TEXT("runtime-state.json")));
}
void ASportsCharacter::SaveSnapshot(const FString &Tag, bool Capture)
{
    WriteTelemetry();
    const FString Directory = FPaths::ProjectDir() / TEXT("Reports/Evidence");
    IFileManager::Get().MakeDirectory(*Directory, true);
    const FString Safe = FPaths::MakeValidFileName(Tag);
    IFileManager::Get().Copy(*(Directory / Safe + TEXT(".json")),
                             *(FPaths::ProjectSavedDir() / TEXT("runtime-state.json")));
    if (Capture)
        // Canvas HUD 已包含在游戏视口；关闭 Slate 窗口回读，避免后台窗口截图触发 DX11 资源失效。
        FScreenshotRequest::RequestScreenshot(Directory / Safe + TEXT(".png"), false, false);
}
void ASportsCharacter::Screenshot()
{
    if (PendingSportsPhotos.GetValue() >= 3)
    {
        Feedback = TEXT("Saving photos. Try again shortly.");
        return;
    }
    SaveSnapshot(FString::Printf(TEXT("%s-%s-%03d"), bCycling ? TEXT("ride") : TEXT("court"),
                                 *FDateTime::Now().ToString(TEXT("%Y%m%d-%H%M%S")), FDateTime::Now().GetMillisecond()));
}
void ASportsCharacter::ResetFrameMetrics()
{
    FrameIntervals.Empty();
    LastFrameWall = FPlatformTime::Seconds();
    MetricsStarted = LastFrameWall;
    RenderedFrames = 0;
}
void ASportsCharacter::QuitGame()
{
    SaveRide();
    UKismetSystemLibrary::QuitGame(this, Cast<APlayerController>(Controller), EQuitPreference::Quit, false);
}
