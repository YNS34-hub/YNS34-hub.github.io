#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/Actor.h"
#include "SportsCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class USphereComponent;
class UStaticMeshComponent;
class UAnimSequence;
class UPrimitiveComponent;
class USoundBase;
class UAudioComponent;
class ASportsWorld;

UCLASS()
class MEMORYSPORTS_API ASportsBall : public AActor
{
    GENERATED_BODY()
  public:
    ASportsBall();
    virtual void BeginPlay() override;
    UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> Body;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    virtual void Tick(float DeltaSeconds) override;
    FVector Rim = FVector(1242.5, 0, 305);
    FVector Previous;
    bool bReleased = false, bScored = false;
    int32 Score = 0;
    int32 ReleaseAction = 0;
    UPROPERTY(Transient) TObjectPtr<ASportsWorld> Scene;
    FVector LastCrossing = FVector::ZeroVector;
    UPROPERTY(Transient) TObjectPtr<USoundBase> BounceSound;
    UPROPERTY(Transient) TObjectPtr<USoundBase> RimSound;
    UPROPERTY(Transient) TObjectPtr<USoundBase> SwishSound;
    double LastImpactSound = 0;
    void Hold(const FVector &Position);
    void Release(const FVector &Velocity);
    UFUNCTION()
    void OnCollision(UPrimitiveComponent *HitComponent, AActor *OtherActor, UPrimitiveComponent *OtherComponent,
                     FVector Impulse, const FHitResult &Hit);
};

UCLASS()
class MEMORYSPORTS_API ASportsCharacter : public ACharacter
{
    GENERATED_BODY()
  public:
    ASportsCharacter();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent *Input) override;
    void InitializeMode(ASportsWorld *World);
    void SaveSnapshot(const FString &Tag, bool Capture = true);
    void Screenshot();
    void ResetFrameMetrics();
    UPROPERTY(VisibleAnywhere) TObjectPtr<USpringArmComponent> Boom;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY(Transient) TObjectPtr<ASportsWorld> Scene;
    UPROPERTY(Transient) TObjectPtr<ASportsBall> Ball;
    UPROPERTY(Transient) TObjectPtr<AActor> Bike;
    UPROPERTY(Transient) TObjectPtr<USoundBase> BounceSound;
    UPROPERTY(Transient) TObjectPtr<USoundBase> ShiftSound;
    UPROPERTY(Transient) TObjectPtr<UAudioComponent> RideAudio;
    bool bCycling = false, bCharging = false, bDribbling = false, bLeftHand = false, bAiming = false, bSprint = false,
         bBraking = false, bFirstPerson = false, bShowHelp = false, bPaused = false;
    bool bDisableIK = false;
    bool bPersonalAvatar = false, bSprintActive = false;
    int32 ShotPack = 1, LayupPack = 0, DunkPack = 0, ActiveAction = 0;
    float PoseCrouch = 0, PoseLean = 0, FinishPhase = 0;
    double SessionSeconds = 0, LastReleaseAt = -100, LastTimingError = 0, LastShotDistanceM = 0;
    double LastBasketAt = -100;
    int32 LastBasketScore = 0;
    FString LastReleaseKind;
    FString ActionNotice;
    double NoticeUntil = 0;
    double RiderPower = 0;
    double SpeedMps = 0, Cadence = 0, Grade = 0, ProgressM = 0, RideSeconds = 0, Stamina = 1, Charge = 0,
           ShotRecovery = 0, DribbleTime = 0, WheelAngle = 0, PedalAngle = 0;
    int32 Gear = 7, Attempts = 0, InputEvents = 0;
    int32 Recoveries = 0;
    int64 RenderedFrames = 0;
    float ViewportWidth = 0, ViewportHeight = 0;
    FVector LeftTarget, RightTarget;
    float LeftIK = 0, RightIK = 0;
    FString Feedback = TEXT("Find your rhythm.");
    void MoveForward(float Value);
    void MoveRight(float Value);
    void Turn(float Value);
    void Look(float Value);
    void TurnStick(float Value);
    void LookStick(float Value);
    void BeginShot();
    void EndShot();
    void CycleShot();
    void CycleLayup();
    void CycleDunk();
    void BeginLayup();
    void BeginDunk();
    void SaveLoadout() const;
    void BeginAim();
    void EndAim();
    void BeginSprint();
    void EndSprint();
    void ToggleDribble();
    void ChangeHand();
    void JumpOrHop();
    void BeginBrake();
    void EndBrake();
    void Easier();
    void Harder();
    void ResetAthlete();
    void ToggleCamera();
    void ToggleHelp();
    void CourtMode();
    void RideMode();
    void TogglePause();
    void QuitGame();

  private:
    float Throttle = 0, Steering = 0, SteeringInput = 0;
    float HandBlend = 1;
    int32 LastBounce = -1;
    double FixedTime = 0, TelemetryTime = 0, PendingRelease = -1, ShotCharge = 0, ShotStarted = 0;
    TArray<double> FrameIntervals;
    double LastFrameWall = 0, LastLookAt = 0, MetricsStarted = 0;
    bool bFinishing = false, bFinishLaunched = false, bSprintExhausted = false;
    double FinishClock = 0, FinishDistance = 0;
    FVector FinishDirection;
    void StartFinish(bool Dunk);
    void RelaxArms();
    void UpdateFinish(float Dt);
    void BikeStep(double Dt);
    void UpdateBasketball(float Dt);
    void WriteTelemetry();
    void SaveRide() const;
};
