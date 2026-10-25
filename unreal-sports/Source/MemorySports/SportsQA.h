#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "InputCoreTypes.h"
#include "SportsQA.generated.h"
class FJsonValue;

UCLASS()
class MEMORYSPORTS_API ASportsQA : public AActor
{
    GENERATED_BODY()
  public:
    ASportsQA();
    virtual void BeginPlay() override;
    virtual void Tick(float Dt) override;

  private:
    TArray<TSharedPtr<FJsonValue>> Events;
    TSet<FKey> HeldMovementKeys;
    double Started = 0;
    int32 Next = 0;
    bool bAutoDrive = false, bTripFinished = false;
    double TripStarted = 0, LastProgress = 0, MaxOffset = 0, LastRecord = 0, LastShift = 0;
    int32 StartRecoveries = 0;
    FKey ShiftKey;
    void Drive(class ASportsCharacter *P, class APlayerController *PC, float Dt, double Time);
};
