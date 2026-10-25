#include "SportsQA.h"
#include "SportsCharacter.h"
#include "SportsWorld.h"
#include "SportsMath.h"
#include "TimerManager.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerInput.h"
#include "GameFramework/InputSettings.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "InputCoreTypes.h"
#include "InputKeyEventArgs.h"
#include "Components/SkeletalMeshComponent.h"
#if WITH_EDITOR
#include "ShaderCompiler.h"
#endif

ASportsQA::ASportsQA()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bTickEvenWhenPaused = true;
}
void ASportsQA::BeginPlay()
{
    Super::BeginPlay();
    // 回放过程中允许检查器切换窗口；仅此测试进程保留按键，正常游玩仍按默认规则释放。
    GetMutableDefault<UInputSettings>()->bShouldFlushPressedKeysOnViewportFocusLost = false;
    Started = FPlatformTime::Seconds();
    FString Source;
    TSharedPtr<FJsonObject> Data;
    if (FFileHelper::LoadFileToString(Source, *(FPaths::ProjectSavedDir() / TEXT("qa-sequence.json"))) &&
        FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Source), Data) && Data.IsValid())
    {
        const FString Mode =
            GetWorld()->GetMapName().Contains(TEXT("LakesideRide")) ? TEXT("cycling") : TEXT("basketball");
        const TArray<TSharedPtr<FJsonValue>> *Found = nullptr;
        if (Data->TryGetArrayField(Mode, Found))
            Events = *Found;
    }
}
void ASportsQA::Tick(float Dt)
{
    Super::Tick(Dt);
    auto *PC = UGameplayStatics::GetPlayerController(this, 0);
    auto *P = Cast<ASportsCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
    if (!PC || !P)
        return;
#if WITH_EDITOR
    // 首个事件等待可见材质就绪，保留编译提示，不将占位材质截图当成完成画面。
    if (Next == 0 && GShaderCompilingManager && GShaderCompilingManager->IsCompiling())
    {
        Started = FPlatformTime::Seconds();
        return;
    }
#endif
    // 仅在显式 -SportsQA 下回放本工程内的输入事件；正常游戏不读取命令文件。
    const double Time = FPlatformTime::Seconds() - Started;
    while (Events.IsValidIndex(Next) && Events[Next]->AsObject()->GetNumberField(TEXT("at")) <= Time)
    {
        const auto Event = Events[Next++]->AsObject();
        FString Value;
        if (Event->TryGetStringField(TEXT("key"), Value))
        {
            const bool Down = Event->GetBoolField(TEXT("down"));
            const FKey Key(*Value);
            if (Key == EKeys::W || Key == EKeys::A || Key == EKeys::S || Key == EKeys::D)
            {
                if (Down)
                    HeldMovementKeys.Add(Key);
                else
                    HeldMovementKeys.Remove(Key);
            }
            PC->InputKey(FInputKeyEventArgs(nullptr, INPUTDEVICEID_NONE, Key, Down ? IE_Pressed : IE_Released,
                                            Down ? 1.f : 0.f, false, FPlatformTime::Cycles64()));
            UE_LOG(LogTemp, Display, TEXT("SPORTS_QA_INPUT %.3f %s %d"), Time, *Value, int32(Down));
        }
        if (Event->TryGetStringField(TEXT("capture"), Value))
            P->SaveSnapshot(Value);
        if (Event->TryGetStringField(TEXT("record"), Value))
            P->SaveSnapshot(Value, false);
        bool Reset = false;
        if (Event->TryGetBoolField(TEXT("resetMetrics"), Reset) && Reset)
            P->ResetFrameMetrics();
        bool ValueBool = false;
        if (Event->TryGetBoolField(TEXT("referencePose"), ValueBool))
            P->GetMesh()->SetForceRefPose(ValueBool);
        if (Event->TryGetBoolField(TEXT("disableIK"), ValueBool))
            P->bDisableIK = ValueBool;
        double CameraYaw = 0;
        if (Event->TryGetNumberField(TEXT("cameraYaw"), CameraYaw) && FMath::IsFinite(CameraYaw))
        {
            double Pitch = -8;
            Event->TryGetNumberField(TEXT("cameraPitch"), Pitch);
            P->Turn(.002f); // 同时延后骑行的自动追尾镜头，供人工检查角度。
            PC->SetControlRotation(FRotator(FMath::Clamp(Pitch, -70., 65.), CameraYaw, 0));
            UE_LOG(LogTemp, Display, TEXT("SPORTS_QA_OBSERVATION_CAMERA %.1f %.1f"), CameraYaw, Pitch);
        }
        if (Event->TryGetBoolField(TEXT("autoDrive"), ValueBool))
        {
            bAutoDrive = ValueBool;
            TripStarted = Time;
            LastProgress = P->ProgressM;
            MaxOffset = 0;
            StartRecoveries = P->Recoveries;
            P->ResetFrameMetrics();
        }
        double Distance = 0;
        if (Event->TryGetNumberField(TEXT("viewAtM"), Distance) && P->bCycling && P->Scene && FMath::IsFinite(Distance))
        {
            // 检查机位单独记录，不作为连续骑行成绩。
            P->ProgressM = FMath::Clamp(Distance, 0., P->Scene->RouteLengthM - 2);
            P->ResetAthlete();
            UE_LOG(LogTemp, Display, TEXT("SPORTS_QA_OBSERVATION_POINT %.1f m"), P->ProgressM);
        }
    }
    // 显式测试回放维持轴键的按住状态，直到原序列的松键事件；切换检查窗口不能截断路程。
    // 使用同一玩家输入通道的 Repeat，不重触发投篮等动作，也不写入角色位置或速度。
    for (const FKey &Key : HeldMovementKeys)
        PC->InputKey(FInputKeyEventArgs(nullptr, INPUTDEVICEID_NONE, Key, IE_Repeat, 1.f, false,
                                        FPlatformTime::Cycles64()));
    if (bAutoDrive)
        Drive(P, PC, Dt, Time);
}
void ASportsQA::Drive(ASportsCharacter *P, APlayerController *PC, float Dt, double Time)
{
    if (!P->bCycling || !P->Scene)
        return;
    auto Axis = [&](FKey Key, float Value) {
        PC->InputKey(FInputKeyEventArgs(nullptr, INPUTDEVICEID_NONE, Key, Value, Dt, 1, FPlatformTime::Cycles64()));
    };
    if (ShiftKey.IsValid())
    {
        PC->InputKey(FInputKeyEventArgs(nullptr, INPUTDEVICEID_NONE, ShiftKey, IE_Released, 0.f, false,
                                        FPlatformTime::Cycles64()));
        ShiftKey = FKey();
    }
    FVector Center, Tangent;
    P->Scene->SampleRoute(P->ProgressM, Center, Tangent);
    MaxOffset = FMath::Max(MaxOffset, FVector::Dist2D(Center, P->GetActorLocation()));
    const bool Finished =
        (LastProgress > P->Scene->RouteLengthM - 30 && P->ProgressM < 30) || P->ProgressM > P->Scene->RouteLengthM - 3;
    if (Finished)
    {
        Axis(EKeys::Gamepad_LeftY, -1);
        Axis(EKeys::Gamepad_LeftX, 0);
        bAutoDrive = false;
        bTripFinished = true;
        auto Report = MakeShared<FJsonObject>();
        Report->SetBoolField(TEXT("completed"), true);
        Report->SetNumberField(TEXT("routeMeters"), P->Scene->RouteLengthM);
        Report->SetNumberField(TEXT("elapsedSeconds"), Time - TripStarted);
        Report->SetNumberField(TEXT("maximumCenterOffsetCm"), MaxOffset);
        Report->SetNumberField(TEXT("recoveries"), P->Recoveries - StartRecoveries);
        Report->SetStringField(
            TEXT("driver"), TEXT("Unreal player input events; SI bicycle simulation; no position teleport during lap"));
        FString Text;
        FJsonSerializer::Serialize(Report, TJsonWriterFactory<>::Create(&Text));
        FFileHelper::SaveStringToFile(Text, *(FPaths::ProjectDir() / TEXT("Reports/ride-full-route-result.json")));
        P->SaveSnapshot(TEXT("ride-full-route"));
        if (FParse::Param(FCommandLine::Get(), TEXT("SportsQARouteOnly")))
        {
            FTimerHandle Handle;
            GetWorldTimerManager().SetTimer(Handle, P, &ASportsCharacter::QuitGame, 4.f, false);
        }
        return;
    }
    // 纯追踪控制器只发送手柄轴事件，不修改玩家坐标或速度。
    const double LookAhead = FMath::Clamp(7. + P->SpeedMps * 1.3, 9., 23.);
    FVector Target, Unused;
    P->Scene->SampleRoute(FMath::Min(P->Scene->RouteLengthM, P->ProgressM + LookAhead), Target, Unused);
    const FVector Direction = (Target - P->GetActorLocation()).GetSafeNormal2D(), Forward = P->GetActorForwardVector();
    const double Cross = Forward.X * Direction.Y - Forward.Y * Direction.X;
    const double Angle = FMath::Atan(2 * 1.08 * Cross / LookAhead);
    double Steering = FMath::Clamp(Angle / SportsMath::BikeSteeringLimit(P->SpeedMps), -1., 1.);
    if (FMath::Abs(Steering) > .003)
        Steering = FMath::Sign(Steering) * (.25 + .75 * FMath::Abs(Steering));
    else
        Steering = 0;
    const double Radius = LookAhead / (2 * FMath::Max(.002, FMath::Abs(Cross)));
    const double TargetSpeed = FMath::Clamp(FMath::Sqrt(3. * Radius), 2.5, 9.);
    Axis(EKeys::Gamepad_LeftY, P->SpeedMps > TargetSpeed + .35 ? -1.f : 1.f);
    Axis(EKeys::Gamepad_LeftX, float(Steering));
    if (Time - LastShift > 1)
    {
        const int32 Desired = FMath::Clamp(FMath::RoundToInt((P->SpeedMps / 2.85 - .82) / 2.98 * 11 + 1), 1, 12);
        if (Desired != P->Gear)
        {
            ShiftKey = Desired > P->Gear ? EKeys::E : EKeys::Q;
            PC->InputKey(FInputKeyEventArgs(nullptr, INPUTDEVICEID_NONE, ShiftKey, IE_Pressed, 1.f, false,
                                            FPlatformTime::Cycles64()));
        }
        LastShift = Time;
    }
    if (Time - LastRecord > 10)
    {
        P->SaveSnapshot(FString::Printf(TEXT("ride-lap-%04d"), int32(Time - TripStarted)), false);
        LastRecord = Time;
    }
    LastProgress = P->ProgressM;
}
