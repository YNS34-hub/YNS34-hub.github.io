#pragma once
#include "CoreMinimal.h"

namespace SportsMath
{
inline double BikeSteeringLimit(double Speed)
{
    // 将最大横向加速度限制在约 0.46g，保证高速键盘转向仍可控。
    return FMath::Min(.44, FMath::Atan(4.5 * 1.08 / FMath::Max(1., Speed * Speed)));
}
inline FVector ShotVelocity(const FVector &From, const FVector &Target, double FlightTime, double Gravity,
                            double Drag = 0)
{
    const double T = FMath::Clamp(FlightTime, .12, 1.8);
    if (Drag > 1e-6)
    {
        // 与 Chaos 的线性阻尼使用同一参数，按阻尼抛体解析解修正出手速度。
        const FVector Terminal(0, 0, Gravity / Drag);
        return (Target - From - Terminal * T) * (Drag / (1 - FMath::Exp(-Drag * T))) + Terminal;
    }
    return (Target - From) / T - FVector(0, 0, Gravity) * (.5 * T);
}
inline bool CrossedBasket(const FVector &Before, const FVector &After, const FVector &Rim)
{
    if (Before.Z <= Rim.Z || After.Z > Rim.Z || Before.Z <= After.Z)
        return false;
    const double T = (Before.Z - Rim.Z) / (Before.Z - After.Z);
    const FVector Crossing = FMath::Lerp(Before, After, T);
    return FVector::DistSquared2D(Crossing, Rim) < FMath::Square(10.8);
}
inline double BikeAcceleration(double Speed, double Grade, double Power, bool Brake, bool Gravel,
                               double GearRatio = 2.2, double CrankTorque = 75.)
{
    // 全部为 SI 单位；低速由有限轮上扭矩起步，禁止用 P/v 产生无穷加速度。
    const double Mass = 82;
    const double TorqueLimit = FMath::Min(175., CrankTorque / (.34 * FMath::Clamp(GearRatio, .82, 3.8)));
    const double Drive = !Brake && Power > 0 ? FMath::Min(TorqueLimit, Power / FMath::Max(.1, Speed)) : 0.;
    const double Drag = .5 * 1.225 * .34 * Speed * Speed, Rolling = (Gravel ? .023 : .0055) * Mass * 9.81;
    return (Drive - Drag - Rolling - Mass * 9.81 * Grade) / Mass - (Brake ? 6.8 : 0.);
}
} // namespace SportsMath
