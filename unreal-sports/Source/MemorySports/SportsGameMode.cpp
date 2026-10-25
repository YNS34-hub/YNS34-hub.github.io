#include "SportsGameMode.h"
#include "SportsCharacter.h"
#include "SportsWorld.h"
#include "SportsMotion.h"
#include "SportsQA.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"

ASportsGameMode::ASportsGameMode()
{
    DefaultPawnClass = ASportsCharacter::StaticClass();
    HUDClass = ASportsHUD::StaticClass();
}
void ASportsGameMode::StartPlay()
{
    Super::StartPlay();
    ASportsWorld *Scene = nullptr;
    for (TActorIterator<ASportsWorld> It(GetWorld()); It; ++It)
    {
        Scene = *It;
        break;
    }
    if (!Scene)
    {
        Scene = GetWorld()->SpawnActor<ASportsWorld>();
        Scene->bCycling = GetWorld()->GetMapName().Contains(TEXT("LakesideRide"));
        Scene->BuildScene();
    }
    if (auto *Athlete = Cast<ASportsCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
        Athlete->InitializeMode(Scene);
#if !UE_BUILD_SHIPPING
    if (FParse::Param(FCommandLine::Get(), TEXT("SportsQA")))
        GetWorld()->SpawnActor<ASportsQA>();
#endif
}
