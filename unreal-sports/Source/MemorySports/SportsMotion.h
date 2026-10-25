#pragma once
#include "CoreMinimal.h"

// 原创参数化动作，可替换为具有授权的动画；不包含 2K 游戏文件。
namespace SportsMotion
{
struct FShot
{
    const TCHAR *Name;
    double Ideal, Gather, JumpVelocity, HandHeight, FlightBias;
};
inline const FShot &Shot(int Index)
{
    static const FShot Packs[] = {{TEXT("QUICK SET"), .46, .14, 235, 83, -.10},
                                  {TEXT("CLASSIC JUMPER"), .62, .20, 280, 91, 0},
                                  {TEXT("HIGH RELEASE"), .78, .26, 310, 103, .12}};
    return Packs[FMath::Clamp(Index, 0, 2)];
}
struct FFinish
{
    const TCHAR *Name;
    double Gather, Release, JumpVelocity, HandHeight, Lateral, Flight;
    bool TwoHands;
};
inline const FFinish &Finish(bool Dunk, int Index)
{
    static const FFinish Layups[] = {{TEXT("LONG STRIDE"), .20, .64, 425, 103, 0, .68, false},
                                     {TEXT("FINGER ROLL"), .18, .67, 415, 91, 0, .76, false},
                                     {TEXT("EURO STEP"), .30, .76, 430, 106, 42, .70, false}};
    static const FFinish Dunks[] = {{TEXT("ONE HAND POWER"), .22, .71, 545, 116, 0, .20, false},
                                    {TEXT("TWO HAND POWER"), .27, .76, 555, 111, 0, .20, true}};
    return Dunk ? Dunks[FMath::Clamp(Index, 0, 1)] : Layups[FMath::Clamp(Index, 0, 2)];
}
inline bool CanFinish(double DistanceCm, bool Dunk, bool Grounded)
{
    return Grounded && DistanceCm >= (Dunk ? 85. : 65.) && DistanceCm <= (Dunk ? 370. : 560.);
}
} // namespace SportsMotion
