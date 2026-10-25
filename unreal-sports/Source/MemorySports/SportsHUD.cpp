#include "SportsGameMode.h"
#include "SportsCharacter.h"
#include "SportsWorld.h"
#include "SportsMotion.h"
#include "SportsPresentation.h"
#include "Engine/Canvas.h"
#include "Engine/Font.h"
#include "CanvasItem.h"
#include "Fonts/SlateFontInfo.h"
#include "Misc/Paths.h"
#include "GameFramework/PlayerController.h"

void ASportsHUD::BeginPlay()
{
    Super::BeginPlay();
    auto Typeface = [&](const TCHAR *Filename) {
        auto *Font = NewObject<UFont>(this);
        Font->FontCacheType = EFontCacheType::Runtime;
        FTypefaceEntry Entry;
        Entry.Name = TEXT("Regular");
        Entry.Font = FFontData(FPaths::ProjectContentDir() / TEXT("Data/Fonts") / Filename,
                              EFontHinting::Default, EFontLoadingPolicy::LazyLoad);
        Font->GetMutableInternalCompositeFont().DefaultTypeface.Fonts.Add(Entry);
        return Font;
    };
    DisplayTypeface = Typeface(TEXT("BarlowCondensed-SemiBold.ttf"));
    BodyTypeface = Typeface(TEXT("BarlowSemiCondensed-Medium.ttf"));
}

