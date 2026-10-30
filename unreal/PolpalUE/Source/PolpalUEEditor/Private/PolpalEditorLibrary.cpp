#include "PolpalEditorLibrary.h"

#include "Animation/AnimMontage.h"
#include "Animation/AnimBlueprint.h"
#include "Animation/AnimSequence.h"
#include "Animation/BlendSpace1D.h"
#include "Animation/PalAnimInstance.h"
#include "Animation/PalAimOffsetBlendSpace.h"
#include "Animation/PalLocomotionBlendSpace.h"
#include "Animation/PalAnimNotifies.h"
#include "AnimationBlueprintLibrary.h"
#include "AssetToolsModule.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "EditorAssetLibrary.h"
#include "Factories/AnimMontageFactory.h"
#include "Factories/BlendSpaceFactory1D.h"
#include "Factories/AnimBlueprintFactory.h"
#include "Factories/AimOffsetBlendSpaceFactoryNew.h"
#include "AnimGraphNode_BlendSpacePlayer.h"
#include "AnimGraphNode_BlendListByInt.h"
#include "AnimGraphNode_LayeredBoneBlend.h"
#include "AnimGraphNode_LocalToComponentSpace.h"
#include "AnimGraphNode_ComponentToLocalSpace.h"
#include "AnimGraphNode_ModifyBone.h"
#include "AnimGraphNode_RotationOffsetBlendSpace.h"
#include "AnimGraphNode_Root.h"
#include "AnimGraphNode_SaveCachedPose.h"
#include "AnimGraphNode_SequencePlayer.h"
#include "AnimGraphNode_Slot.h"
#include "AnimGraphNode_UseCachedPose.h"
#include "AnimGraphNode_TwoBoneIK.h"
#include "AnimationGraph.h"
#include "Animation/AnimData/BoneMaskFilter.h"
#include "K2Node_VariableGet.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphPin.h"
#include "EdGraph/EdGraphSchema.h"
#include "Misc/FileHelper.h"
#include "HAL/FileManager.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Animation/Skeleton.h"
#include "ReferenceSkeleton.h"
#include "Animation/AnimData/IAnimationDataModel.h"
#include "Engine/SkeletalMesh.h"
#include "Misc/Paths.h"
#include "BlackboardDataFactory.h"
#include "BehaviorTreeFactory.h"
#include "BehaviorTree/BlackboardData.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BehaviorTree/Composites/BTComposite_Selector.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Bool.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Enum.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Float.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Object.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Vector.h"
#include "EnvironmentQuery/EnvQuery.h"
#include "EnvironmentQuery/EnvQueryOption.h"
#include "EnvironmentQuery/Generators/EnvQueryGenerator_Donut.h"
#include "EnvironmentQuery/Tests/EnvQueryTest_Distance.h"
#include "EnvironmentQuery/Tests/EnvQueryTest_Trace.h"
#include "AI/PalBehaviorNodes.h"
#include "Data/PalData.h"
#include "AI/BaseCampManager.h"
#include "AI/BaseServiceStation.h"
#include "AI/WorkStation.h"
#include "Characters/PalCharacter.h"
#include "Characters/PolpalPlayerCharacter.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/World.h"
#include "GameFramework/PlayerStart.h"
#include "GameFramework/Character.h"
#include "NavMesh/NavMeshBoundsVolume.h"
#include "Builders/CubeBuilder.h"
#include "NavigationSystem.h"
#include "Landscape.h"
#include "LandscapeInfo.h"
#include "LandscapeEditorModule.h"
#include "LandscapeFileFormatInterface.h"
#include "FileHelpers.h"

namespace PolpalEditor
{
    static FString AssetPath(const FString& Folder, const FString& Name)
    {
        return Folder / Name;
    }

    static bool Save(UObject* Asset, const FString& Path, FPolpalEditorBuildReport& Report)
    {
        if (!Asset || !UEditorAssetLibrary::SaveLoadedAsset(Asset, false))
        {
            Report.Failed.Add(FString::Printf(TEXT("Save failed: %s"), *Path));
            // This helper is called only for newly created assets. Do not leave an
            // incomplete asset for the next idempotent run to mistake as manual.
            if (Asset && UEditorAssetLibrary::DoesAssetExist(Path) &&
                !UEditorAssetLibrary::DeleteAsset(Path))
                Report.Failed.Add(FString::Printf(TEXT("Could not remove unsaved asset: %s"), *Path));
            return false;
        }
        Report.Created.Add(Path);
        return true;
    }

    template <typename T>
    static T* LoadTyped(const FString& Path, FPolpalEditorBuildReport& Report)
    {
        T* Asset = Cast<T>(UEditorAssetLibrary::LoadAsset(Path));
        if (!Asset)
        {
            Report.Failed.Add(FString::Printf(TEXT("Expected %s at %s"), *T::StaticClass()->GetName(), *Path));
        }
        return Asset;
    }

    static TSharedPtr<FJsonObject> ReadManifest(const FString& Path, FPolpalEditorBuildReport& Report)
    {
        FString Text;
        if (!FFileHelper::LoadFileToString(Text, *Path))
        {
            Report.Failed.Add(FString::Printf(TEXT("Cannot read manifest: %s"), *Path));
            return nullptr;
        }
        TSharedPtr<FJsonObject> Object;
        const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
        if (!FJsonSerializer::Deserialize(Reader, Object) || !Object.IsValid()
            || Object->GetIntegerField(TEXT("schema_version")) != 1)
        {
            Report.Failed.Add(TEXT("Invalid pipeline manifest schema"));
            return nullptr;
        }
        return Object;
    }

    static void Finish(FPolpalEditorBuildReport& Report)
    {
        Report.bOk = Report.Failed.IsEmpty();
        Report.Status = !Report.bOk ? TEXT("failed") :
            (Report.Pending.IsEmpty() ? TEXT("prepared_assets") : TEXT("prepared_assets_with_pending_work"));
    }

    static UEdGraphPin* FirstPin(UEdGraphNode* Node, EEdGraphPinDirection Direction)
    {
        if (!Node) return nullptr;
        for (UEdGraphPin* Pin : Node->Pins)
            if (Pin && Pin->Direction == Direction) return Pin;
        return nullptr;
    }

    template <typename T>
    static T* AddGraphNode(UEdGraph* Graph, int32 X, int32 Y)
    {
        T* Node = NewObject<T>(Graph);
        Graph->AddNode(Node, true, false);
        Node->CreateNewGuid();
        Node->PostPlacedNewNode();
        Node->NodePosX = X;
        Node->NodePosY = Y;
        Node->AllocateDefaultPins();
        return Node;
    }

    static bool Connect(UEdGraph* Graph, UEdGraphPin* Output, UEdGraphPin* Input)
    {
        return Output && Input && Graph->GetSchema()->TryCreateConnection(Output, Input);
    }

