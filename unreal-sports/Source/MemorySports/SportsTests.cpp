#include "SportsMath.h"
#include "SportsMotion.h"
#include "SportsPresentation.h"
#include "Misc/AutomationTest.h"
#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsShotTest, "MemorySports.Physics.BallisticRelease",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsShotTest::RunTest(const FString &)
{
    const FVector Start(400, 20, 185), Target(1400, 0, 309);
    const double T = 1.2;
    const FVector V = SportsMath::ShotVelocity(Start, Target, T, -980);
    TestTrue(TEXT("真实释放点的抛体在指定时间到达篮圈"),
             (Start + V * T + FVector(0, 0, -490 * T * T)).Equals(Target, .01));
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsScoreTest, "MemorySports.Physics.DownwardBasketOnly",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsScoreTest::RunTest(const FString &)
{
    const FVector Rim(1400, 0, 305);
    TestTrue(TEXT("下降穿过内圈计分"),
             SportsMath::CrossedBasket(Rim + FVector(0, 0, 40), Rim - FVector(0, 0, 40), Rim));
    TestFalse(TEXT("上升穿框不计分"), SportsMath::CrossedBasket(Rim - FVector(0, 0, 40), Rim + FVector(0, 0, 40), Rim));
    TestFalse(TEXT("框外下落不计分"),
              SportsMath::CrossedBasket(Rim + FVector(35, 0, 40), Rim + FVector(35, 0, -40), Rim));
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsBikeTest, "MemorySports.Physics.GradeAndBraking",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsBikeTest::RunTest(const FString &)
{
    TestTrue(TEXT("下坡滑行加速"), SportsMath::BikeAcceleration(5, -.1, 0, false, false) > 0);
    TestTrue(TEXT("上坡同功率更慢"), SportsMath::BikeAcceleration(5, .08, 220, false, false) <
                                         SportsMath::BikeAcceleration(5, 0, 220, false, false));
    double V = 12;
    for (int I = 0; I < 360; ++I)
        V = FMath::Max(0., V + SportsMath::BikeAcceleration(V, 0, 0, true, false) / 120.);
    TestTrue(TEXT("持续制动三秒可停车"), V < .01);
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsDragTest, "MemorySports.Physics.DragCompensatedShot",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsDragTest::RunTest(const FString &)
{
    const FVector Start(426, 9, 210), Target(1242.5, 0, 305), Terminal(0, 0, -980 / .03);
    const double T = 1.4, K = .03;
    const FVector Velocity = SportsMath::ShotVelocity(Start, Target, T, -980, K);
    const FVector End = Start + (Velocity - Terminal) * (1 - FMath::Exp(-K * T)) / K + Terminal * T;
    TestTrue(TEXT("含阻尼的抛体与解析解一致"), End.Equals(Target, .01));
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsSteerTest, "MemorySports.Physics.GearingAndLateralLimit",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsSteerTest::RunTest(const FString &)
{
    TestTrue(TEXT("低挡提供更大的起步驱动力"), SportsMath::BikeAcceleration(0, 0, 200, false, false, .82) >
                                                   SportsMath::BikeAcceleration(0, 0, 200, false, false, 3.8));
    for (double Speed : {4., 8., 15., 24.})
        TestTrue(TEXT("高速转向横向加速度受限"),
                 Speed * Speed * FMath::Tan(SportsMath::BikeSteeringLimit(Speed)) / 1.08 <= 4.50001);
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsSprintTest, "MemorySports.Physics.SprintAndBrakePriority",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsSprintTest::RunTest(const FString &)
{
    double Normal = 0, Sprint = 0;
    for (int I = 0; I < 1200; ++I)
    {
        Normal = FMath::Max(0., Normal + SportsMath::BikeAcceleration(Normal, 0, 195, false, false, 1.6) / 120.);
        Sprint = FMath::Max(0., Sprint + SportsMath::BikeAcceleration(Sprint, 0, 650, false, false, 1.6, 115) / 120.);
    }
    TestTrue(TEXT("十秒冲刺比常规踩踏至少快 6 km/h"), (Sprint - Normal) * 3.6 > 6.);
    TestEqual(TEXT("制动时驱动力归零"), SportsMath::BikeAcceleration(5, 0, 650, true, false),
              SportsMath::BikeAcceleration(5, 0, 0, true, false));
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsFinishTest, "MemorySports.Physics.MotionReachAndTiming",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsFinishTest::RunTest(const FString &)
{
    TestFalse(TEXT("远距离不能触发扣篮"), SportsMotion::CanFinish(600, true, true));
    TestFalse(TEXT("空中不能重复起跳扣篮"), SportsMotion::CanFinish(200, true, false));
    TestTrue(TEXT("近框可触发上篮"), SportsMotion::CanFinish(400, false, true));
    for (int I = 0; I < 2; ++I)
    {
        const auto &P = SportsMotion::Finish(true, I);
        const double T = P.Release - P.Gather;
        const double Height = 90 + P.JumpVelocity * T - .5 * 1225 * T * T + P.HandHeight;
        TestTrue(TEXT("扣篮出手高度可越过真实篮圈和球半径"), Height > 305 + 12.1);
    }
    TestTrue(TEXT("投篮包节奏有明确区别"), SportsMotion::Shot(0).Ideal + .2 < SportsMotion::Shot(2).Ideal);
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsNetTest, "MemorySports.Presentation.NetResponse",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsNetTest::RunTest(const FString &)
{
    const FVector Center(1242.5, 0, 305), Direction(1, .5, 0);
    for (double Time = 0; Time < 3.; Time += .013)
    {
        TestTrue(TEXT("篮网顶排始终固定于篮圈"),
                 SportsPresentation::NetPoint(Center, 0, 0, Time, 1.45, Direction).Equals(Center + FVector(22, 0, 0), .001));
        for (int Row = 1; Row <= 5; ++Row)
        {
            const FVector P = SportsPresentation::NetPoint(Center, .7, Row, Time, 1.45, Direction);
            TestFalse(TEXT("响应不产生非有限顶点"), P.ContainsNaN());
            TestTrue(TEXT("网绳始终位于篮圈下方"), P.Z < Center.Z);
        }
    }
    const FVector Rest = SportsPresentation::NetPoint(Center, .3, 5, 0, 0, Direction);
    const FVector Moving = SportsPresentation::NetPoint(Center, .3, 5, .12, 1.45, Direction);
    const FVector Settled = SportsPresentation::NetPoint(Center, .3, 5, 3., 1.45, Direction);
    TestTrue(TEXT("穿框后下部拉伸"), Moving.Z < Rest.Z - 4.);
    TestTrue(TEXT("三秒后衰减到静止形态"), Settled.Equals(Rest, .01));
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSportsFeedbackTest, "MemorySports.Presentation.TimingFeedback",
                                 EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSportsFeedbackTest::RunTest(const FString &)
{
    TestEqual(TEXT("提前释放明确反馈"), FString(SportsPresentation::TimingLabel(-.12)), FString(TEXT("EARLY")));
    TestEqual(TEXT("窗口内释放明确反馈"), FString(SportsPresentation::TimingLabel(.03)), FString(TEXT("EXCELLENT")));
    TestEqual(TEXT("延后释放明确反馈"), FString(SportsPresentation::TimingLabel(.12)), FString(TEXT("LATE")));
    return true;
}
#endif