void ASportsHUD::DrawHUD()
{
    Super::DrawHUD();
    auto *P = Cast<ASportsCharacter>(GetOwningPawn());
    if (!Canvas || !P)
        return;
    ++P->RenderedFrames;
    P->ViewportWidth = Canvas->ClipX;
    P->ViewportHeight = Canvas->ClipY;
    const float Scale = FMath::Min(Canvas->ClipX / 1600.f, Canvas->ClipY / 900.f);
    const float Width = Canvas->ClipX / Scale, Height = Canvas->ClipY / Scale;
    const FLinearColor White(.96f, .965f, .95f), Muted(.64f, .70f, .74f), Orange(FColor(244, 123, 63)),
        Blue(.008f, .014f, .024f, .94f), Background(.006f, .01f, .018f, .84f), Green(.36f, .94f, .57f);
    auto Text = [&](const FString &Label, float X, float Y, float Size, FLinearColor Color,
                    bool Display = false, bool Center = false) {
        // 直接按目标字号栅格化字体，避免放大小位图字体产生毛边；文件随本机运行包烘焙。
        const float FontSize = !Display && Size < 14 ? Size + 1 : Size;
        const FSlateFontInfo Font(Display ? DisplayTypeface.Get() : BodyTypeface.Get(), FontSize * Scale, TEXT("Regular"));
        FCanvasTextItem Item(FVector2D(X * Scale, Y * Scale), FText::FromString(Label), Font, Color);
        Item.bCentreX = Center;
        Item.EnableShadow(FLinearColor(0, 0, 0, .55f), FVector2D(0, Scale));
        Canvas->DrawItem(Item);
    };
    auto Rect = [&](float X, float Y, float W, float H, FLinearColor Color) {
        DrawRect(Color, X * Scale, Y * Scale, W * Scale, H * Scale);
    };
    auto Line = [&](float X1, float Y1, float X2, float Y2, FLinearColor Color, float Thickness = 1.f) {
        DrawLine(X1 * Scale, Y1 * Scale, X2 * Scale, Y2 * Scale, Color, Thickness * Scale);
    };
    // 角落标识和窄计分条把中央留给人物、球和篮圈。
    Rect(34, 32, 4, 40, Orange);
    Text(TEXT("ATHLETICS"), 50, 26, 24, White, true);
    Text(P->bCycling ? TEXT("LAKESIDE  /  ENDURANCE") : TEXT("PERSONAL COURT  /  FREE PRACTICE"),
         50, 60, 10, Muted);
    if (!P->bCycling)
    {
        const float X = Width - 390;
        Rect(X, 30, 356, 95, Blue);
        Rect(X, 30, 356, 3, Orange);
        Text(TEXT("MADE"), X + 18, 41, 10, Muted);
        Text(TEXT("ATT"), X + 111, 41, 10, Muted);
        Text(TEXT("FG"), X + 207, 41, 10, Muted);
        Text(FString::Printf(TEXT("%02d"), P->Ball ? P->Ball->Score : 0), X + 16, 55, 34, White, true);
        Text(FString::Printf(TEXT("%02d"), P->Attempts), X + 109, 55, 34, White, true);
        Text(FString::Printf(TEXT("%.0f%%"), P->Attempts && P->Ball ? 100. * P->Ball->Score / P->Attempts : 0.),
             X + 204, 60, 27, White, true);
        Line(X + 91, 50, X + 91, 106, Muted.CopyWithNewOpacity(.22f));
        Line(X + 186, 50, X + 186, 106, Muted.CopyWithNewOpacity(.22f));
        const int Seconds = int(P->SessionSeconds);
        Text(FString::Printf(TEXT("%02d:%02d"), Seconds / 60, Seconds % 60), X + 281, 78, 13, Muted, true);

        const double SinceRelease = P->SessionSeconds - P->LastReleaseAt;
        if (!P->bCharging && SinceRelease >= 0 && SinceRelease < 3.8)
        {
            const float Alpha = float(FMath::Clamp((3.8 - SinceRelease) / .45, 0., 1.));
            const bool Made = P->Ball && P->LastBasketAt >= P->LastReleaseAt && P->LastBasketScore == P->Ball->Score;
            const bool Excellent = P->Ball && P->Ball->ReleaseAction == 1 && FMath::Abs(P->LastTimingError) <= .055;
            const FLinearColor ResultColor = (Made || Excellent ? Green : Orange).CopyWithNewOpacity(Alpha);
            Rect(Width * .5f - 164, 35, 328, 73, Background.CopyWithNewOpacity(.86f * Alpha));
            Rect(Width * .5f - 164, 35, 3, 73, ResultColor);
            const FString Result = Made ? TEXT("BUCKET") : (P->Ball && P->Ball->ReleaseAction == 1 ?
                SportsPresentation::TimingLabel(P->LastTimingError) :
                (P->Ball && P->Ball->ReleaseAction == 3 ? TEXT("POWER FINISH") : TEXT("SOFT TOUCH")));
            Text(Result, Width * .5f, 39, 25, ResultColor, true, true);
            const FString Detail = P->Ball && P->Ball->ReleaseAction == 1 ?
                FString::Printf(TEXT("%+.0f ms   /   %.1f m   /   %s"), P->LastTimingError * 1000.,
                                 P->LastShotDistanceM, P->bLeftHand ? TEXT("LEFT") : TEXT("RIGHT")) :
                FString::Printf(TEXT("%.1f m   /   %s"), P->LastShotDistanceM, *P->LastReleaseKind);
            Text(Detail, Width * .5f, 81, 11, White.CopyWithNewOpacity(Alpha), false, true);
        }
        if (P->bCharging)
        {
            FVector2D Shoulder;
            if (GetOwningPlayerController()->ProjectWorldLocationToScreen(
                    P->GetActorLocation() + FVector(0, 0, 60), Shoulder))
            {
                const float CX = FMath::Clamp(float(Shoulder.X / Scale + 190), 130.f, Width - 130.f);
                const float CY = FMath::Clamp(float(Shoulder.Y / Scale), 180.f, Height - 220.f);
                const float Radius = 86;
                const double Ideal = SportsMotion::Shot(P->ShotPack).Ideal;
                auto Arc = [&](double A, double B, FLinearColor Color, float Thickness) {
                    const int Segments = FMath::Max(2, FMath::CeilToInt((B - A) * 80));
                    for (int I = 0; I < Segments; ++I)
                    {
                        const double R0 = FMath::DegreesToRadians(240. - FMath::Lerp(A, B, I / double(Segments)) * 120.);
                        const double R1 = FMath::DegreesToRadians(240. - FMath::Lerp(A, B, (I + 1) / double(Segments)) * 120.);
                        Line(CX + Radius * cos(R0), CY + Radius * sin(R0), CX + Radius * cos(R1),
                             CY + Radius * sin(R1), Color, Thickness);
                    }
                };
                Arc(0, 1, Background, 12);
                Arc(0, 1, Muted.CopyWithNewOpacity(.5f), 3);
                Arc((Ideal - .055) / 1.2, (Ideal + .055) / 1.2, Green, 8);
                const double Fraction = FMath::Clamp(P->Charge / 1.2, 0., 1.);
                Arc(0, Fraction, White, 3);
                const double Angle = FMath::DegreesToRadians(240. - Fraction * 120.);
                Line(CX + 76 * cos(Angle), CY + 76 * sin(Angle), CX + 96 * cos(Angle),
                     CY + 96 * sin(Angle), White, 3);
                Text(TEXT("RELEASE"), CX - 62, CY + 103, 10, White, false, true);
            }
        }
        Text(FString::Printf(TEXT("1  %s     2  %s     3  %s"), SportsMotion::Shot(P->ShotPack).Name,
             SportsMotion::Finish(false, P->LayupPack).Name, SportsMotion::Finish(true, P->DunkPack).Name),
             35, Height - 97, 11, White);
    }
    else
    {
        const float X = Width - 295, Y = Height - 240;
        Rect(X, Y, 260, 172, Blue);
        Rect(X, Y, 260, 3, P->bSprintActive ? Orange : Muted);
        Text(FString::Printf(TEXT("%02.0f"), P->SpeedMps * 3.6), X + 17, Y + 6, 57, White, true);
        Text(TEXT("KM/H"), X + 116, Y + 61, 11, Muted);
        Text(FString::Printf(TEXT("%02d"), P->Gear), X + 193, Y + 25, 31, Orange, true);
        Text(TEXT("GEAR"), X + 195, Y + 69, 9, Muted);
        Line(X + 17, Y + 94, X + 241, Y + 94, Muted.CopyWithNewOpacity(.25f));
        Text(FString::Printf(TEXT("%3.0f W     %3.0f RPM     %+.1f%%"), P->RiderPower, P->Cadence, P->Grade * 100.),
             X + 17, Y + 106, 12, White);
        Rect(X + 17, Y + 145, 224, 4, Muted.CopyWithNewOpacity(.25f));
        Rect(X + 17, Y + 145, 224 * float(P->Stamina), 4, P->bSprintActive ? Orange : Green);
        Text(P->bSprintActive ? TEXT("SPRINT") : TEXT("ENDURANCE"), X + 17, Y - 28, 12,
             P->bSprintActive ? Orange : White);
        const float Progress = P->Scene ? float(FMath::Clamp(P->ProgressM / P->Scene->RouteLengthM, 0., 1.)) : 0;
        Text(FString::Printf(TEXT("%.2f  /  3.53 KM"), P->ProgressM / 1000.), Width * .5f, 32, 15, White, true, true);
        Rect(Width * .5f - 140, 63, 280, 3, Background);
        Rect(Width * .5f - 140, 63, 280 * Progress, 3, Orange);
        if (Progress > .997f)
            Text(TEXT("COURSE COMPLETE   /   R  NEW RIDE"), Width * .5f, 100, 20, Green, true, true);
    }
    // 常驻提示只占一行；完整按键和模式切换在 H 中展开。
    Rect(34, Height - 58, Width - 68, 29, Background);
    Text(P->bCycling ? TEXT("W  PEDAL     SHIFT  SPRINT     SPACE  BRAKE     Q E  GEAR     R  RECOVER") :
         TEXT("LMB  HOLD + RELEASE     RMB  AIM     E  DRIBBLE     X  HAND     F  LAYUP     G  DUNK"),
         49, Height - 53, 10, White);
    Text(TEXT("H  CONTROLS     ESC  PAUSE"), Width - 274, Height - 53, 10, Muted);
    if (P->bShowHelp)
    {
        Rect(35, 130, 340, 240, Background);
        Text(TEXT("CONTROLS"), 53, 140, 21, White, true);
        Text(TEXT("W A S D   MOVE / STEER"), 53, 181, 12, White);
        Text(P->bCycling ? TEXT("SPACE / S   BRAKE") : TEXT("SPACE   JUMP     SHIFT   RUN"), 53, 214, 12, White);
        Text(TEXT("V   FIRST / THIRD PERSON"), 53, 247, 12, White);
        Text(TEXT("F1   COURT     F2   LAKESIDE"), 53, 280, 12, White);
        Text(TEXT("F9   PHOTO     F10   QUIT"), 53, 313, 12, White);
        Text(TEXT("H   CLOSE"), 53, 347, 9, Muted);
    }
    if (P->SessionSeconds < P->NoticeUntil)
        Text(P->ActionNotice, Width * .5f, Height - 142, 14, Orange, false, true);
    if (P->bPaused)
    {
        Rect(0, 0, Width, Height, FLinearColor(.018f, .035f, .06f, .72f));
        Text(TEXT("PAUSED"), Width * .5f, Height * .39f, 58, White, true, true);
        Text(TEXT("ESC  RESUME     /     F10  QUIT"), Width * .5f, Height * .39f + 97, 14, White, false, true);
    }
}
