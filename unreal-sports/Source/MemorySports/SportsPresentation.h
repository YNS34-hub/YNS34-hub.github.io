#pragma once
#include "CoreMinimal.h"

namespace SportsPresentation
{
inline const TCHAR *TimingLabel(double ErrorSeconds)
{
    if (FMath::Abs(ErrorSeconds) <= .055)
        return TEXT("EXCELLENT");
    return ErrorSeconds < 0 ? TEXT("EARLY") : TEXT("LATE");
}

// 顶排固定于篮圈，下部有衰减伸展和横向摆动；这个形变只影响视觉，不参与计分。
inline FVector NetPoint(const FVector &Center, double Angle, int Row, double Time,
                        double Strength, const FVector &Direction)
{
    const double Height = FMath::Clamp(Row / 5., 0., 1.);
    const double T = FMath::Max(0., Time);
    const double Decay = FMath::Exp(-3.8 * T);
    const double Pull = Strength * Decay * FMath::Sin(T * 12.) * Height;
    const double Flare = Strength * Decay * FMath::Sin(T * 10.) * Height * 4.5;
    const double Radius = 22. - Row * 1.9 + Flare;
    const FVector Sway = Direction.GetSafeNormal2D() * (Pull * 7. * Height);
    return Center + FVector(FMath::Cos(Angle) * Radius, FMath::Sin(Angle) * Radius,
                            -Row * 8. - Pull * 9.) + Sway;
}
} // namespace SportsPresentation