    static UPalAimOffsetBlendSpace* BuildAimOffset(IAssetTools& Tools, const TSharedPtr<FJsonObject>& Spec,
        const FString& Folder, const FString& Name, USkeletalMesh* Mesh, UAnimSequence* Idle,
        FPolpalEditorBuildReport& Report)
    {
        const TSharedPtr<FJsonObject>* AimSpec = nullptr;
        if (!Spec->TryGetObjectField(TEXT("aim_offset"), AimSpec) || !AimSpec || !AimSpec->IsValid()) return nullptr;
        const FString Path = AssetPath(Folder, TEXT("AO_") + Name);
        if (UEditorAssetLibrary::DoesAssetExist(Path))
        {
            UPalAimOffsetBlendSpace* Existing = LoadTyped<UPalAimOffsetBlendSpace>(Path, Report);
            if (Existing && Existing->GetSkeleton() == Mesh->GetSkeleton() && Existing->GetBlendSamples().Num() == 9)
            {
                Report.Skipped.Add(Path);
                return Existing;
            }
            Report.Failed.Add(TEXT("Existing Aim Offset is incomplete: ") + Path);
            return nullptr;
        }
        UAimOffsetBlendSpaceFactoryNew* Factory = NewObject<UAimOffsetBlendSpaceFactoryNew>();
        Factory->TargetSkeleton = Mesh->GetSkeleton();
        Factory->PreviewSkeletalMesh = Mesh;
        UPalAimOffsetBlendSpace* Aim = Cast<UPalAimOffsetBlendSpace>(Tools.CreateAsset(
            FPaths::GetBaseFilename(Path), Folder, UPalAimOffsetBlendSpace::StaticClass(), Factory));
        if (!Aim) { Report.Failed.Add(TEXT("Aim Offset factory failed: ") + Path); return nullptr; }
        const int32 InitialFailures = Report.Failed.Num();
        Aim->ConfigurePrototypeAxes();
        Aim->PreviewBasePose = Idle;
        const TArray<TSharedPtr<FJsonValue>>* Poses = nullptr;
        if (!(*AimSpec)->TryGetArrayField(TEXT("poses"), Poses) || !Poses || Poses->Num() != 9)
        {
            Report.Failed.Add(TEXT("Aim Offset requires nine poses: ") + Path);
            UEditorAssetLibrary::DeleteAsset(Path);
            return nullptr;
        }
        for (const TSharedPtr<FJsonValue>& Value : *Poses)
        {
            const TSharedPtr<FJsonObject> PoseSpec = Value->AsObject();
            if (!PoseSpec.IsValid()) { Report.Failed.Add(TEXT("Invalid Aim Offset pose: ") + Path); break; }
            const FString PoseName = PoseSpec->GetStringField(TEXT("name"));
            UAnimSequence* Pose = LoadTyped<UAnimSequence>(AssetPath(Folder,
                FString::Printf(TEXT("A_%s_%s"), *Name, *PoseName)), Report);
            if (!Pose || !Pose->GetDataModel() || Pose->GetDataModel()->GetNumberOfKeys() < 2
                || Pose->AdditiveAnimType != AAT_RotationOffsetMeshSpace
                || Pose->RefPoseSeq != Idle || Pose->RefFrameIndex != 0)
            {
                Report.Failed.Add(TEXT("Aim Offset pose lacks two frames or mesh-space additive base: ") + PoseName);
                break;
            }
            const int32 Index = Aim->AddSample(Pose, FVector(
                PoseSpec->GetNumberField(TEXT("yaw")), PoseSpec->GetNumberField(TEXT("pitch")), 0));
            if (Index == INDEX_NONE || !Aim->UseSingleFrame(Index, 1))
            {
                Report.Failed.Add(TEXT("Aim Offset sample frame 2 failed: ") + PoseName);
                break;
            }
        }
        if (Aim->GetBlendSamples().Num() != 9 || Report.Failed.Num() != InitialFailures)
        {
            if (!UEditorAssetLibrary::DeleteAsset(Path))
                Report.Failed.Add(TEXT("Could not delete incomplete Aim Offset: ") + Path);
            return nullptr;
        }
        Aim->ValidateSampleData();
        if (!Aim->IsValidAdditive())
        {
            Report.Failed.Add(TEXT("Aim Offset additive validation failed: ") + Path);
            if (!UEditorAssetLibrary::DeleteAsset(Path))
                Report.Failed.Add(TEXT("Could not delete invalid Aim Offset: ") + Path);
            return nullptr;
        }
        if (!Save(Aim, Path, Report)) return nullptr;
        return Aim;
    }

