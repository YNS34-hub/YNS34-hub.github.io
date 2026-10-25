#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "SportsGameMode.generated.h"

class UFont;

UCLASS()
class MEMORYSPORTS_API ASportsHUD : public AHUD
{
    GENERATED_BODY()
  public:
    virtual void BeginPlay() override;
    virtual void DrawHUD() override;

  private:
    UPROPERTY(Transient) TObjectPtr<UFont> DisplayTypeface;
    UPROPERTY(Transient) TObjectPtr<UFont> BodyTypeface;
};

UCLASS()
class MEMORYSPORTS_API ASportsGameMode : public AGameModeBase
{
    GENERATED_BODY()
  public:
    ASportsGameMode();
    virtual void StartPlay() override;
};
