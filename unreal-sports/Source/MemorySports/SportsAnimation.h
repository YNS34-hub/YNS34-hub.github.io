#pragma once
#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "SportsAnimation.generated.h"

UCLASS(Transient)
class MEMORYSPORTS_API USportsAnimation : public UAnimInstance
{
    GENERATED_BODY()
  public:
    UPROPERTY(Transient) TArray<TObjectPtr<UAnimSequence>> Clips;

  protected:
    virtual FAnimInstanceProxy *CreateAnimInstanceProxy() override;
    virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy *Proxy) override;
};