    static bool BuildAnimGraph(UAnimBlueprint* BP, UBlendSpace1D* Blend,
        UPalAimOffsetBlendSpace* Aim, UAnimSequence* Jump, UAnimSequence* Fall,
        UAnimSequence* Land, FString& Error)
    {
        UEdGraph* Graph = nullptr;
        TArray<UAnimationGraph*> Graphs;
        UAnimationBlueprintLibrary::GetAnimationGraphs(BP, Graphs);
        if (!Graphs.IsEmpty()) Graph = Graphs[0];
        if (!Graph) { Error = TEXT("Animation graph missing from factory Blueprint"); return false; }
        UAnimGraphNode_Root* Root = FBlueprintEditorUtils::GetAnimGraphRoot(Graph);
        if (!Root) { Error = TEXT("AnimGraph root missing"); return false; }
        UAnimGraphNode_BlendSpacePlayer* Locomotion = AddGraphNode<UAnimGraphNode_BlendSpacePlayer>(Graph, -900, 0);
        if (!Locomotion->Node.SetBlendSpace(Blend))
        {
            Error = TEXT("BlendSpacePlayer rejected Blend Space"); return false;
        }
        Locomotion->ReconstructNode();
        UK2Node_VariableGet* Speed = AddGraphNode<UK2Node_VariableGet>(Graph, -1150, 200);
        Speed->VariableReference.SetSelfMember(GET_MEMBER_NAME_CHECKED(UPalAnimInstance, BlendSpeed));
        Speed->ReconstructNode();
        UEdGraphPin* SpeedInput = Locomotion->FindPin(TEXT("X"));
        if (!Connect(Graph, FirstPin(Speed, EGPD_Output), SpeedInput))
        {
            Error = TEXT("BlendSpeed variable could not connect to BlendSpace X"); return false;
        }
        UAnimGraphNode_BlendListByInt* AirSelector =
            AddGraphNode<UAnimGraphNode_BlendListByInt>(Graph, -700, 350);
        auto AirPosePins = [AirSelector]()
        {
            TArray<UEdGraphPin*> Pins;
            for (UEdGraphPin* Pin : AirSelector->Pins)
                if (Pin && Pin->Direction == EGPD_Input &&
                    Pin->PinName.ToString().StartsWith(TEXT("BlendPose_"))) Pins.Add(Pin);
            return Pins;
        };
        for (int32 Attempt = 0; Attempt < 4 && AirPosePins().Num() < 4; ++Attempt)
            AirSelector->AddPinToBlendList();
        const TArray<UEdGraphPin*> PosePins = AirPosePins();
        if (PosePins.Num() != 4 || !Connect(Graph, FirstPin(Locomotion, EGPD_Output), PosePins[0]))
        {
            Error = TEXT("Four-pose locomotion selector setup failed"); return false;
        }
        UAnimSequence* AirClips[] = {Jump, Fall, Land};
        for (int32 Index = 0; Index < 3; ++Index)
        {
            UAnimGraphNode_SequencePlayer* Player =
                AddGraphNode<UAnimGraphNode_SequencePlayer>(Graph, -1050, 450 + Index * 220);
            Player->SetAnimationAsset(AirClips[Index]);
            Player->Node.SetLoopAnimation(Index == 1);
            Player->ReconstructNode();
            if (!Connect(Graph, FirstPin(Player, EGPD_Output), PosePins[Index + 1]))
            {
                Error = TEXT("Jump/fall/land sequence could not connect"); return false;
            }
        }
        UK2Node_VariableGet* Phase = AddGraphNode<UK2Node_VariableGet>(Graph, -1000, 1150);
        Phase->VariableReference.SetSelfMember(GET_MEMBER_NAME_CHECKED(UPalAnimInstance, LocomotionPhase));
        Phase->ReconstructNode();
        if (!Connect(Graph, FirstPin(Phase, EGPD_Output), AirSelector->FindPin(TEXT("ActiveChildIndex"))))
        {
            Error = TEXT("LocomotionPhase could not connect to jump/fall/land selector"); return false;
        }
        UEdGraphPin* CurrentPose = FirstPin(AirSelector, EGPD_Output);
        auto CacheForTwoBranches = [Graph, &Error](UEdGraphPin* Source, const FString& Name,
            int32 X, int32 Y, UEdGraphPin*& First, UEdGraphPin*& Second) -> bool
        {
            UAnimGraphNode_SaveCachedPose* SaveNode = AddGraphNode<UAnimGraphNode_SaveCachedPose>(Graph, X, Y);
            SaveNode->CacheName = Name;
            SaveNode->Node.CachePoseName = FName(*Name);
            SaveNode->ReconstructNode();
            if (!Connect(Graph, Source, FirstPin(SaveNode, EGPD_Input)))
            {
                Error = TEXT("Could not save cached pose: ") + Name;
                return false;
            }
            UAnimGraphNode_UseCachedPose* FirstUse = AddGraphNode<UAnimGraphNode_UseCachedPose>(Graph, X + 180, Y - 130);
            UAnimGraphNode_UseCachedPose* SecondUse = AddGraphNode<UAnimGraphNode_UseCachedPose>(Graph, X + 180, Y + 130);
            for (UAnimGraphNode_UseCachedPose* Use : {FirstUse, SecondUse})
            {
                Use->SaveCachedPoseNode = SaveNode;
                Use->Node.CachePoseName = FName(*Name);
                Use->ReconstructNode();
            }
            First = FirstPin(FirstUse, EGPD_Output);
            Second = FirstPin(SecondUse, EGPD_Output);
            return First && Second;
        };
        if (Aim)
        {
            UEdGraphPin* AimBase = nullptr;
            UEdGraphPin* AimLayerBase = nullptr;
            if (!CacheForTwoBranches(CurrentPose, TEXT("LocomotionPose"), -780, -500,
                AimBase, AimLayerBase)) return false;
            UAnimGraphNode_RotationOffsetBlendSpace* AimNode =
                AddGraphNode<UAnimGraphNode_RotationOffsetBlendSpace>(Graph, -700, -360);
            if (!AimNode->Node.SetBlendSpace(Aim))
            {
                Error = TEXT("Aim Offset node rejected asset"); return false;
            }
            AimNode->Node.Alpha = 1.f;
            AimNode->Node.LODThreshold = 1;
            AimNode->ReconstructNode();
            UK2Node_VariableGet* Yaw = AddGraphNode<UK2Node_VariableGet>(Graph, -950, -240);
            Yaw->VariableReference.SetSelfMember(GET_MEMBER_NAME_CHECKED(UPalAnimInstance, AimYaw));
            Yaw->ReconstructNode();
            UK2Node_VariableGet* Pitch = AddGraphNode<UK2Node_VariableGet>(Graph, -950, -80);
            Pitch->VariableReference.SetSelfMember(GET_MEMBER_NAME_CHECKED(UPalAnimInstance, AimPitch));
            Pitch->ReconstructNode();
            UAnimGraphNode_LayeredBoneBlend* AimLayer =
                AddGraphNode<UAnimGraphNode_LayeredBoneBlend>(Graph, -450, -300);
            if (AimLayer->Node.BlendPoses.IsEmpty()) AimLayer->Node.AddPose();
            if (AimLayer->Node.LayerSetup.IsEmpty())
            {
                Error = TEXT("Aim layered blend has no filter"); return false;
            }
            FBranchFilter AimFilter;
            AimFilter.BoneName = FName(TEXT("spine_01"));
            AimFilter.BlendDepth = 0;
            AimLayer->Node.LayerSetup[0].BranchFilters.Add(AimFilter);
            AimLayer->Node.BlendWeights[0] = 1.f;
            AimLayer->Node.bMeshSpaceRotationBlend = true;
            AimLayer->ReconstructNode();
            if (!Connect(Graph, AimBase, AimNode->FindPin(TEXT("BasePose")))
                || !Connect(Graph, FirstPin(Yaw, EGPD_Output), AimNode->FindPin(TEXT("X")))
                || !Connect(Graph, FirstPin(Pitch, EGPD_Output), AimNode->FindPin(TEXT("Y")))
                || !Connect(Graph, AimLayerBase, AimLayer->FindPin(TEXT("BasePose")))
                || !Connect(Graph, FirstPin(AimNode, EGPD_Output), AimLayer->FindPin(TEXT("BlendPoses_0"))))
            {
                Error = TEXT("Aim Offset could not connect yaw, pitch or spine_01 layer"); return false;
            }
            CurrentPose = FirstPin(AimLayer, EGPD_Output);
        }
        const TCHAR* SlotNames[] = {TEXT("UpperBodyAttack"), TEXT("UpperBodyWork"), TEXT("Carry")};
        int32 X = -600;
        for (const TCHAR* SlotName : SlotNames)
        {
            UEdGraphPin* SlotSource = nullptr;
            UEdGraphPin* LayerBase = nullptr;
            if (!CacheForTwoBranches(CurrentPose, FString(TEXT("Before")) + SlotName,
                X - 150, 350, SlotSource, LayerBase)) return false;
            UAnimGraphNode_Slot* Slot = AddGraphNode<UAnimGraphNode_Slot>(Graph, X, 0);
            Slot->Node.SlotName = FName(SlotName);
            Slot->ReconstructNode();
            if (!Connect(Graph, SlotSource, FirstPin(Slot, EGPD_Input)))
            {
                Error = FString::Printf(TEXT("Could not connect slot %s"), SlotName); return false;
            }
            UAnimGraphNode_LayeredBoneBlend* Layer = AddGraphNode<UAnimGraphNode_LayeredBoneBlend>(Graph, X + 230, 0);
            if (Layer->Node.BlendPoses.IsEmpty()) Layer->Node.AddPose();
            if (Layer->Node.LayerSetup.IsEmpty())
            {
                Error = TEXT("Layered blend did not create a pose filter"); return false;
            }
            FBranchFilter Filter;
            Filter.BoneName = FName(TEXT("spine_01"));
            Filter.BlendDepth = 0;
            Layer->Node.LayerSetup[0].BranchFilters.Add(Filter);
            Layer->Node.BlendWeights[0] = 1.f;
            Layer->Node.bMeshSpaceRotationBlend = true;
            Layer->ReconstructNode();
            if (!Connect(Graph, LayerBase, Layer->FindPin(TEXT("BasePose")))
                || !Connect(Graph, FirstPin(Slot, EGPD_Output), Layer->FindPin(TEXT("BlendPoses_0"))))
            {
                Error = FString::Printf(TEXT("Could not layer slot %s from spine_01"), SlotName); return false;
            }
            CurrentPose = FirstPin(Layer, EGPD_Output);
            X += 490;
        }
        const FReferenceSkeleton& Reference = BP->TargetSkeleton->GetReferenceSkeleton();
        const bool bTwoFeet = Reference.FindBoneIndex(TEXT("foot_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("foot_r")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("calf_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("calf_r")) != INDEX_NONE;
        const bool bQuadFeet = Reference.FindBoneIndex(TEXT("foreleg_upper_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("foreleg_upper_r")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("foreleg_lower_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("foreleg_lower_r")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("hindleg_upper_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("hindleg_upper_r")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("hindleg_lower_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("hindleg_lower_r")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("hand_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("hand_r")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("foot_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("foot_r")) != INDEX_NONE;
        const bool bLeftHand = Reference.FindBoneIndex(TEXT("hand_l")) != INDEX_NONE &&
            Reference.FindBoneIndex(TEXT("lowerarm_l")) != INDEX_NONE;
        if (bTwoFeet || bQuadFeet || bLeftHand)
        {
            UAnimGraphNode_LocalToComponentSpace* ToComponent =
                AddGraphNode<UAnimGraphNode_LocalToComponentSpace>(Graph, X, -400);
            if (!Connect(Graph, CurrentPose, FirstPin(ToComponent, EGPD_Input)))
            {
                Error = TEXT("IK local-to-component conversion failed"); return false;
            }
            UEdGraphPin* ComponentPose = FirstPin(ToComponent, EGPD_Output);
            if (bTwoFeet || bQuadFeet)
            {
                UAnimGraphNode_ModifyBone* Pelvis =
                    AddGraphNode<UAnimGraphNode_ModifyBone>(Graph, X + 180, -700);
                Pelvis->Node.BoneToModify.BoneName = TEXT("pelvis");
                Pelvis->Node.TranslationMode = BMM_Additive;
                Pelvis->Node.TranslationSpace = BCS_ComponentSpace;
                Pelvis->Node.LODThreshold = 1;
                Pelvis->ReconstructNode();
                UK2Node_VariableGet* Offset = AddGraphNode<UK2Node_VariableGet>(Graph, X, -650);
                Offset->VariableReference.SetSelfMember(GET_MEMBER_NAME_CHECKED(UPalAnimInstance, PelvisIKOffset));
                Offset->ReconstructNode();
                UK2Node_VariableGet* Alpha = AddGraphNode<UK2Node_VariableGet>(Graph, X, -450);
                Alpha->VariableReference.SetSelfMember(GET_MEMBER_NAME_CHECKED(UPalAnimInstance, FootIKAlpha));
                Alpha->ReconstructNode();
                if (!Connect(Graph, ComponentPose, FirstPin(Pelvis, EGPD_Input)) ||
                    !Connect(Graph, FirstPin(Offset, EGPD_Output), Pelvis->FindPin(TEXT("Translation"))) ||
                    !Connect(Graph, FirstPin(Alpha, EGPD_Output), Pelvis->FindPin(TEXT("Alpha"))))
                {
                    Error = TEXT("Pelvis terrain offset graph failed"); return false;
                }
                ComponentPose = FirstPin(Pelvis, EGPD_Output);
            }
            struct FIKSpec { const TCHAR* Bone; const TCHAR* Effector; const TCHAR* Joint; const TCHAR* Alpha; };
            const FIKSpec Solvers[] = {
                {TEXT("foot_l"), TEXT("FootLeftTarget"), TEXT("KneeLeftTarget"), TEXT("FootIKAlpha")},
                {TEXT("foot_r"), TEXT("FootRightTarget"), TEXT("KneeRightTarget"), TEXT("FootIKAlpha")},
                {TEXT("hand_l"), TEXT("ForeLeftTarget"), TEXT("ForeKneeLeftTarget"), TEXT("FootIKAlpha")},
                {TEXT("hand_r"), TEXT("ForeRightTarget"), TEXT("ForeKneeRightTarget"), TEXT("FootIKAlpha")},
                {TEXT("hand_l"), TEXT("HandGripTarget"), TEXT("ElbowLeftTarget"), TEXT("HandIKAlpha")}
            };
            for (int32 Index = 0; Index < 5; ++Index)
            {
                if ((Index < 2 && !(bTwoFeet || bQuadFeet)) ||
                    (Index >= 2 && Index <= 3 && !bQuadFeet) ||
                    (Index == 4 && !bLeftHand)) continue;
                const FIKSpec& Spec = Solvers[Index];
                UAnimGraphNode_TwoBoneIK* IK = AddGraphNode<UAnimGraphNode_TwoBoneIK>(Graph, X + 400 + Index * 350, -400);
                IK->Node.IKBone.BoneName = FName(Spec.Bone);
                IK->Node.EffectorLocationSpace = BCS_WorldSpace;
                IK->Node.JointTargetLocationSpace = BCS_WorldSpace;
                IK->Node.bAllowStretching = false;
                IK->Node.LODThreshold = 1;
                IK->ReconstructNode();
                if (!Connect(Graph, ComponentPose, FirstPin(IK, EGPD_Input)))
                {
                    Error = FString(TEXT("IK pose input failed: ")) + Spec.Bone; return false;
                }
                auto ConnectValue = [&](const TCHAR* Member, const TCHAR* PinName) -> bool
                {
                    UK2Node_VariableGet* Get = AddGraphNode<UK2Node_VariableGet>(Graph,
                        X + Index * 350, -100 + (PinName[0] == 'A' ? 220 : 0));
                    Get->VariableReference.SetSelfMember(FName(Member));
                    Get->ReconstructNode();
                    return Connect(Graph, FirstPin(Get, EGPD_Output), IK->FindPin(FName(PinName)));
                };
                if (!ConnectValue(Spec.Effector, TEXT("EffectorLocation")) ||
                    !ConnectValue(Spec.Joint, TEXT("JointTargetLocation")) ||
                    !ConnectValue(Spec.Alpha, TEXT("Alpha")))
                {
                    Error = FString(TEXT("IK target/alpha input failed: ")) + Spec.Bone; return false;
                }
                ComponentPose = FirstPin(IK, EGPD_Output);
            }
            UAnimGraphNode_ComponentToLocalSpace* ToLocal =
                AddGraphNode<UAnimGraphNode_ComponentToLocalSpace>(Graph, X + 2300, -400);
            if (!Connect(Graph, ComponentPose, FirstPin(ToLocal, EGPD_Input)))
            {
                Error = TEXT("IK component-to-local conversion failed"); return false;
            }
            CurrentPose = FirstPin(ToLocal, EGPD_Output);
        }
        UEdGraphPin* RootPose = FirstPin(Root, EGPD_Input);
        if (RootPose) RootPose->BreakAllPinLinks();
        if (!Connect(Graph, CurrentPose, RootPose))
        {
            Error = TEXT("Could not connect locomotion to AnimGraph root"); return false;
        }
        FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);
        FKismetEditorUtilities::CompileBlueprint(BP);
        if (BP->Status != BS_UpToDate || !BP->GeneratedClass)
        {
            Error = TEXT("AnimBlueprint compilation failed"); return false;
        }
        return true;
    }

    static void BuildAnimBlueprint(IAssetTools& Tools, const FString& Folder, const FString& Name,
        USkeletalMesh* Mesh, UBlendSpace1D* Blend, UPalAimOffsetBlendSpace* Aim,
        UAnimSequence* Jump, UAnimSequence* Fall, UAnimSequence* Land,
        FPolpalEditorBuildReport& Report)
    {
        const FString Path = AssetPath(Folder, TEXT("ABP_") + Name);
        if (UEditorAssetLibrary::DoesAssetExist(Path))
        {
            UAnimBlueprint* Existing = LoadTyped<UAnimBlueprint>(Path, Report);
            if (Existing && Existing->TargetSkeleton == Mesh->GetSkeleton() && Existing->GeneratedClass)
                Report.Skipped.Add(Path);
            else Report.Failed.Add(TEXT("Existing AnimBlueprint is invalid or uses another skeleton: ") + Path);
            return;
        }
        UAnimBlueprintFactory* Factory = NewObject<UAnimBlueprintFactory>();
        Factory->ParentClass = UPalAnimInstance::StaticClass();
        Factory->TargetSkeleton = Mesh->GetSkeleton();
        Factory->PreviewSkeletalMesh = Mesh;
        UAnimBlueprint* BP = Cast<UAnimBlueprint>(Tools.CreateAsset(FPaths::GetBaseFilename(Path), Folder,
            UAnimBlueprint::StaticClass(), Factory));
        if (!BP)
        {
            Report.Failed.Add(TEXT("AnimBlueprint factory failed: ") + Path);
            return;
        }
        FString Error;
        if (!BuildAnimGraph(BP, Blend, Aim, Jump, Fall, Land, Error))
        {
            Report.Failed.Add(TEXT("AnimBlueprint graph failed: ") + Path + TEXT("; ") + Error);
            if (!UEditorAssetLibrary::DeleteAsset(Path))
                Report.Failed.Add(TEXT("Could not remove incomplete AnimBlueprint: ") + Path);
            return;
        }
        Save(BP, Path, Report);
    }
}

FPolpalEditorBuildReport UPolpalEditorLibrary::BuildAnimationAssets(const FString& ManifestPath)
{
    using namespace PolpalEditor;
    FPolpalEditorBuildReport Report;
    const TSharedPtr<FJsonObject> Manifest = ReadManifest(ManifestPath, Report);
    if (!Manifest.IsValid()) { Finish(Report); return Report; }
    const TArray<TSharedPtr<FJsonValue>>* Archetypes = nullptr;
    if (!Manifest->TryGetArrayField(TEXT("archetypes"), Archetypes) || !Archetypes)
    {
        Report.Failed.Add(TEXT("Manifest has no archetypes"));
        Finish(Report); return Report;
    }
    IAssetTools& Tools = FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get();
    for (const TSharedPtr<FJsonValue>& Value : *Archetypes)
    {
        const TSharedPtr<FJsonObject> Spec = Value->AsObject();
        if (!Spec.IsValid()) { Report.Failed.Add(TEXT("Invalid archetype entry")); continue; }
        FString Id, Name;
        if (!Spec->TryGetStringField(TEXT("id"), Id) || !Spec->TryGetStringField(TEXT("asset_name"), Name))
        {
            Report.Failed.Add(TEXT("Archetype id/name missing")); continue;
        }
        const FString Folder = FString::Printf(TEXT("/Game/Characters/Pals/%s"), *Id);
        const FString MeshPath = AssetPath(Folder, TEXT("SK_") + Name);
        USkeletalMesh* Mesh = LoadTyped<USkeletalMesh>(MeshPath, Report);
        if (!Mesh || !Mesh->GetSkeleton()) { continue; }
        USkeleton* Skeleton = Mesh->GetSkeleton();
        for (const TCHAR* SlotName : {TEXT("UpperBodyAttack"), TEXT("UpperBodyWork"), TEXT("Carry")})
            Skeleton->RegisterSlotNode(FName(SlotName));
        if (!UEditorAssetLibrary::SaveLoadedAsset(Skeleton, false))
        {
            Report.Failed.Add(TEXT("Could not save montage slots on skeleton: ") + MeshPath);
            continue;
        }
        auto Clip = [&](const TCHAR* ClipName) -> UAnimSequence*
        {
            return LoadTyped<UAnimSequence>(AssetPath(Folder, FString::Printf(TEXT("A_%s_%s"), *Name, ClipName)), Report);
        };

        UAnimSequence* Idle = Clip(TEXT("Idle"));
        UAnimSequence* Walk = Clip(TEXT("Walk_Fwd"));
        UAnimSequence* Run = Clip(TEXT("Run_Fwd"));
        UAnimSequence* Jump = Clip(TEXT("Jump_Start"));
        UAnimSequence* Fall = Clip(TEXT("Fall_Loop"));
        UAnimSequence* Land = Clip(TEXT("Land"));
        UBlendSpace1D* Locomotion = nullptr;
        if (Idle && Walk && Run)
        {
            const FString Path = AssetPath(Folder, TEXT("BS_") + Name + TEXT("_Locomotion"));
            if (UEditorAssetLibrary::DoesAssetExist(Path))
            {
                Locomotion = LoadTyped<UBlendSpace1D>(Path, Report);
                if (Locomotion && Locomotion->GetSkeleton() == Skeleton &&
                    FMath::IsNearlyZero(Locomotion->GetBlendParameter(0).Min) &&
                    FMath::IsNearlyEqual(Locomotion->GetBlendParameter(0).Max, 100.f) &&
                    Locomotion->GetBlendSamples().Num() == 3)
                    Report.Skipped.Add(Path);
                else
                {
                    Report.Failed.Add(TEXT("Existing locomotion Blend Space has wrong axis, skeleton or samples: ") + Path);
                    Locomotion = nullptr;
                }
            }
            else
            {
                UBlendSpaceFactory1D* Factory = NewObject<UBlendSpaceFactory1D>();
                Factory->TargetSkeleton = Skeleton;
                Factory->PreviewSkeletalMesh = Mesh;
                UPalLocomotionBlendSpace* Blend = Cast<UPalLocomotionBlendSpace>(Tools.CreateAsset(
                    FPaths::GetBaseFilename(Path), Folder, UPalLocomotionBlendSpace::StaticClass(), Factory));
                if (!Blend) { Report.Failed.Add(TEXT("Blend Space creation failed: ") + Path); }
                else
                {
                    Blend->ConfigurePrototypeAxis();
                    const FBlendParameter& Axis = Blend->GetBlendParameter(0);
                    const float Range = Axis.Max - Axis.Min;
                    if (Range <= 0.f || Blend->AddSample(Idle, FVector(Axis.Min, 0, 0)) == INDEX_NONE
                        || Blend->AddSample(Walk, FVector(Axis.Min + Range * .4f, 0, 0)) == INDEX_NONE
                        || Blend->AddSample(Run, FVector(Axis.Max, 0, 0)) == INDEX_NONE)
                    {
                        Report.Failed.Add(TEXT("Blend Space sample setup failed: ") + Path);
                    }
                    else if (Save(Blend, Path, Report)) { Locomotion = Blend; }
                }
            }
        }
        struct FMontageSpec { const TCHAR* Clip; const TCHAR* Slot; };
        const FMontageSpec Montages[] = {
            {TEXT("Attack_Melee"), TEXT("UpperBodyAttack")},
            {TEXT("Attack_Cast_Skill"), TEXT("UpperBodyAttack")},
            {TEXT("Work_Hammering"), TEXT("UpperBodyWork")},
            {TEXT("Work_Mining"), TEXT("UpperBodyWork")},
            {TEXT("Work_Watering"), TEXT("UpperBodyWork")},
            {TEXT("Work_Carrying_Idle"), TEXT("Carry")}
        };
        for (const FMontageSpec& Entry : Montages)
        {
            UAnimSequence* Sequence = Clip(Entry.Clip);
            if (!Sequence) { continue; }
            const FString Path = AssetPath(Folder, FString::Printf(TEXT("AM_%s_%s"), *Name, Entry.Clip));
            if (UEditorAssetLibrary::DoesAssetExist(Path))
            {
                LoadTyped<UAnimMontage>(Path, Report);
                Report.Skipped.Add(Path);
                continue;
            }
            UAnimMontageFactory* Factory = NewObject<UAnimMontageFactory>();
            Factory->SourceAnimation = Sequence;
            Factory->TargetSkeleton = Skeleton;
            Factory->PreviewSkeletalMesh = Mesh;
            UAnimMontage* Montage = Cast<UAnimMontage>(Tools.CreateAsset(FPaths::GetBaseFilename(Path), Folder, UAnimMontage::StaticClass(), Factory));
            if (!Montage || Montage->SlotAnimTracks.IsEmpty())
            {
                Report.Failed.Add(TEXT("Montage creation/track failed: ") + Path); continue;
            }
            Montage->SlotAnimTracks[0].SlotName = FName(Entry.Slot);
            const FName TrackName(TEXT("PolpalEvents"));
            UAnimationBlueprintLibrary::AddAnimationNotifyTrack(Montage, TrackName, FLinearColor::White);
            const float Duration = Montage->GetPlayLength();
            auto Notify = [&](float Fraction, TSubclassOf<UAnimNotify> Class) -> UAnimNotify*
            {
                return UAnimationBlueprintLibrary::AddAnimationNotifyEvent(Montage, TrackName, Duration * Fraction, Class);
            };
            const FString ClipName(Entry.Clip);
            if (ClipName == TEXT("Attack_Melee"))
            {
                UAN_ToggleHitbox* Begin = Cast<UAN_ToggleHitbox>(Notify(.30f, UAN_ToggleHitbox::StaticClass()));
                UAN_ToggleHitbox* End = Cast<UAN_ToggleHitbox>(Notify(.65f, UAN_ToggleHitbox::StaticClass()));
                if (Begin) Begin->bEnabled = true;
                if (End) End->bEnabled = false;
                if (!Begin || !End) Report.Failed.Add(TEXT("Melee hitbox notify failed: ") + Path);
            }
            else if (ClipName == TEXT("Attack_Cast_Skill"))
            {
                if (!Notify(.55f, UAN_SpawnProjectile::StaticClass())) Report.Failed.Add(TEXT("Projectile notify failed: ") + Path);
            }
            else if (ClipName == TEXT("Work_Hammering") || ClipName == TEXT("Work_Mining"))
            {
                UAN_PlayWorkVFX* Work = Cast<UAN_PlayWorkVFX>(Notify(ClipName == TEXT("Work_Hammering") ? .5f : .58f, UAN_PlayWorkVFX::StaticClass()));
                if (Work) Work->Effect = ClipName == TEXT("Work_Hammering") ? FName(TEXT("hammer_sparks")) : FName(TEXT("mining_sparks"));
                else Report.Failed.Add(TEXT("Work VFX notify failed: ") + Path);
            }
            Save(Montage, Path, Report);
        }
        UPalAimOffsetBlendSpace* Aim = BuildAimOffset(Tools, Spec, Folder, Name, Mesh, Idle, Report);
        if (Locomotion && Jump && Fall && Land)
            BuildAnimBlueprint(Tools, Folder, Name, Mesh, Locomotion, Aim, Jump, Fall, Land, Report);
        else Report.Pending.Add(FString::Printf(TEXT("ABP_%s needs a valid locomotion Blend Space"), *Name));
        Report.Pending.Add(FString::Printf(TEXT("ABP_%s: true Control Rig is not authored; animation phases and IK require UE visual verification"), *Name));
    }
    Finish(Report);
    return Report;
}

FPolpalEditorBuildReport UPolpalEditorLibrary::BuildAIAssets()
{
    using namespace PolpalEditor;
    FPolpalEditorBuildReport Report;
    IAssetTools& Tools = FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get();
    const FString Folder(TEXT("/Game/Core/AI"));
    UEditorAssetLibrary::MakeDirectory(Folder);
    const FString BBPath = AssetPath(Folder, TEXT("BB_Pal"));
    UBlackboardData* BB = nullptr;
    if (UEditorAssetLibrary::DoesAssetExist(BBPath))
    {
        BB = LoadTyped<UBlackboardData>(BBPath, Report);
        Report.Skipped.Add(BBPath);
    }
    else
    {
        BB = Cast<UBlackboardData>(Tools.CreateAsset(TEXT("BB_Pal"), Folder,
            UBlackboardData::StaticClass(), NewObject<UBlackboardDataFactory>()));
        if (!BB) { Report.Failed.Add(TEXT("Blackboard creation failed")); }
        else
        {
            auto AddKey = [BB](FName Name, UBlackboardKeyType* Type)
            {
                FBlackboardEntry Entry;
                Entry.EntryName = Name;
                Entry.KeyType = Type;
                BB->Keys.Add(Entry);
            };
            UBlackboardKeyType_Enum* Activity = NewObject<UBlackboardKeyType_Enum>(BB);
            Activity->EnumType = StaticEnum<EPalActivity>();
            Activity->EnumName = Activity->EnumType->GetName();
            AddKey(TEXT("Activity"), Activity);
            UBlackboardKeyType_Object* Enemy = NewObject<UBlackboardKeyType_Object>(BB);
            Enemy->BaseClass = AActor::StaticClass();
            AddKey(TEXT("EnemyActor"), Enemy);
            AddKey(TEXT("WorkLocation"), NewObject<UBlackboardKeyType_Vector>(BB));
            AddKey(TEXT("ServiceLocation"), NewObject<UBlackboardKeyType_Vector>(BB));
            AddKey(TEXT("Hunger"), NewObject<UBlackboardKeyType_Float>(BB));
            AddKey(TEXT("SAN"), NewObject<UBlackboardKeyType_Float>(BB));
            AddKey(TEXT("IsNight"), NewObject<UBlackboardKeyType_Bool>(BB));
            AddKey(TEXT("HasWork"), NewObject<UBlackboardKeyType_Bool>(BB));
            BB->UpdateKeyIDs();
            Save(BB, BBPath, Report);
        }
    }
    if (!BB) { Finish(Report); return Report; }

    const FString BTPath = AssetPath(Folder, TEXT("BT_Pal"));
    if (UEditorAssetLibrary::DoesAssetExist(BTPath))
    {
        LoadTyped<UBehaviorTree>(BTPath, Report);
        Report.Skipped.Add(BTPath);
    }
    else
    {
        UBehaviorTree* BT = Cast<UBehaviorTree>(Tools.CreateAsset(TEXT("BT_Pal"), Folder,
            UBehaviorTree::StaticClass(), NewObject<UBehaviorTreeFactory>()));
        if (!BT) { Report.Failed.Add(TEXT("Behavior Tree creation failed")); }
        else
        {
            BT->BlackboardAsset = BB;
            UBTComposite_Selector* Selector = NewObject<UBTComposite_Selector>(BT, TEXT("PrioritySelector"));
            Selector->Services.Add(NewObject<UBTService_PalState>(BT));
            auto AddTask = [BT, Selector](UClass* Class, const TCHAR* Name)
            {
                FBTCompositeChild Child;
                Child.ChildTask = NewObject<UBTTaskNode>(BT, Class, FName(Name));
                Selector->Children.Add(MoveTemp(Child));
            };
            AddTask(UBTTask_PalNeeds::StaticClass(), TEXT("CriticalNeeds"));
            AddTask(UBTTask_PalAttack::StaticClass(), TEXT("Combat"));
            AddTask(UBTTask_PalWork::StaticClass(), TEXT("BaseWork"));
            AddTask(UBTTask_PalWander::StaticClass(), TEXT("Wander"));
            BT->RootNode = Selector;
            if (Selector->Children.Num() != 4 || !Save(BT, BTPath, Report))
            {
                Report.Failed.Add(TEXT("Behavior Tree priority setup failed"));
            }
            Report.Pending.Add(TEXT("BT graph UI synchronization requires UE editor inspection; runtime RootNode and priority order authored"));
        }
    }
    const FString EQSPath = AssetPath(Folder, TEXT("EQS_ShootingPositions"));
    if (UEditorAssetLibrary::DoesAssetExist(EQSPath))
    {
        UEnvQuery* Existing = LoadTyped<UEnvQuery>(EQSPath, Report);
        if (Existing && !Existing->GetOptions().IsEmpty()) Report.Skipped.Add(EQSPath);
        else Report.Failed.Add(TEXT("Existing EQS has no options: ") + EQSPath);
    }
    else
    {
        UPackage* Package = CreatePackage(*EQSPath);
        UEnvQuery* Query = NewObject<UEnvQuery>(Package, TEXT("EQS_ShootingPositions"), RF_Public | RF_Standalone);
        UEnvQueryOption* Option = NewObject<UEnvQueryOption>(Query, TEXT("ShootingRing"));
        UEnvQueryGenerator_Donut* Generator = NewObject<UEnvQueryGenerator_Donut>(Option);
        Generator->Center = UEnvQueryContext_PalEnemy::StaticClass();
        Generator->InnerRadius.DefaultValue = 600.f;
        Generator->OuterRadius.DefaultValue = 1500.f;
        Generator->NumberOfRings.DefaultValue = 3;
        Generator->PointsPerRing.DefaultValue = 12;
        Option->Generator = Generator;
        UEnvQueryTest_Distance* Distance = NewObject<UEnvQueryTest_Distance>(Option);
        Distance->DistanceTo = UEnvQueryContext_PalEnemy::StaticClass();
        Distance->TestPurpose = EEnvTestPurpose::Score;
        Distance->TestOrder = 0;
        Option->Tests.Add(Distance);
        UEnvQueryTest_Trace* Trace = NewObject<UEnvQueryTest_Trace>(Option);
        Trace->Context = UEnvQueryContext_PalEnemy::StaticClass();
        Trace->TraceData.TraceMode = EEnvQueryTrace::GeometryByChannel;
        Trace->TraceData.TraceChannel = ECC_Visibility;
        Trace->TestPurpose = EEnvTestPurpose::Filter;
        Trace->FilterType = EEnvTestFilterType::Match;
        Trace->BoolValue.DefaultValue = false;
        Trace->TestOrder = 1;
        Option->Tests.Add(Trace);
        Query->GetOptionsMutable().Add(Option);
        FAssetRegistryModule::AssetCreated(Query);
        Package->MarkPackageDirty();
        if (Query->GetOptions().Num() != 1 || Option->Tests.Num() != 2)
            Report.Failed.Add(TEXT("EQS option setup failed: ") + EQSPath);
        else Save(Query, EQSPath, Report);
    }
    Report.Pending.Add(TEXT("EQS_ShootingPositions query and native controller execution require UE PIE verification"));
    Finish(Report);
    return Report;
}

FPolpalEditorBuildReport UPolpalEditorLibrary::BuildPrototypeMap()
{
    using namespace PolpalEditor;
    FPolpalEditorBuildReport Report;
    const FString MapPath(TEXT("/Game/Core/Maps/L_Prototype"));
    if (UEditorAssetLibrary::DoesAssetExist(MapPath))
    {
        Report.Skipped.Add(MapPath);
        Report.Pending.Add(TEXT("Existing map preserved; its contents and navigation were not verified"));
        Finish(Report);
        return Report;
    }
    const FString RepoRoot = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("../.."));
    const TSharedPtr<FJsonObject> Manifest = ReadManifest(RepoRoot / TEXT("tools/ue5-pipeline/manifests/pipeline.json"), Report);
    if (!Manifest.IsValid()) { Finish(Report); return Report; }
    UStaticMesh* Cube = Cast<UStaticMesh>(StaticLoadObject(UStaticMesh::StaticClass(), nullptr,
        TEXT("/Engine/BasicShapes/Cube.Cube")));
    if (!Cube)
    {
        Report.Failed.Add(TEXT("Engine BasicShapes Cube asset unavailable"));
        Finish(Report); return Report;
    }
    const TCHAR* Names[] = {TEXT("Rig_Biped_Standard"), TEXT("Rig_Biped_Chibi"),
        TEXT("Rig_Quadruped"), TEXT("Rig_Avian"), TEXT("Rig_Blob")};
    const TCHAR* Ids[] = {TEXT("biped_standard"), TEXT("biped_chibi"),
        TEXT("quadruped"), TEXT("avian"), TEXT("blob")};
    UPalSpeciesData* Species[5] = {};
    UAnimSequence* Idles[5] = {};
    for (int32 Index = 0; Index < 5; ++Index)
    {
        const FString Folder = FString::Printf(TEXT("/Game/Characters/Pals/%s"), Ids[Index]);
        Species[Index] = LoadTyped<UPalSpeciesData>(AssetPath(Folder, FString::Printf(TEXT("DA_%s"), Names[Index])), Report);
        Idles[Index] = LoadTyped<UAnimSequence>(AssetPath(Folder, FString::Printf(TEXT("A_%s_Idle"), Names[Index])), Report);
        if (Species[Index] && !Species[Index]->SkeletalMesh)
            Report.Failed.Add(FString::Printf(TEXT("Species lacks mesh: %s"), Names[Index]));
    }
    if (!Report.Failed.IsEmpty()) { Finish(Report); return Report; }

    UWorld* World = UEditorLoadingAndSavingUtils::NewBlankMap(false);
    if (!World)
    {
        Report.Failed.Add(TEXT("NewBlankMap failed")); Finish(Report); return Report;
    }
    auto SpawnBox = [World, Cube](const TCHAR* Name, FVector Location, FVector Scale) -> AStaticMeshActor*
    {
        FActorSpawnParameters Params;
        Params.Name = FName(Name);
        AStaticMeshActor* Actor = World->SpawnActor<AStaticMeshActor>(Location, FRotator::ZeroRotator, Params);
        if (Actor)
        {
            Actor->GetStaticMeshComponent()->SetStaticMesh(Cube);
            Actor->SetActorScale3D(Scale);
            Actor->SetMobility(EComponentMobility::Static);
        }
        return Actor;
    };
    auto SpawnEnvironment = [World, &Report](const TCHAR* MeshName, FVector Location, FVector Scale)
    {
        const FString Path = FString(TEXT("/Game/Buildings/Environment/")) + MeshName;
        UStaticMesh* Mesh = Cast<UStaticMesh>(UEditorAssetLibrary::LoadAsset(Path));
        if (!Mesh)
        {
            Report.Pending.Add(TEXT("Environment mesh unavailable for map: ") + Path);
            return;
        }
        AStaticMeshActor* Actor = World->SpawnActor<AStaticMeshActor>(Location, FRotator::ZeroRotator);
        if (!Actor)
        {
            Report.Failed.Add(TEXT("Environment actor spawn failed: ") + Path);
            return;
        }
        Actor->SetActorLabel(MeshName);
        Actor->GetStaticMeshComponent()->SetStaticMesh(Mesh);
        Actor->SetActorScale3D(Scale);
        Actor->SetMobility(EComponentMobility::Static);
    };
    TArray<uint16> ImportedHeights;
    const TSharedPtr<FJsonObject>* LandscapeSpec = nullptr;
    if (Manifest->TryGetObjectField(TEXT("landscape"), LandscapeSpec) && LandscapeSpec && LandscapeSpec->IsValid())
    {
        FString RelativePng;
        if (!(*LandscapeSpec)->TryGetStringField(TEXT("heightmap_png"), RelativePng)
            || (*LandscapeSpec)->GetStringField(TEXT("format")) != TEXT("PNG_G16")
            || (*LandscapeSpec)->GetIntegerField(TEXT("xy_spacing_cm")) != 200)
            Report.Failed.Add(TEXT("Unsupported landscape specification"));
        else
        {
            const FString Png = RepoRoot / RelativePng;
            ILandscapeEditorModule* LandscapeEditor = FModuleManager::LoadModulePtr<ILandscapeEditorModule>(TEXT("LandscapeEditor"));
            const ILandscapeHeightmapFileFormat* Format = LandscapeEditor
                ? LandscapeEditor->GetHeightmapFormatByExtension(TEXT(".png")) : nullptr;
            if (!Format || !IFileManager::Get().FileExists(*Png))
                Report.Failed.Add(TEXT("Landscape PNG importer or heightmap unavailable: ") + Png);
            else
            {
                const FLandscapeHeightmapImportData Height = Format->Import(*Png, FLandscapeFileResolution(505, 505));
                if (Height.ResultCode == ELandscapeImportResult::Error || Height.Data.Num() != 505 * 505)
                    Report.Failed.Add(TEXT("Landscape PNG16 decode failed: ") + Png);
                else
                {
                    ALandscape* Terrain = World->SpawnActor<ALandscape>(FVector(-50400, -50400, 0), FRotator::ZeroRotator);
                    if (!Terrain) Report.Failed.Add(TEXT("Landscape actor spawn failed"));
                    else
                    {
                        Terrain->SetActorScale3D(FVector(200, 200, 100));
                        TMap<FGuid, TArray<uint16>> Heights;
                        Heights.Add(FGuid(), Height.Data);
                        const TMap<FGuid, TArray<FLandscapeImportLayerInfo>> EmptyLayers;
                        const TArray<FLandscapeLayer> NoEditLayers;
                        Terrain->Import(FGuid::NewGuid(), 0, 0, 504, 504, 1, 63, Heights, *Png,
                            EmptyLayers, ELandscapeImportAlphamapType::Additive, NoEditLayers);
                        if (!Terrain->GetLandscapeInfo() || Terrain->LandscapeComponents.IsEmpty())
                            Report.Failed.Add(TEXT("Landscape Import produced no components"));
                        else ImportedHeights = Height.Data;
                    }
                }
            }
        }
    }
    else if (!SpawnBox(TEXT("PrototypeFloor"), FVector(0, 0, -50), FVector(100, 100, 1)))
        Report.Failed.Add(TEXT("Fallback floor spawn failed"));
    auto GroundZ = [&ImportedHeights](float X, float Y) -> float
    {
        if (ImportedHeights.Num() != 505 * 505) return 0.f;
        const int32 Col = FMath::Clamp(FMath::RoundToInt((X + 50400.f) / 200.f), 0, 504);
        const int32 Row = FMath::Clamp(FMath::RoundToInt((Y + 50400.f) / 200.f), 0, 504);
        return (static_cast<int32>(ImportedHeights[Row * 505 + Col]) - 32768) * .78125f;
    };
    auto AtGround = [&GroundZ](float X, float Y, float Height) -> FVector
    {
        return FVector(X, Y, GroundZ(X, Y) + Height);
    };
    SpawnEnvironment(TEXT("SM_Workshop"), AtGround(400, -300, 0), FVector::OneVector);
    SpawnEnvironment(TEXT("SM_ServiceMarker"), AtGround(450, 500, 0), FVector::OneVector);
    SpawnEnvironment(TEXT("SM_Tree"), AtGround(-1700, 1300, 0), FVector::OneVector);
    SpawnEnvironment(TEXT("SM_Tree"), AtGround(1650, -1100, 0), FVector::OneVector);
    SpawnEnvironment(TEXT("SM_RockCluster"), AtGround(-1200, -850, 0), FVector::OneVector);
    APlayerStart* Start = World->SpawnActor<APlayerStart>(AtGround(0, -500, 120), FRotator::ZeroRotator);
    ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(FVector(0, 0, 1200), FRotator(-45, -30, 0));
    ASkyLight* Sky = World->SpawnActor<ASkyLight>(FVector(0, 0, 900), FRotator::ZeroRotator);
    ABaseCampManager* Camp = World->SpawnActor<ABaseCampManager>(AtGround(0, 0, 20), FRotator::ZeroRotator);
    if (!Start || !Sun || !Sky || !Camp)
        Report.Failed.Add(TEXT("PlayerStart, lighting or camp spawn failed"));
    if (Sun) Sun->GetLightComponent()->SetIntensity(8.f);
    if (Sky) Sky->GetLightComponent()->SetIntensity(1.f);

    struct FService { EBaseServiceType Type; const TCHAR* Name; FVector Position; };
    const FService Services[] = {
        {EBaseServiceType::Feed, TEXT("FeedBox"), FVector(450, 500, 40)},
        {EBaseServiceType::Bed, TEXT("Bed"), FVector(650, 500, 40)},
        {EBaseServiceType::HotSpring, TEXT("HotSpring"), FVector(850, 500, 40)}
    };
    for (const FService& Item : Services)
    {
        const FVector Position = AtGround(Item.Position.X, Item.Position.Y, Item.Position.Z);
        ABaseServiceStation* Service = World->SpawnActor<ABaseServiceStation>(Position, FRotator::ZeroRotator);
        if (!Service) { Report.Failed.Add(FString(TEXT("Service spawn failed: ")) + Item.Name); continue; }
        Service->SetActorLabel(Item.Name);
        Service->ServiceType = Item.Type;
        Service->Camp = Camp;
        if (Item.Type == EBaseServiceType::Feed) Service->FoodInventory = 100;
        SpawnBox(Item.Name, Position + FVector(0, 0, 35), FVector(.8, .8, .7));
    }
    for (int32 Index = 0; Index < 3; ++Index)
    {
        const FVector Position = AtGround(400 + Index * 280, -300, 40);
        AWorkStation* Station = World->SpawnActor<AWorkStation>(Position, FRotator::ZeroRotator);
        if (!Station) { Report.Failed.Add(TEXT("WorkStation spawn failed")); continue; }
        Station->Camp = Camp;
        Station->WorkType = Index == 0 ? EPalWorkType::Handiwork :
            (Index == 1 ? EPalWorkType::Kindling : EPalWorkType::Watering);
        Station->RequiredLevel = 1;
        SpawnBox(*FString::Printf(TEXT("WorkBox%d"), Index), Position + FVector(0, 0, 50), FVector(1, 1, 1));
    }
    for (int32 Index = 0; Index < 5; ++Index)
    {
        const FVector Position = AtGround(-700 + Index * 280, 550,
            FMath::Max(100.f, Species[Index]->MeshHeightCm * .5f + 20.f));
        APalCharacter* Pal = World->SpawnActor<APalCharacter>(Position, FRotator::ZeroRotator);
        if (!Pal) { Report.Failed.Add(TEXT("Pal spawn failed")); continue; }
        Pal->Camp = Camp;
        FPalRuntimeRecord Record;
        Record.InstanceId = FGuid::NewGuid();
        Record.Species = Species[Index];
        Record.Health = Species[Index]->BaseStats.MaxHealth;
        Record.Transform = Pal->GetActorTransform();
        Pal->ApplyRecord(Record);
        Pal->GetMesh()->SetSkeletalMesh(Species[Index]->SkeletalMesh);
        if (Species[Index]->AnimBlueprintClass)
            Pal->GetMesh()->SetAnimInstanceClass(Species[Index]->AnimBlueprintClass);
        else
        {
            Pal->GetMesh()->SetAnimationMode(EAnimationMode::AnimationSingleNode);
            Pal->GetMesh()->PlayAnimation(Idles[Index], true);
        }
        // APalCharacter attaches its species outline when Species is applied.
    }
    ANavMeshBoundsVolume* NavBounds = World->SpawnActor<ANavMeshBoundsVolume>(FVector(0, 0, 0), FRotator::ZeroRotator);
    if (NavBounds)
    {
        UCubeBuilder* CubeBuilder = NewObject<UCubeBuilder>(NavBounds);
        CubeBuilder->X = 100000.f;
        CubeBuilder->Y = 100000.f;
        CubeBuilder->Z = 2000.f;
        NavBounds->BrushBuilder = CubeBuilder;
        if (!CubeBuilder->Build(World, NavBounds) ||
            NavBounds->GetComponentsBoundingBox().GetVolume() <= 0.f)
            Report.Failed.Add(TEXT("NavMeshBoundsVolume has no brush geometry"));
        else if (UNavigationSystemV1* Nav = FNavigationSystem::GetCurrent<UNavigationSystemV1>(World))
            Nav->OnNavigationBoundsUpdated(NavBounds);
    }
    else { Report.Failed.Add(TEXT("NavMeshBoundsVolume spawn failed")); }

    Report.Pending.Add(TEXT("Landscape visual height/facing alignment and material require UE editor inspection"));
    Report.Pending.Add(TEXT("NavMesh generation and AI pathfinding require UE editor/PIE verification"));
    Report.Pending.Add(TEXT("GameMode spawned player appearance requires runtime actor initialization verification"));
    if (Report.Failed.IsEmpty())
    {
        UEditorAssetLibrary::MakeDirectory(TEXT("/Game/Core/Maps"));
        if (!UEditorLoadingAndSavingUtils::SaveMap(World, MapPath))
            Report.Failed.Add(TEXT("Prototype map save failed"));
        else Report.Created.Add(MapPath);
    }
    Finish(Report);
    return Report;
}
