/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { TreeModelNode, TreeNodeItem } from "@bentley/ui-components";
import { TestUtils } from "../Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import { SpaceClipPlanesProvider } from "../../components/trees/FunctionalityProviders";
import sinon from "sinon";
import { IModelApp, IModelConnection, NoRenderApp, ScreenViewport, ViewState } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { ECInstancesNodeKey } from "@bentley/presentation-common";
import { assert } from "chai";
import { Code, ElementProps } from "@bentley/imodeljs-common";
import { SectioningUtil } from "../../components/trees/visibility/SectioningUtil";
import { ClipVector, Range3d } from "@bentley/geometry-core";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";


describe("SpaceClipPlanesProvider", () => {
  let isolateRoomsForStoriesStub: sinon.SinonStub;
  let checkIsSpaceStub: sinon.SinonStub;
  let createCaptureSpy: sinon.SinonSpy;
  let selectedViewMock: moq.IMock<ScreenViewport>;
  let iModelElementsMock: moq.IMock<IModelConnection.Elements>;

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    if (IModelApp.initialized)
      IModelApp.shutdown();
    NoRenderApp.startup();
    Presentation.terminate();
    Presentation.initialize();
    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.i18n.registerNamespace("TreeWidget");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey);

    isolateRoomsForStoriesStub = sinon.stub(SectioningUtil, "isolateRoomsForStories" as any);

    const elementProps: ElementProps = { model: connection.object.iModelId!, code: Code.createEmpty(), classFullName: "BuildingSpatial.Space" };
    const viewStateMock = moq.Mock.ofType<ViewState>();
    viewStateMock.setup((x) => x.setViewClip(moq.It.isAny()));

    selectedViewMock = moq.Mock.ofType<ScreenViewport>();
    iModelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
    iModelElementsMock.setup((x) => x.getProps(moq.It.isAny())).returns(() => Promise.resolve([elementProps]));
    connection.setup((x) => x.elements).returns(() => iModelElementsMock.object);
    selectedViewMock.setup((x) => x.view).returns(() => viewStateMock.object);

    IModelApp.viewManager.setSelectedView(selectedViewMock.object);

    checkIsSpaceStub = sinon.stub(SpaceClipPlanesProvider.prototype, "checkIsSpace" as any).returns(() => Promise.resolve(new Range3d(0, 0, 0, 1, 1, 1)));
    createCaptureSpy = sinon.spy(ClipVector, "createCapture" as any);

    dataProviderMock.setup((x) => x.imodel).returns(() => connection.object);

  });

  after(() => {
    isolateRoomsForStoriesStub.restore();
    checkIsSpaceStub.restore();
    createCaptureSpy.restore();
    TestUtils.terminateUiFramework();
    IModelApp.shutdown();
  });
  it("should perform action for SpaceClipPlanesProvider", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new SpaceClipPlanesProvider("tests", dataProviderMock.object, false, 2.0);
    await functionalityProvider.performAction(dummyTreeModelItem);
    assert.strictEqual(checkIsSpaceStub.calledOnce, true);
    assert.strictEqual(createCaptureSpy.calledOnce, true);
  });
});
