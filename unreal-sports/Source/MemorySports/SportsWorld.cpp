#include "SportsWorld.h"
#include "SportsCharacter.h"
#include "SportsPresentation.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/SceneComponent.h"
#include "ProceduralMeshComponent.h"
#include "Materials/MaterialInterface.h"
#include "Engine/StaticMesh.h"
#include "Engine/SkeletalMesh.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Kismet/GameplayStatics.h"

ASportsWorld::ASportsWorld()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bStartWithTickEnabled = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    RootComponent->SetMobility(EComponentMobility::Static);
    Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    Cylinder = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
}

void ASportsWorld::BeginPlay()
{
    Super::BeginPlay();
    if (!bCycling)
    {
        BuildLiveCourt();
        SetActorTickEnabled(true);
    }
}

void ASportsWorld::BuildLiveCourt()
{
    ActiveNet = NewObject<UInstancedStaticMeshComponent>(this, TEXT("ResponsiveBasketNet"));
    AddInstanceComponent(ActiveNet);
    ActiveNet->SetupAttachment(RootComponent);
    ActiveNet->SetMobility(EComponentMobility::Movable);
    ActiveNet->SetStaticMesh(Cylinder);
    ActiveNet->SetMaterial(0, Material(TEXT("Net")));
    ActiveNet->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    ActiveNet->SetCastShadow(false);
    ActiveNet->RegisterComponent();
    for (int I = 0; I < 132; ++I)
        ActiveNet->AddInstance(FTransform::Identity);
    UpdateNet();
    LiveScore = NewObject<UTextRenderComponent>(this, TEXT("LiveTrainingScore"));
    AddInstanceComponent(LiveScore);
    LiveScore->SetupAttachment(RootComponent);
    LiveScore->SetRelativeLocation(FVector(2200, 0, 720));
    LiveScore->SetRelativeRotation(FRotator(0, 180, 0));
    LiveScore->SetHorizontalAlignment(EHTA_Center);
    LiveScore->SetWorldSize(80);
    LiveScore->SetTextRenderColor(FColor(242, 233, 206));
    LiveScore->RegisterComponent();
}

void ASportsWorld::ReactToBasket(const FVector &Crossing, const FVector &Velocity, bool Dunk)
{
    if (!ActiveNet)
        return;
    NetClock = 0;
    NetStrength = Dunk ? 1.45f : .85f;
    NetDirection = Velocity.GetSafeNormal2D();
    if (NetDirection.IsNearlyZero())
        NetDirection = (Crossing - Rim).GetSafeNormal2D();
    ++NetReactions;
}

void ASportsWorld::UpdateNet()
{
    if (!ActiveNet)
        return;
    int Index = 0;
    auto Point = [&](double Angle, int Row) {
        return SportsPresentation::NetPoint(Rim, Angle, Row, NetClock, NetStrength, NetDirection);
    };
    auto Strand = [&](const FVector &A, const FVector &B) {
        const FVector Delta = B - A;
        const FTransform Pose(FQuat::FindBetweenNormals(FVector::UpVector, Delta.GetSafeNormal()),
                              (A + B) * .5, FVector(.17 / 50., .17 / 50., Delta.Size() / 100.));
        ActiveNet->UpdateInstanceTransform(Index, Pose, false, Index == 131, true);
        ++Index;
    };
    for (int Row = 0; Row < 5; ++Row)
        for (int I = 0; I < 12; ++I)
        {
            const double A = (I + (Row % 2 ? .5 : 0.)) * 2 * PI / 12;
            const double B = (I + (Row % 2 ? 0. : .5)) * 2 * PI / 12;
            Strand(Point(A, Row), Point(B, Row + 1));
            Strand(Point(A, Row), Point(B + (Row % 2 ? 1 : -1) * 2 * PI / 12, Row + 1));
        }
    for (int I = 0; I < 12; ++I)
        Strand(Point((I + .5) * 2 * PI / 12, 5), Point((I + 1.5) * 2 * PI / 12, 5));
}

