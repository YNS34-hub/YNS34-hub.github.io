#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SportsWorld.generated.h"

class UMaterialInterface;
class UInstancedStaticMeshComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UProceduralMeshComponent;
class UTextRenderComponent;

UCLASS()
class MEMORYSPORTS_API ASportsWorld : public AActor
{
    GENERATED_BODY()
  public:
    ASportsWorld();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    void ReactToBasket(const FVector &Crossing, const FVector &Velocity, bool Dunk);
    float NetStrength = 0;
    double NetClock = 5;
    int32 NetReactions = 0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Memory Sports") bool bCycling = false;
    UFUNCTION(CallInEditor, BlueprintCallable, Category = "Memory Sports") void BuildScene();
    UFUNCTION(BlueprintCallable, Category = "Memory Sports") static FString ConfigurePersonalAvatar();
    UPROPERTY(VisibleAnywhere, Category = "Route") TArray<FVector> Route;
    UPROPERTY(VisibleAnywhere, Category = "Route") double RouteLengthM = 3529.72;
    UPROPERTY(VisibleAnywhere, Category = "Court") FVector Rim = FVector(1242.5, 0, 305);
    UPROPERTY(VisibleAnywhere, Category = "Route") FVector Start = FVector(400, 0, 96);
    TArray<UStaticMeshComponent *> Wheels;
    TArray<UStaticMeshComponent *> Pedals;
    TArray<UStaticMeshComponent *> Cranks;
    UStaticMeshComponent *Handlebar = nullptr;
    void BuildBike(AActor *PartOwner);
    void SampleRoute(double DistanceM, FVector &Position, FVector &Tangent) const;
    double ClosestProgress(const FVector &Position) const;

  private:
    UPROPERTY(Transient) TObjectPtr<UInstancedStaticMeshComponent> ActiveNet;
    UPROPERTY(Transient) TObjectPtr<UTextRenderComponent> LiveScore;
    FVector NetDirection = FVector::ForwardVector;
    double ScoreClock = 0;
    void BuildLiveCourt();
    void UpdateNet();
    TMap<FString, UInstancedStaticMeshComponent *> Batches;
    UStaticMesh *Cube = nullptr;
    UStaticMesh *Cylinder = nullptr;
    UStaticMesh *Sphere = nullptr;
    UMaterialInterface *Material(const FString &Name) const;
    void Box(const FString &Mat, FVector P, FVector Size, FRotator R = FRotator::ZeroRotator, bool Collision = true);
    void Tube(const FString &Mat, FVector A, FVector B, float Radius, bool Collision = false);
    void Hoop(float Side);
    void Court();
    void Valley();
    void CourtDetails();
    void ValleyDetails();
    void Label(const FString &Text, FVector Position, float Size, float Yaw);
    void Instance(const FString &Key, const FString &Mat, UStaticMesh *Mesh, const FTransform &Transform,
                  int32 CullDistance = 0);
    UStaticMeshComponent *DynamicPart(AActor *PartOwner, const FString &Mat, UStaticMesh *Shape, FVector P,
                                      FVector Scale, FRotator R);
};
