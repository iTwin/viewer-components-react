/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TreeModelNode, TreeNodeItem } from "@bentley/ui-components";
import { TestUtils } from "../Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import { BuildingClipPlanesProvider } from "../../Views/FunctionalityProviders";
import sinon from "sinon";
import { IModelApp, IModelConnection, NoRenderApp, ScreenViewport, ViewState } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { ECInstancesNodeKey } from "@bentley/presentation-common";
import { assert } from "chai";
import { ConvexClipPlaneSet } from "@bentley/geometry-core";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";

describe("BuildingClipPlanesProvider", () => {
  let checkIsBuildingStub: sinon.SinonStub;
  let queryBuildingRangeStub: sinon.SinonStub;
  let createRange3DPlaneStub: sinon.SinonStub;
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    if (IModelApp.initialized)
      IModelApp.shutdown();
    NoRenderApp.startup();
    try {
      Presentation.terminate();
      Presentation.initialize();
    } catch (error) {
    }

    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.i18n.registerNamespace("BreakdownTrees");
    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey);

    const viewStateMock = moq.Mock.ofType<ViewState>();
    viewStateMock.setup((x) => x.setViewClip(moq.It.isAny()));
    selectedViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
    IModelApp.viewManager.setSelectedView(selectedViewMock.object);

    checkIsBuildingStub = sinon.stub(BuildingClipPlanesProvider.prototype, "checkIsBuilding" as any).returns(() => Promise.resolve(true));
    queryBuildingRangeStub = sinon.stub(BuildingClipPlanesProvider.prototype, "queryBuildingRange" as any).returns(() => Promise.resolve(true));
    createRange3DPlaneStub = sinon.stub(ConvexClipPlaneSet, "createRange3dPlanes").returns(moq.It.isAny());
  });
  after(() => {
    checkIsBuildingStub.restore();
    queryBuildingRangeStub.restore();
    createRange3DPlaneStub.restore();
    TestUtils.terminateUiFramework();
    IModelApp.shutdown();
  });

  it("should perform action for BuildingClipPlanesProvider", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new BuildingClipPlanesProvider("tests", dataProviderMock.object, false);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(checkIsBuildingStub.calledOnce, true);
    assert.strictEqual(createRange3DPlaneStub.callCount, 1);
  });

});
