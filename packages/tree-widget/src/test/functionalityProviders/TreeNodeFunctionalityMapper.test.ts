/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { IModelApp, NoRenderApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { TestUtils } from "../Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import { FunctionIconInfo, TreeNodeFunctionIconInfoMapper, ZoomFunctionalityProvider, SelectRelatedFunctionalityProvider, ClearSectionsFunctionalityProvider } from "../../components/trees/FunctionalityProviders";
import sinon from "sinon";
import { TreeNodeItem, TreeModelNode } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { ECInstancesNodeKey, GroupingNodeKey } from "@bentley/presentation-common";
import { assert } from "chai";
import { IModelReadRpcInterface, IModelRpcProps } from "@bentley/imodeljs-common";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";
import spatialRules from "../assets/SpatialBreakdown.json";


describe("TreeNodeFunctionalityMapper", () => {
  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const iModelReadRPCInterfaceMock = moq.Mock.ofType<IModelReadRpcInterface>();
  let iModelReadRpcInterfaceStub: sinon.SinonStub;

  before(async () => {
    // This is required by our I18n module (specifically the i18next package).
    // (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires
    if (IModelApp.initialized)
      IModelApp.shutdown();
    NoRenderApp.startup();
    Presentation.terminate();
    Presentation.initialize();
    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.i18n.registerNamespace("TreeWidget");

    const imodelRpcPropsMock = moq.Mock.ofType<IModelRpcProps>();
    connection.setup((x) => x.getRpcProps()).returns(() => imodelRpcPropsMock.object);
    const groupNodeKey = FunctionalityProviderTestUtils.createGroupNodeKey([], 0);
    const windowNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.Window, "0x2")]);
    const doorNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.Door, "0x1")]);
    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    const obdWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.OBDWall, "0x4")]);
    const unrelatedNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.UnrelatedClass, "0x5")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.GroupNode }))).returns((_item: TreeNodeItem): GroupingNodeKey => groupNodeKey);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.DoorNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => doorNodeKey);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.WindowNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => windowNodeKey);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.OBDWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => obdWallNodeKey);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.UnrelatedNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => unrelatedNodeKey);
    dataProviderMock.setup((x) => x.imodel).returns(() => connection.object);

    iModelReadRPCInterfaceMock.setup((x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.IfcWall)).returns(() => Promise.resolve([MockClassNames.IfcWall, MockClassNames.BaseWall, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup((x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.OBDWall)).returns(() => Promise.resolve([MockClassNames.OBDWall, MockClassNames.BaseWall, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup((x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.Door)).returns(() => Promise.resolve([MockClassNames.Door, MockClassNames.BaseDoor, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup((x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.Window)).returns(() => Promise.resolve([MockClassNames.Window, MockClassNames.BaseWindow, MockClassNames.PhysicalElement]));
    iModelReadRPCInterfaceMock.setup((x) => x.getClassHierarchy(moq.It.isAny(), MockClassNames.UnrelatedClass)).returns(() => Promise.resolve([MockClassNames.UnrelatedClass]));

    iModelReadRpcInterfaceStub = sinon.stub(IModelReadRpcInterface, "getClient" as any);
    iModelReadRpcInterfaceStub.returns(iModelReadRPCInterfaceMock.object);
  });

  after(() => {
    iModelReadRpcInterfaceStub.restore();
    TestUtils.terminateUiFramework();
    IModelApp.shutdown();
  });


  it("should insert and query group functionality providers", async () => {
    const functionalityMapper = new TreeNodeFunctionIconInfoMapper(dataProviderMock.object);
    const zoomProviderReference: FunctionIconInfo = { key: "Zoom", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object) };
    const zoomProviderReference2: FunctionIconInfo = { key: "Zoom2", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object) };
    functionalityMapper.registerForGroupNodes(zoomProviderReference);
    functionalityMapper.registerForGroupNodes(zoomProviderReference2);

    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.GroupNode);

    let returnedProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyTreeModelItem);
    const enabledProvidersList = filterEnabledNodes(returnedProvidersList);
    const indexProvider1 = findItemIndexInArray(zoomProviderReference, enabledProvidersList);
    const indexProvider2 = findItemIndexInArray(zoomProviderReference2, enabledProvidersList);

    assert.isTrue(indexProvider1 >= 0);
    assert.isTrue(indexProvider2 >= 0);
    assert.notStrictEqual(indexProvider2, indexProvider1);
  });



  it("should insert and query class-specific functionality providers", async () => {
    const functionalityMapper = new TreeNodeFunctionIconInfoMapper(dataProviderMock.object);
    const zoomProviderReference: FunctionIconInfo = { key: "Zoom", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object) };
    const zoomProviderReference2: FunctionIconInfo = { key: "Zoom2", label: "Zoom to Element", toolbarIcon: "icon-zoom", functionalityProvider: new ZoomFunctionalityProvider("tests", dataProviderMock.object) };
    const selectAllRelatedReference: FunctionIconInfo = { key: "SelectAll", label: "Select All Related", toolbarIcon: "icon-select-all", functionalityProvider: new SelectRelatedFunctionalityProvider("tests", dataProviderMock.object, spatialRules.id) };
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

    let returnedGroupProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyGroupNode);
    let enabledGroupProvidersList = filterEnabledNodes(returnedGroupProvidersList);
    assert.isEmpty(enabledGroupProvidersList, "no functionality providers should be enabled for grouping node");

    let returnedDoorProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyDoorNode);
    let enabledDoorProvidersList = filterEnabledNodes(returnedDoorProvidersList);
    const indexDoorProvider1 = findItemIndexInArray(zoomProviderReference, enabledDoorProvidersList);
    const indexDoorProvider2 = findItemIndexInArray(selectAllRelatedReference, enabledDoorProvidersList);
    const indexDoorProvider3 = findItemIndexInArray(clearSectionsReference, enabledDoorProvidersList);
    assert.strictEqual(enabledDoorProvidersList ?.length, 3, "doornode should have 3 functionalityproviders enabled");
    assert.isTrue(indexDoorProvider1 >= 0, "doornode should have zoomProvider");
    assert.isTrue(indexDoorProvider2 >= 0, "doornode should have selectAllRelatedProvider");
    assert.isTrue(indexDoorProvider3 >= 0, "doornode should have clearSectionsProvider");

    let returnedWindowProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyWindowNode);
    let enabledWindowProvidersList = filterEnabledNodes(returnedWindowProvidersList);
    const indexWindowProvider1 = findItemIndexInArray(clearSectionsReference, enabledWindowProvidersList);
    assert.strictEqual(enabledWindowProvidersList ?.length, 1, "windownode should have 1 functionalityproviders");
    assert.isTrue(indexWindowProvider1 >= 0, "windownode should have clearSectionsProvider");


    let returnedIfcWallProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyIfcWallNode);
    let enabledIfcWallProvidersList = filterEnabledNodes(returnedIfcWallProvidersList);
    const indexIfcWallProvider1 = findItemIndexInArray(zoomProviderReference2, enabledIfcWallProvidersList);
    const indexIfcWallProvider2 = findItemIndexInArray(clearSectionsReference, enabledIfcWallProvidersList);
    assert.strictEqual(enabledIfcWallProvidersList ?.length, 2, "ifcwallnode should have 2 functionalityproviders");
    assert.isTrue(indexIfcWallProvider1 >= 0, "ifcwallnode should have zoomProvider2");
    assert.isTrue(indexIfcWallProvider2 >= 0, "ifcwallnode should have clearSectionsReference");

    let returnedOBDWallProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyOBDWallNode);
    let enabledOBDWallProvidersList = filterEnabledNodes(returnedOBDWallProvidersList);
    const indexOBDWallProvider1 = findItemIndexInArray(zoomProviderReference2, enabledOBDWallProvidersList);
    const indexOBDWallProvider2 = findItemIndexInArray(clearSectionsReference, enabledOBDWallProvidersList);
    assert.strictEqual(enabledOBDWallProvidersList ?.length, 2, "obdwallnode should have 2 functionalityproviders");
    assert.isTrue(indexOBDWallProvider1 >= 0, "obdwallnode should have zoomProvider2");
    assert.isTrue(indexOBDWallProvider2 >= 0, "obdwallnode should have clearSectionsReference");

    let returnedUnrelatedNodeProvidersList = await functionalityMapper.getFunctionIconInfosFor(dummyUnrelatedNode);
    let enabledUnrelatedProvidersList = filterEnabledNodes(returnedUnrelatedNodeProvidersList);
    assert.isEmpty(enabledUnrelatedProvidersList, "no functionality providers should be defined for grouping node");
  });
});

function filterEnabledNodes(array: ReadonlyArray<FunctionIconInfo>) {
  return array.filter((value: FunctionIconInfo, _index, _array) => { return value.disabled === false; });
}
function findItemIndexInArray(item: FunctionIconInfo, array: ReadonlyArray<FunctionIconInfo>) {
  return array.findIndex((value: FunctionIconInfo, _index, _array) => { return value.key === item.key; });
}