void ASportsWorld::Tick(float Dt)
{
    Super::Tick(Dt);
    if (NetClock < 2.5)
    {
        NetClock += Dt;
        if (NetClock >= 2.5)
            NetStrength = 0;
        UpdateNet();
    }
    ScoreClock += Dt;
    if (LiveScore && ScoreClock >= .25)
    {
        if (const auto *Player = Cast<ASportsCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
            LiveScore->SetText(FText::FromString(FString::Printf(TEXT("%02d  /  %02d"),
                                Player->Ball ? Player->Ball->Score : 0, Player->Attempts)));
        ScoreClock = 0;
    }
}

FString ASportsWorld::ConfigurePersonalAvatar()
{
#if WITH_EDITOR
    auto *Personal = LoadObject<USkeletalMesh>(nullptr,
        TEXT("/Game/PrivateAvatar/PersonalAthlete/SkeletalMeshes/PersonalAthlete.PersonalAthlete"));
    auto *Reference = LoadObject<USkeletalMesh>(nullptr,
        TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"));
    if (!Personal || !Reference)
        return TEXT("ERROR: missing local mesh");
    const auto &Source = Personal->GetRefSkeleton(), &Target = Reference->GetRefSkeleton();
    double MaxAngle = 0, MaxPosition = 0;
    for (int I = 0; I < Source.GetNum(); ++I)
    {
        const int J = Target.FindBoneIndex(Source.GetBoneName(I));
        if (J == INDEX_NONE)
            return FString::Printf(TEXT("ERROR: unmatched bone %s"), *Source.GetBoneName(I).ToString());
        const FTransform A = Source.GetRefBonePose()[I], B = Target.GetRefBonePose()[J];
        MaxAngle = FMath::Max(MaxAngle, double(A.GetRotation().AngularDistance(B.GetRotation())));
        MaxPosition = FMath::Max(MaxPosition, FVector::Distance(A.GetTranslation(), B.GetTranslation()));
    }
    if (MaxAngle > .005 || MaxPosition > .1)
        return FString::Printf(TEXT("ERROR: bind mismatch %.6f radians %.4f cm"), MaxAngle, MaxPosition);
    Personal->SetSkeleton(Reference->GetSkeleton());
    Personal->MarkPackageDirty();
    return FString::Printf(TEXT("OK: %d matching bones; %.6f radians %.4f cm"), Source.GetNum(), MaxAngle, MaxPosition);
#else
    return TEXT("Editor only");
#endif
}

UMaterialInterface *ASportsWorld::Material(const FString &Name) const
{
    return LoadObject<UMaterialInterface>(
        nullptr, *FString::Printf(TEXT("/Game/MemorySports/Materials/M_%s.M_%s"), *Name, *Name));
}

void ASportsWorld::Box(const FString &Mat, FVector P, FVector Size, FRotator R, bool Collision)
{
    const FString Key = Mat + (Collision ? TEXT("_Solid") : TEXT("_Visual"));
    UInstancedStaticMeshComponent *&Batch = Batches.FindOrAdd(Key);
    if (!Batch)
    {
        Batch = NewObject<UInstancedStaticMeshComponent>(this);
        AddInstanceComponent(Batch);
        Batch->SetupAttachment(RootComponent);
        Batch->SetStaticMesh(Cube);
        Batch->SetMaterial(0, Material(Mat));
        Batch->SetMobility(EComponentMobility::Static);
        Batch->SetCollisionProfileName(Collision ? TEXT("BlockAll") : TEXT("NoCollision"));
        Batch->SetCollisionEnabled(Collision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
        Batch->SetCollisionObjectType(ECC_WorldStatic);
        Batch->RegisterComponent();
    }
    Batch->AddInstance(FTransform(R, P, Size / 100.0));
}

void ASportsWorld::Tube(const FString &Mat, FVector A, FVector B, float Radius, bool Collision)
{
    const FString Key = Mat + TEXT("_Tube") + (Collision ? TEXT("_Solid") : TEXT("_Visual"));
    UInstancedStaticMeshComponent *&Batch = Batches.FindOrAdd(Key);
    if (!Batch)
    {
        Batch = NewObject<UInstancedStaticMeshComponent>(this);
        AddInstanceComponent(Batch);
        Batch->SetupAttachment(RootComponent);
        Batch->SetStaticMesh(Cylinder);
        Batch->SetMaterial(0, Material(Mat));
        Batch->SetMobility(EComponentMobility::Static);
        Batch->SetCollisionProfileName(Collision ? TEXT("BlockAll") : TEXT("NoCollision"));
        Batch->SetCollisionEnabled(Collision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
        Batch->SetCollisionObjectType(ECC_WorldStatic);
        Batch->RegisterComponent();
    }
    const FVector D = B - A;
    Batch->AddInstance(FTransform(FQuat::FindBetweenNormals(FVector::UpVector, D.GetSafeNormal()), (A + B) * .5,
                                  FVector(Radius / 50., Radius / 50., D.Size() / 100.)));
}

UStaticMeshComponent *ASportsWorld::DynamicPart(AActor *PartOwner, const FString &Mat, UStaticMesh *Shape, FVector P,
                                                FVector Scale, FRotator R)
{
    auto *C = NewObject<UStaticMeshComponent>(PartOwner);
    PartOwner->AddInstanceComponent(C);
    C->SetupAttachment(PartOwner->GetRootComponent());
    C->SetStaticMesh(Shape);
    C->SetMaterial(0, Material(Mat));
    C->SetRelativeLocation(P);
    C->SetRelativeScale3D(Scale);
    C->SetRelativeRotation(R);
    C->SetCollisionProfileName(TEXT("NoCollision"));
    C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    C->SetMobility(EComponentMobility::Movable);
    C->RegisterComponent();
    return C;
}

void ASportsWorld::Hoop(float Side)
{
    const float X = Side * 1242.5f, BoardX = X + Side * 37.5f;
    Box(TEXT("Steel"), FVector(BoardX + Side * 130, 0, 180), FVector(24, 26, 360));
    Box(TEXT("Padding"), FVector(BoardX + Side * 130, 0, 85), FVector(50, 65, 170));
    Tube(TEXT("Steel"), FVector(BoardX + Side * 130, 0, 315), FVector(BoardX, 0, 360), 9, true);
    Box(TEXT("Glass"), FVector(BoardX, 0, 355), FVector(4, 180, 105));
    for (float Y : {-91.f, 91.f})
        Box(TEXT("White"), FVector(BoardX - Side * 3, Y, 355), FVector(5, 3, 108));
    for (float Z : {302.f, 408.f})
        Box(TEXT("White"), FVector(BoardX - Side * 3, 0, Z), FVector(5, 184, 3));
    for (float Y : {-30.f, 30.f})
        Box(TEXT("White"), FVector(BoardX - Side * 4, Y, 333), FVector(2, 3, 45));
    for (float Z : {311.f, 355.f})
        Box(TEXT("White"), FVector(BoardX - Side * 4, 0, Z), FVector(2, 62, 3));
    // 篮圈分段碰撞使用真实 45.72 厘米内径；篮球不是沿预设轨道穿框。
    const FVector Center(X, 0, 305);
    for (int I = 0; I < 48; I++)
    {
        const double A = I * 2 * PI / 48, B = (I + 1) * 2 * PI / 48;
        Tube(TEXT("Rim"), Center + FVector(cos(A) * 23.7, sin(A) * 23.7, 0),
             Center + FVector(cos(B) * 23.7, sin(B) * 23.7, 0), .85, true);
    }
    // 目标篮圈的网绳在运行时创建，以真实穿框事件驱动；远端篮网保留静态批次。
    for (int Row = 0; Side < 0 && Row < 5; Row++)
        for (int I = 0; I < 12; I++)
        {
            const double A = I * 2 * PI / 12, B = (I + (Row % 2 ? -.5 : .5)) * 2 * PI / 12;
            const float R0 = 22.f - Row * 1.9f, R1 = 22.f - (Row + 1) * 1.9f;
            Tube(TEXT("Net"), Center + FVector(cos(A) * R0, sin(A) * R0, -Row * 8.f),
                 Center + FVector(cos(B) * R1, sin(B) * R1, -(Row + 1) * 8.f), .24);
        }
}

void ASportsWorld::Court()
{
    Box(TEXT("Concrete"), FVector(0, 0, -28), FVector(4600, 3500, 40));
    Box(TEXT("Wood"), FVector(0, 0, -3), FVector(3600, 2450, 6));
    // 标线尺寸以米转换为厘米，地板与标线用独立薄几何避免模糊贴纸。
    for (float Y : {-750.f, 750.f})
        Box(TEXT("White"), FVector(0, Y, 1), FVector(2800, 5, 1), FRotator::ZeroRotator, false);
    for (float X : {-1400.f, 1400.f, 0.f})
        Box(TEXT("White"), FVector(X, 0, 1), FVector(5, 1500, 1), FRotator::ZeroRotator, false);
    auto Circle = [&](FVector C, float Radius, float A0, float A1) {
        for (int I = 0; I < 96; I++)
        {
            const float A = FMath::Lerp(A0, A1, I / 96.f), B = FMath::Lerp(A0, A1, (I + 1) / 96.f);
            const FVector P = C + FVector(cos(A), sin(A), 0) * Radius, Q = C + FVector(cos(B), sin(B), 0) * Radius;
            Box(TEXT("White"), (P + Q) * .5, FVector((Q - P).Size() + .5, 5, 1), (Q - P).Rotation(), false);
        }
    };
    Circle(FVector(0, 0, 1), 180, 0, 2 * PI);
    for (float Side : {-1.f, 1.f})
    {
        const float X = Side * 1400;
        Box(TEXT("Paint"), FVector(Side * 1110, 0, .5), FVector(580, 490, .5), FRotator::ZeroRotator, false);
        for (float Y : {-245.f, 245.f})
            Box(TEXT("White"), FVector(Side * 1110, Y, 1.5), FVector(580, 5, 1), FRotator::ZeroRotator, false);
        Box(TEXT("White"), FVector(Side * 820, 0, 1.5), FVector(5, 490, 1), FRotator::ZeroRotator, false);
        Circle(FVector(Side * 820, 0, 1.7), 180, 0, 2 * PI);
        const float ArcAngle = FMath::Asin(660.f / 675.f);
        Circle(FVector(Side * 1242.5, 0, 1.7), 675, Side > 0 ? PI - ArcAngle : -ArcAngle,
               Side > 0 ? PI + ArcAngle : ArcAngle);
        for (float Y : {-660.f, 660.f})
            Box(TEXT("White"), FVector(Side * 1250.8, Y, 1.7), FVector(298.4, 5, 1), FRotator::ZeroRotator, false);
        Hoop(Side);
        for (int Row = 0; Row < 3; Row++)
            for (int Seat = 0; Seat < 15; Seat++)
            {
                const float Y = Side * (1270 + Row * 95), Sx = -1000 + Seat * 145;
                Box(TEXT("Concrete"), FVector(Sx, Y, Row * 35 - 3), FVector(138, 93, 12));
                Box(TEXT("Seats"), FVector(Sx, Y, Row * 35 + 50), FVector(45, 45, 8), FRotator::ZeroRotator, false);
                Box(TEXT("Seats"), FVector(Sx, Y + Side * 22, Row * 35 + 78), FVector(45, 6, 55), FRotator::ZeroRotator,
                    false);
                Tube(TEXT("Steel"), FVector(Sx, Y, Row * 35), FVector(Sx, Y, Row * 35 + 47), 4);
            }
    }
    for (float Y : {-1700.f, 1700.f})
    {
        Box(TEXT("Concrete"), FVector(0, Y, 145), FVector(4600, 30, 290));
        Box(TEXT("Wall"), FVector(0, Y, 1010), FVector(4600, 24, 400));
        for (int I = -4; I <= 4; I++)
        {
            Box(TEXT("Steel"), FVector(I * 510, Y, 660), FVector(16, 24, 760));
            Box(TEXT("Glass"), FVector(I * 510 + 255, Y, 650), FVector(492, 5, 710), FRotator::ZeroRotator, false);
        }
        for (int I = -6; I <= 6; I++)
            Box(TEXT("Padding"), FVector(I * 245, Y - FMath::Sign(Y) * 22, 95), FVector(235, 20, 190));
    }
    for (float X : {-2250.f, 2250.f})
    {
        Box(TEXT("Wall"), FVector(X, 0, 600), FVector(30, 3450, 1200));
        for (float Y : {-1050.f, 1050.f})
            Box(TEXT("Padding"), FVector(X - FMath::Sign(X) * 25, Y, 115), FVector(30, 900, 230));
    }
    Box(TEXT("Ceiling"), FVector(0, 0, 1240), FVector(4550, 3500, 20));
    for (int I = -3; I <= 3; I++)
    {
        const float X = I * 650;
        Tube(TEXT("Steel"), FVector(X, -1700, 1100), FVector(X, 1700, 1100), 9);
        Tube(TEXT("Steel"), FVector(X, -1700, 1200), FVector(X, 1700, 1200), 7);
        for (int J = -4; J < 4; J++)
        {
            Tube(TEXT("Steel"), FVector(X, J * 425, 1100), FVector(X, (J + 1) * 425, 1200), 3);
            Tube(TEXT("Steel"), FVector(X, J * 425, 1200), FVector(X, (J + 1) * 425, 1100), 3);
        }
        for (float Y : {-620.f, 620.f})
            Box(TEXT("Light"), FVector(X, Y, 1065), FVector(170, 32, 8), FRotator::ZeroRotator, false);
    }
    auto *Title = NewObject<UTextRenderComponent>(this);
    AddInstanceComponent(Title);
    Title->SetupAttachment(RootComponent);
    Title->SetText(FText::FromString(TEXT("MEMORY PALACE  /  ATHLETICS")));
    Title->SetWorldSize(68);
    Title->SetHorizontalAlignment(EHTA_Center);
    Title->SetRelativeLocation(FVector(-2225, 0, 650));
    Title->SetRelativeRotation(FRotator(0, 0, 0));
    Title->SetTextRenderColor(FColor(218, 225, 220));
    Title->RegisterComponent();
}

void ASportsWorld::Valley()
{
    FString Text;
    if (!FFileHelper::LoadFileToString(Text, *(FPaths::ProjectContentDir() / TEXT("Data/environment.json"))))
        return;
    TSharedPtr<FJsonObject> Data;
    if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Data) || !Data.IsValid())
        return;
    RouteLengthM = Data->GetNumberField(TEXT("length"));
    for (const auto &Value : Data->GetArrayField(TEXT("route")))
    {
        const auto &P = Value->AsObject()->GetArrayField(TEXT("p"));
        Route.Add(FVector(P[0]->AsNumber(), P[1]->AsNumber(), P[2]->AsNumber()));
    }
    for (const auto &Value : Data->GetArrayField(TEXT("meshes")))
    {
        const auto Obj = Value->AsObject();
        TArray<FVector> V;
        TArray<int32> I;
        TArray<FVector2D> UV;
        const auto &Vertices = Obj->GetArrayField(TEXT("vertices"));
        for (int N = 0; N < Vertices.Num(); N += 3)
            V.Emplace(Vertices[N]->AsNumber(), Vertices[N + 1]->AsNumber(), Vertices[N + 2]->AsNumber());
        for (const auto &N : Obj->GetArrayField(TEXT("indices")))
            I.Add(int32(N->AsNumber()));
        // 网页网格使用逆时针正面，Unreal 使用顺时针正面，导入时统一翻转绕序。
        for (int N = 0; N < I.Num(); N += 3)
            Swap(I[N + 1], I[N + 2]);
        const auto &Tex = Obj->GetArrayField(TEXT("uv"));
        for (int N = 0; N < Tex.Num(); N += 2)
            UV.Emplace(Tex[N]->AsNumber(), Tex[N + 1]->AsNumber());
        // 森林根部射线与玩家出生都依赖这些碰撞体，创建阶段需同步完成物理烘焙。
        auto *Mesh = NewObject<UProceduralMeshComponent>(this);
        AddInstanceComponent(Mesh);
        Mesh->SetupAttachment(RootComponent);
        Mesh->SetMobility(EComponentMobility::Static);
        Mesh->bUseAsyncCooking = false;
        TArray<FVector> Normals;
        TArray<FProcMeshTangent> Tangents;
        Normals.Init(FVector::ZeroVector, V.Num());
        Tangents.SetNum(V.Num());
        // 规则地形已经共享顶点，按索引累积法线即可；避免通用重叠搜索的平方时间开销。
        for (int N = 0; N < I.Num(); N += 3)
        {
            const FVector Face = FVector::CrossProduct(V[I[N + 2]] - V[I[N]], V[I[N + 1]] - V[I[N]]);
            for (int K = 0; K < 3; ++K)
                Normals[I[N + K]] += Face;
        }
        for (int N = 0; N < V.Num(); ++N)
        {
            Normals[N] = Normals[N].GetSafeNormal();
            Tangents[N] = FProcMeshTangent((FVector::ForwardVector - Normals[N] * Normals[N].X).GetSafeNormal(), false);
        }
        Mesh->SetCollisionProfileName(TEXT("BlockAll"));
        Mesh->RegisterComponent();
        Mesh->CreateMeshSection_LinearColor(0, V, I, Normals, UV, TArray<FLinearColor>(), Tangents, true);
        Mesh->SetMaterial(0, Material(Obj->GetStringField(TEXT("material"))));
        Mesh->SetCollisionObjectType(ECC_WorldStatic);
    }
    const auto &Lake = Data->GetObjectField(TEXT("lake"));
    const auto &P = Lake->GetArrayField(TEXT("center"));
    const auto &Radii = Lake->GetArrayField(TEXT("radius"));
    auto *Water = NewObject<UProceduralMeshComponent>(this);
    AddInstanceComponent(Water);
    Water->SetupAttachment(RootComponent);
    Water->SetCollisionProfileName(TEXT("NoCollision"));
    Water->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Water->RegisterComponent();
    // 圆形边界完全覆盖原盆地；去掉大立方体在低岸处露出的矩形水面边角。
    TArray<FVector> WaterVertices, WaterNormals;
    TArray<FVector2D> WaterUV;
    TArray<int32> WaterIndices;
    const FVector WaterCenter(P[0]->AsNumber(), P[1]->AsNumber(), P[2]->AsNumber());
    WaterVertices.Add(WaterCenter);
    WaterNormals.Add(FVector::UpVector);
    WaterUV.Add(FVector2D(.5, .5));
    for (int I = 0; I <= 192; ++I)
    {
        const double Angle = I * 2 * PI / 192;
        WaterVertices.Add(WaterCenter + FVector(cos(Angle) * Radii[0]->AsNumber() * 1.4,
                                                sin(Angle) * Radii[1]->AsNumber() * 1.4, 0));
        WaterNormals.Add(FVector::UpVector);
        WaterUV.Add(FVector2D(.5 + cos(Angle) * .5, .5 + sin(Angle) * .5));
        if (I < 192)
            WaterIndices.Append({0, I + 2, I + 1});
    }
    Water->CreateMeshSection_LinearColor(0, WaterVertices, WaterIndices, WaterNormals, WaterUV,
                                        TArray<FLinearColor>(), TArray<FProcMeshTangent>(), false);
    Water->SetMaterial(0, Material(TEXT("Water")));
    FRandomStream Random(314159);
    // 所有树根取渲染网格三角面的射线命中；树冠是既有 CC0 扫描派生，避免整排等距复制。
    auto *Tree = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/MemorySports/Scans/Fir/StaticMeshes/Fir.Fir"));
    if (Tree && Route.Num() > 0)
    {
        auto *Forest = NewObject<UInstancedStaticMeshComponent>(this);
        AddInstanceComponent(Forest);
        Forest->SetupAttachment(RootComponent);
        Forest->SetStaticMesh(Tree);
        Forest->SetCullDistances(35000, 135000);
        Forest->SetCollisionProfileName(TEXT("NoCollision"));
        Forest->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Forest->RegisterComponent();
        for (int N = 0; N < 650; N++)
        {
            const int J = Random.RandRange(1, Route.Num() - 2);
            const FVector Side =
                FVector::CrossProduct((Route[J + 1] - Route[J]).GetSafeNormal(), FVector::UpVector).GetSafeNormal();
            const FVector Base = Route[J] + Side * Random.FRandRange(1100, 24000) * (N % 2 ? 1 : -1);
            const double Radius = FMath::Square((Base.X - P[0]->AsNumber()) / Radii[0]->AsNumber()) +
                                  FMath::Square((Base.Y - P[1]->AsNumber()) / Radii[1]->AsNumber());
            if (Radius < 1.16)
                continue;
            FHitResult Hit;
            FCollisionQueryParams Params;
            if (GetWorld()->LineTraceSingleByChannel(Hit, Base + FVector(0, 0, 25000), Base - FVector(0, 0, 50000),
                                                     ECC_Visibility, Params))
                Forest->AddInstance(FTransform(FRotator(0, Random.FRandRange(0, 360), 0),
                                               Hit.ImpactPoint - FVector(0, 0, 2),
                                               FVector(Random.FRandRange(.75, 1.35))));
        }
    }
    for (int J = 0; J < Route.Num() - 1; J += 5)
    {
        const FVector T = (Route[J + 1] - Route[J]).GetSafeNormal(),
                      N = FVector::CrossProduct(T, FVector::UpVector).GetSafeNormal();
        for (float Side : {-1.f, 1.f})
        {
            const FVector P0 = Route[J] + N * Side * 385;
            Box(TEXT("White"), P0 + FVector(0, 0, 43), FVector(9, 12, 86), T.Rotation());
            Box(TEXT("Steel"), P0 + FVector(0, 0, 65), FVector(10, 13, 16), T.Rotation(), false);
        }
    }
    if (Route.Num() > 1)
        Start = Route[0] + FVector(0, 0, 100);
}

void ASportsWorld::BuildScene()
{
    TArray<UActorComponent *> Old = GetInstanceComponents();
    for (auto *C : Old)
        if (C)
            C->DestroyComponent();
    Batches.Empty();
    Route.Empty();
    if (bCycling)
    {
        Valley();
        ValleyDetails();
    }
    else
    {
        Court();
        CourtDetails();
    }
}

void ASportsWorld::Label(const FString &Text, FVector Position, float Size, float Yaw)
{
    auto *C = NewObject<UTextRenderComponent>(this);
    AddInstanceComponent(C);
    C->SetupAttachment(RootComponent);
    C->SetRelativeLocation(Position);
    C->SetRelativeRotation(FRotator(0, Yaw, 0));
    C->SetText(FText::FromString(Text));
    C->SetWorldSize(Size);
    C->SetHorizontalAlignment(EHTA_Center);
    C->SetTextRenderColor(FColor(214, 229, 200));
    C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    C->RegisterComponent();
}

void ASportsWorld::Instance(const FString &Key, const FString &Mat, UStaticMesh *Mesh,
                           const FTransform &Transform, int32 CullDistance)
{
    if (!Mesh)
        return;
    UInstancedStaticMeshComponent *&Batch = Batches.FindOrAdd(Key);
    if (!Batch)
    {
        Batch = NewObject<UInstancedStaticMeshComponent>(this);
        AddInstanceComponent(Batch);
        Batch->SetupAttachment(RootComponent);
        Batch->SetStaticMesh(Mesh);
        Batch->SetMaterial(0, Material(Mat));
        Batch->SetMobility(EComponentMobility::Static);
        Batch->SetCollisionProfileName(TEXT("NoCollision"));
        Batch->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        if (CullDistance > 0)
        {
            Batch->SetCullDistances(CullDistance * .65, CullDistance);
            Batch->SetCastShadow(false);
        }
        Batch->RegisterComponent();
    }
    Batch->AddInstance(Transform);
}

void ASportsWorld::CourtDetails()
{
    // 器材均放在场地边界外；使用材质分组实例，避免增加大量独立 Actor。
    for (float Y : {-1040.f, 1040.f})
    {
        for (int I = 0; I < 3; ++I)
        {
            const FVector Base(-520 + I * 345, Y, 0);
            Box(TEXT("Timber"), Base + FVector(0, 0, 47), FVector(280, 46, 7));
            for (float X : {-110.f, 110.f})
                Box(TEXT("Steel"), Base + FVector(X, 0, 23), FVector(7, 38, 44));
            Box(TEXT("Fabric"), Base + FVector(-75, 0, 53), FVector(50, 38, 5), FRotator(0, 8, 0), false);
            Tube(TEXT("White"), Base + FVector(48, 0, 51), Base + FVector(48, 0, 74), 4);
            Tube(TEXT("Padding"), Base + FVector(48, 0, 74), Base + FVector(48, 0, 77), 3);
        }
    }
    for (int I = 0; I < 7; ++I)
    {
        const FVector P(-450 + I * 155, -845, 0);
        Box(TEXT("Cone"), P + FVector(0, 0, 2), FVector(28, 28, 4), FRotator::ZeroRotator, false);
        // 分层收细的路标，保持近景轮廓，且不侵入正式球场。
        for (int J = 0; J < 7; ++J)
            Box(J == 4 ? TEXT("White") : TEXT("Cone"), P + FVector(0, 0, 5 + J * 4),
                FVector(22 - J * 2.6, 22 - J * 2.6, 4), FRotator::ZeroRotator, false);
    }
    const FVector Rack(1570, 945, 0);
    for (float X : {-80.f, 80.f})
        for (float Y : {-25.f, 25.f})
            Tube(TEXT("Steel"), Rack + FVector(X, Y, 8), Rack + FVector(X, Y, 122), 2.5);
    for (float Z : {38.f, 90.f})
    {
        for (float Y : {-22.f, 22.f})
            Tube(TEXT("Steel"), Rack + FVector(-88, Y, Z), Rack + FVector(88, Y, Z), 2);
        for (int I = 0; I < 5; ++I)
            Instance(TEXT("RackBalls"), TEXT("Ball"), Sphere,
                     FTransform(FRotator(10 * I, 37 * I, 0), Rack + FVector(-65 + I * 32, 0, Z + 10), FVector(.242)));
    }
    Box(TEXT("Padding"), FVector(2215, 0, 730), FVector(18, 580, 220));
    Label(TEXT("TRAINING SESSION"), FVector(2202, 0, 805), 34, 180);
    Label(TEXT("MADE     /     ATTEMPTED"), FVector(2200, 0, 656), 23, 180);
    for (float Y : {-1700.f, 1700.f})
        for (int I = -8; I <= 8; ++I)
            Box(TEXT("Steel"), FVector(I * 255, Y, 650), FVector(4, 8, 710), FRotator::ZeroRotator, false);
    for (int I = -6; I <= 6; ++I)
        Box(TEXT("Timber"), FVector(-2227, I * 230, 390), FVector(5, 190, 70), FRotator::ZeroRotator, false);
    Label(TEXT("FOOTWORK   /   FORM   /   FINISH"), FVector(-2225, 0, 540), 31, 0);
}

void ASportsWorld::ValleyDetails()
{
    if (Route.Num() < 2)
        return;
    FRandomStream Random(181021);
    auto *Grass = LoadObject<UStaticMesh>(nullptr,
        TEXT("/Game/MemorySports/Scans/GrassClump/StaticMeshes/GrassClump.GrassClump"));
    auto *Stone = LoadObject<UStaticMesh>(nullptr,
        TEXT("/Game/MemorySports/Scans/ShoreStone/StaticMeshes/ShoreStone.ShoreStone"));
    auto GroundPoint = [&](const FVector &P, FVector &Out, float MinSlope) {
        FHitResult Hit;
        if (!GetWorld()->LineTraceSingleByChannel(Hit, P + FVector(0, 0, 20000),
                                                  P - FVector(0, 0, 30000), ECC_Visibility))
            return false;
        Out = Hit.ImpactPoint;
        return Hit.ImpactNormal.Z >= MinSlope && Out.Z > 300;
    };
    for (double M = 3; M < RouteLengthM; M += 8)
    {
        FVector P, T;
        SampleRoute(M, P, T);
        const FVector N = FVector::CrossProduct(T, FVector::UpVector).GetSafeNormal();
        for (float Side : {-1.f, 1.f})
        {
            for (int J = 0; J < 4; ++J)
            {
                FVector Base;
                const FVector Seed = P + N * Side * Random.FRandRange(390, 2150) + T * Random.FRandRange(-350, 350);
                if (GroundPoint(Seed, Base, .77) && Base.Z > P.Z - 550)
                    Instance(TEXT("RoadsideGrass"), TEXT("Grass"), Grass,
                        FTransform(FRotator(0, Random.FRandRange(0, 360), 0), Base - FVector(0, 0, 2),
                                   FVector(Random.FRandRange(.65, 1.5))), 11000);
            }
            if (Random.FRand() < .6)
            {
                FVector Base;
                if (GroundPoint(P + N * Side * Random.FRandRange(355, 510), Base, .65))
                    Instance(TEXT("ShoulderStones"), TEXT("Gravel"), Stone,
                        FTransform(FRotator(0, Random.FRandRange(0, 360), 0), Base,
                            FVector(Random.FRandRange(.045, .22), Random.FRandRange(.05, .20), Random.FRandRange(.05, .20))), 14000);
            }
        }
        // 外弯或临坡段提供短护栏，不在平缓内侧整圈围挡。
        FVector Ahead, Direction;
        SampleRoute(FMath::Min(M + 12, RouteLengthM), Ahead, Direction);
        if (FVector::DotProduct(T, Direction) < .96 && int(M) % 3 == 0)
        {
            for (float Side : {-1.f, 1.f})
            {
                const FVector A = P + N * Side * 430, B = Ahead + N * Side * 430;
                Tube(TEXT("Steel"), A + FVector(0, 0, 76), B + FVector(0, 0, 76), 4);
                Tube(TEXT("Timber"), A, A + FVector(0, 0, 88), 7, true);
            }
        }
    }
    for (double M : {400., 1050., 1800., 2450., 3200.})
    {
        FVector P, T, Base;
        SampleRoute(M, P, T);
        const FVector N = FVector::CrossProduct(T, FVector::UpVector).GetSafeNormal();
        if (!GroundPoint(P + N * 660, Base, .85) || FMath::Abs(Base.Z - P.Z) > 240)
            continue;
        const FRotator R(0, T.Rotation().Yaw, 0);
        auto At = [&](FVector Offset) { return Base + R.RotateVector(Offset); };
        Box(TEXT("Gravel"), At(FVector(0, 0, -3)), FVector(510, 340, 8), R, false);
        Box(TEXT("Timber"), At(FVector(0, 0, 48)), FVector(230, 48, 7), R);
        Box(TEXT("Timber"), At(FVector(0, 22, 77)), FVector(230, 6, 53), R);
        for (float X : {-85.f, 85.f})
            Box(TEXT("Steel"), At(FVector(X, 0, 23)), FVector(7, 40, 44), R);
        for (float X : {-150.f, -110.f})
        {
            Tube(TEXT("Steel"), At(FVector(X, -70, 0)), At(FVector(X, -70, 75)), 3);
            Tube(TEXT("Steel"), At(FVector(X, -125, 0)), At(FVector(X, -125, 75)), 3);
            Tube(TEXT("Steel"), At(FVector(X, -70, 75)), At(FVector(X, -125, 75)), 3);
        }
        Tube(TEXT("Timber"), At(FVector(210, 40, 0)), At(FVector(210, 40, 220)), 6);
        Box(TEXT("Padding"), At(FVector(210, 40, 180)), FVector(8, 110, 64), R);
        Label(FString::Printf(TEXT("%.1f KM\nLAKE ROUTE"), M / 1000),
              At(FVector(204, 40, 192)), 19, R.Yaw + 180);
    }
    FString Source;
    TSharedPtr<FJsonObject> Data;
    if (FFileHelper::LoadFileToString(Source, *(FPaths::ProjectContentDir() / TEXT("Data/environment.json"))) &&
        FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Source), Data) && Data.IsValid())
    {
        const auto Lake = Data->GetObjectField(TEXT("lake"));
        const auto &C = Lake->GetArrayField(TEXT("center")), &Radii = Lake->GetArrayField(TEXT("radius"));
        const FVector Center(C[0]->AsNumber(), C[1]->AsNumber(), C[2]->AsNumber());
        for (int I = 0; I < 240; ++I)
        {
            const double Angle = (I + Random.FRandRange(-.3, .3)) * 2 * PI / 240.;
            const FVector Radial(cos(Angle) * Radii[0]->AsNumber(), sin(Angle) * Radii[1]->AsNumber(), 0);
            FVector Base;
            // 按实际地形寻找水位交界，避免岸石悬空。
            double Low = .65, High = 1.55;
            for (int Step = 0; Step < 11; ++Step)
            {
                const double Mid = (Low + High) * .5;
                if (GroundPoint(Center + Radial * Mid, Base, .1) && Base.Z > Center.Z + 7)
                    High = Mid;
                else
                    Low = Mid;
            }
            if (!GroundPoint(Center + Radial * High, Base, .60) || FMath::Abs(Base.Z - Center.Z) > 95)
                continue;
            Instance(TEXT("ShoreRocks"), TEXT("Rock"), Stone,
                FTransform(FRotator(0, Random.FRandRange(0, 360), 0), Base - FVector(0, 0, 5),
                           FVector(Random.FRandRange(.22, .75), Random.FRandRange(.3, .9), Random.FRandRange(.12, .4))));
            FVector GrassBase;
            if (GroundPoint(Center + Radial * (High + .006), GrassBase, .72))
                Instance(TEXT("ShoreGrass"), TEXT("Grass"), Grass,
                    FTransform(FRotator(0, Random.FRandRange(0, 360), 0), GrassBase,
                               FVector(Random.FRandRange(1.1, 1.9))), 13000);
        }
    }
}

