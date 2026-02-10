/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { TestUtils } from "../Utils";
import * as moq from "typemoq";
import sinon from "sinon";
import type { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { ECInstancesNodeKey, GroupingNodeKey } from "@itwin/presentation-common";
import { assert } from "chai";
import type { IModelRpcProps } from "@itwin/core-common";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { BeEvent } from "@itwin/core-bentley";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";
import spatialRules from "../../assets/SpatialBreakdown.json";
import type { FunctionIconInfo } from "../../Views/FunctionalityProviders";
import { ClearSectionsFunctionalityProvider, SelectRelatedFunctionalityProvider, TreeNodeFunctionIconInfoMapper, ZoomFunctionalityProvider } from "../../Views/FunctionalityProviders";

describe("TreeNodeFunctionalityMapper", () => {
  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const iModelReadRPCInterfaceMock = moq.Mock.ofType<IModelReadRpcInterface>();
  let iModelReadRpcInterfaceStub: sinon.SinonStub;

  before(async () => {
    await TestUtils.initializeUiFramework(connection.object);
    await IModelApp.localization.registerNamespace("BreakdownTrees");

    const imodelRpcPropsMock = moq.Mock.ofType<IModelRpcProps>();
    connection.setup((x) => x.getRpcProps()).returns(() => imodelRpcPropsMock.object);
    const groupNodeKey = FunctionalityProviderTestUtils.createGroupNodeKey([], 0);
    const windowNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.Window, "0x2")]);
    const doorNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.Door, "0x1")]);
    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    const obdWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.OBDWall, "0x4")]);
    const unrelatedNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.UnrelatedClass, "0x5")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.GroupNode }))).returns((_item: TreeNodeItem): GroupingNodeKey => groupNodeKey); // eslint-disable-line deprecation/deprecation
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.DoorNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => doorNodeKey); // eslint-disable-line deprecation/deprecation
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.WindowNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => windowNodeKey); // eslint-disable-line deprecation/deprecation
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey); // eslint-disable-line deprecation/deprecation
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.OBDWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => obdWallNodeKey); // eslint-disable-line deprecation/deprecation
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.UnrelatedNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => unrelatedNodeKey); // eslint-disable-line deprecation/deprecation
    dataProviderMock.setup((x) => x.imodel).returns(() => connection.object);

    iModelReadRPCInterfaceMock.setup(async (x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.IfcWall)).returns(async () => Promise.resolve([MockClassNames.IfcWall, MockClassNames.BaseWall, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup(async (x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.OBDWall)).returns(async () => Promise.resolve([MockClassNames.OBDWall, MockClassNames.BaseWall, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup(async (x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.Door)).returns(async () => Promise.resolve([MockClassNames.Door, MockClassNames.BaseDoor, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup(async (x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.Window)).returns(async () => Promise.resolve([MockClassNames.Window, MockClassNames.BaseWindow, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup(async (x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.UnrelatedClass)).returns(async () => Promise.resolve([MockClassNames.UnrelatedClass]));

    iModelReadRpcInterfaceStub = sinon.stub(IModelReadRpcInterface, "getClient");
    iModelReadRpcInterfaceStub.returns(iModelReadRPCInterfaceMock.object);
  });

  after(async () => {
    iModelReadRpcInterfaceStub.restore();
    TestUtils.terminateUiFramework();
  });

  it("should insert and query group functionality providers", async () => {
    const functionalityMapper = new TreeNodeFunctionIconInfoMapper(dataProviderMock.object);
    const zoomProviderReference: FunctionIconInfo = { key: "Zoom", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object, new BeEvent()) };
    const zoomProviderReference2: FunctionIconInfo = { key: "Zoom2", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object, new BeEvent()) };
    functionalityMapper.registerForGroupNodes(zoomProviderReference);
    functionalityMapper.registerForGroupNodes(zoomProviderReference2);

    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.GroupNode);

    const returnedProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyTreeModelItem);
    const enabledProvidersList = filterEnabledNodes(returnedProvidersList);
    const indexProvider1 = findItemIndexInArray(zoomProviderReference, enabledProvidersList);
    const indexProvider2 = findItemIndexInArray(zoomProviderReference2, enabledProvidersList);

    assert.isTrue(indexProvider1 >= 0);
    assert.isTrue(indexProvider2 >= 0);
    assert.notStrictEqual(indexProvider2, indexProvider1);
  });

  it("should insert and query class-specific functionality providers", async () => {
    const functionalityMapper = new TreeNodeFunctionIconInfoMapper(dataProviderMock.object);
    const zoomProviderReference: FunctionIconInfo = { key: "Zoom", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object, new BeEvent()) };
    const zoomProviderReference2: FunctionIconInfo = { key: "Zoom2", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object, new BeEvent()) };
    const selectAllRelatedReference: FunctionIconInfo = { key: "SelectAll", label: "Select All Related", toolbarIcon: "icon-select-all", functionalityProvider: new SelectRelatedFunctionalityProvider("tests", dataProviderMock.object, spatialRules.id, new BeEvent()) };
    const clearSectionsReference: FunctionIconInfo = { key: "ClearSections", label: "Clear Section Planes", toolbarIcon: "icon-section-clear", functionalityProvider: new ClearSectionsFunctionalityProvider("tests", dataProviderMock.object) };
    functionalityMapper.registerForNodesOfClasses([MockClassNames.Door], zoomProviderReference);
    functionalityMapper.registerForNodesOfClasses([MockClassNames.BaseDoor], selectAllRelatedReference);
    functionalityMapper.registerForNodesOfClasses([MockClassNames.PhysicalElement], clearSectionsReference);
    functionalityMapper.registerForNodesOfClasses([MockClassNames.BaseWall], zoomProviderReference2);

    const dummyDoorNode: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.DoorNode);
    const dummyWindowNode: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.WindowNode);
    const dummyIfcWallNode: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const dummyOBDWallNode: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.OBDWallNode);
    const dummyUnrelatedNode: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.UnrelatedNode);
    const dummyGroupNode: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.GroupNode);

    const returnedGroupProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyGroupNode);
    const enabledGroupProvidersList = filterEnabledNodes(returnedGroupProvidersList);
    assert.isEmpty(enabledGroupProvidersList, "no functionality providers should be enabled for grouping node");

    const returnedDoorProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyDoorNode);
    const enabledDoorProvidersList = filterEnabledNodes(returnedDoorProvidersList);
    const indexDoorProvider1 = findItemIndexInArray(zoomProviderReference, enabledDoorProvidersList);
    const indexDoorProvider2 = findItemIndexInArray(selectAllRelatedReference, enabledDoorProvidersList);
    const indexDoorProvider3 = findItemIndexInArray(clearSectionsReference, enabledDoorProvidersList);
    assert.strictEqual(enabledDoorProvidersList?.length, 3, "doornode should have 3 functionalityproviders enabled");
    assert.isTrue(indexDoorProvider1 >= 0, "doornode should have zoomProvider");
    assert.isTrue(indexDoorProvider2 >= 0, "doornode should have selectAllRelatedProvider");
    assert.isTrue(indexDoorProvider3 >= 0, "doornode should have clearSectionsProvider");

    const returnedWindowProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyWindowNode);
    const enabledWindowProvidersList = filterEnabledNodes(returnedWindowProvidersList);
    const indexWindowProvider1 = findItemIndexInArray(clearSectionsReference, enabledWindowProvidersList);
    assert.strictEqual(enabledWindowProvidersList?.length, 1, "windownode should have 1 functionalityproviders");
    assert.isTrue(indexWindowProvider1 >= 0, "windownode should have clearSectionsProvider");

    const returnedIfcWallProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyIfcWallNode);
    const enabledIfcWallProvidersList = filterEnabledNodes(returnedIfcWallProvidersList);
    const indexIfcWallProvider1 = findItemIndexInArray(zoomProviderReference2, enabledIfcWallProvidersList);
    const indexIfcWallProvider2 = findItemIndexInArray(clearSectionsReference, enabledIfcWallProvidersList);
    assert.strictEqual(enabledIfcWallProvidersList?.length, 2, "ifcwallnode should have 2 functionalityproviders");
    assert.isTrue(indexIfcWallProvider1 >= 0, "ifcwallnode should have zoomProvider2");
    assert.isTrue(indexIfcWallProvider2 >= 0, "ifcwallnode should have clearSectionsReference");

    const returnedOBDWallProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyOBDWallNode);
    const enabledOBDWallProvidersList = filterEnabledNodes(returnedOBDWallProvidersList);
    const indexOBDWallProvider1 = findItemIndexInArray(zoomProviderReference2, enabledOBDWallProvidersList);
    const indexOBDWallProvider2 = findItemIndexInArray(clearSectionsReference, enabledOBDWallProvidersList);
    assert.strictEqual(enabledOBDWallProvidersList?.length, 2, "obdwallnode should have 2 functionalityproviders");
    assert.isTrue(indexOBDWallProvider1 >= 0, "obdwallnode should have zoomProvider2");
    assert.isTrue(indexOBDWallProvider2 >= 0, "obdwallnode should have clearSectionsReference");

    const returnedUnrelatedNodeProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyUnrelatedNode);
    const enabledUnrelatedProvidersList = filterEnabledNodes(returnedUnrelatedNodeProvidersList);
    assert.isEmpty(enabledUnrelatedProvidersList, "no functionality providers should be defined for grouping node");
  });
});

function filterEnabledNodes(array: ReadonlyArray<FunctionIconInfo>) {
  return array.filter((value: FunctionIconInfo, _index, _array) => { return value.disabled === false; });
}
function findItemIndexInArray(item: FunctionIconInfo, array: ReadonlyArray<FunctionIconInfo>) {
  return array.findIndex((value: FunctionIconInfo, _index, _array) => { return value.key === item.key; });
}