void ASportsWorld::SampleRoute(double DistanceM, FVector &Position, FVector &Tangent) const
{
    if (Route.Num() < 2)
    {
        Position = FVector::ZeroVector;
        Tangent = FVector::ForwardVector;
        return;
    }
    const double U = FMath::Clamp(DistanceM / RouteLengthM, 0., 1.) * (Route.Num() - 1);
    const int I = FMath::Min(FMath::FloorToInt(U), Route.Num() - 2);
    Position = FMath::Lerp(Route[I], Route[I + 1], U - I);
    Tangent = (Route[I + 1] - Route[I]).GetSafeNormal();
}

double ASportsWorld::ClosestProgress(const FVector &Position) const
{
    double Best = DBL_MAX;
    int Closest = 0;
    for (int I = 0; I < Route.Num(); I++)
    {
        const double D = FVector::DistSquared2D(Position, Route[I]);
        if (D < Best)
        {
            Best = D;
            Closest = I;
        }
    }
    return Route.Num() > 1 ? Closest * RouteLengthM / (Route.Num() - 1) : 0.;
}

void ASportsWorld::BuildBike(AActor *PartOwner)
{
    auto Part = [&](const FString &Mat, FVector A, FVector B, float R) {
        const FVector D = B - A;
        return DynamicPart(PartOwner, Mat, Cylinder, (A + B) * .5, FVector(R / 50, R / 50, D.Size() / 100),
                           FQuat::FindBetweenNormals(FVector::UpVector, D.GetSafeNormal()).Rotator());
    };
    const FVector Back(-54, 0, -54), Front(54, 0, -54), Bottom(-8, 0, -56), Seat(-20, 0, 2), Head(36, 0, 0);
    for (auto Edge : {TPair<FVector, FVector>(Back, Bottom),
                      {Bottom, Seat},
                      {Seat, Back},
                      {Seat, Head},
                      {Head, Bottom},
                      {Head, Front}})
        Part(TEXT("BikePaint"), Edge.Key, Edge.Value, 2.5);
    for (const FVector Center : {Back, Front})
    {
        // 每个车轮保留独立组件，轮速来自真实前进距离。
        auto *Tire = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/MemorySports/Scans/Wheel/StaticMeshes/Wheel.Wheel"));
        auto *Wheel = DynamicPart(PartOwner, TEXT("Rubber"), Tire, Center, FVector::OneVector, FRotator(0, 0, 90));
        Wheels.Add(Wheel);
        for (int I = 0; I < 24; I++)
        {
            const double A = I * 2 * PI / 24, B = (I + 1) * 2 * PI / 24;
            auto *Spoke = Part(TEXT("Steel"), Center, Center + FVector(cos(A) * 31, 0, sin(A) * 31), .13f);
            Spoke->AttachToComponent(Wheel, FAttachmentTransformRules::KeepWorldTransform);
            auto *RimPart = Part(TEXT("Steel"), Center + FVector(cos(A) * 31.8, 0, sin(A) * 31.8),
                                 Center + FVector(cos(B) * 31.8, 0, sin(B) * 31.8), .35f);
            RimPart->AttachToComponent(Wheel, FAttachmentTransformRules::KeepWorldTransform);
        }
    }
    DynamicPart(PartOwner, TEXT("Padding"), Cube, Seat + FVector(-3, 0, 5), FVector(.24, .16, .045),
                FRotator::ZeroRotator);
    Part(TEXT("Steel"), Head, Head + FVector(2, 0, 22), 1.8);
    Handlebar = Part(TEXT("Rubber"), Head + FVector(5, -21, 22), Head + FVector(5, 21, 22), 1.8);
    // 曲柄、链条和水壶提供近景结构；踏板与曲柄由真实踏频驱动。
    for (float Side : {-1.f, 1.f})
        Cranks.Add(Part(TEXT("Steel"), Bottom + FVector(0, Side * 9, 0),
                       Bottom + FVector(Side * 17, Side * 9, 0), 1.2));
    for (float Z : {-2.f, 2.f})
        Part(TEXT("Steel"), Back + FVector(0, 5, Z), Bottom + FVector(0, 5, Z), .28);
    Part(TEXT("White"), FVector(5, 0, -36), FVector(10, 0, -18), 3.2);
    Part(TEXT("Padding"), FVector(10, 0, -18), FVector(11, 0, -15), 2.5);
    for (float Side : {-1.f, 1.f})
        Pedals.Add(DynamicPart(PartOwner, TEXT("Rubber"), Cube, Bottom + FVector(17 * Side, 12 * Side, 0),
                               FVector(.11, .09, .025), FRotator::ZeroRotator));
}
