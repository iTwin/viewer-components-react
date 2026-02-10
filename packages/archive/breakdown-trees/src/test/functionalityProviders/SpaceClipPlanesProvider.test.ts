/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import { TestUtils } from "../Utils";
import * as moq from "typemoq";
import { SpaceClipPlanesProvider } from "../../Views/FunctionalityProviders";
import sinon from "sinon";
import type { IModelConnection, ScreenViewport, ViewState } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import { assert } from "chai";
import type { ElementProps } from "@itwin/core-common";
import { Code } from "@itwin/core-common";
import { ClipVector, Range3d } from "@itwin/core-geometry";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";
import { SectioningUtil } from "../../Views/visibility/SectioningUtil";
import { BreakdownTrees } from "../../BreakdownTrees";

describe("SpaceClipPlanesProvider", () => {
  let isolateRoomsForStoriesStub: sinon.SinonStub;
  let checkIsSpaceStub: sinon.SinonStub;
  let createCaptureSpy: sinon.SinonSpy;
  let selectedViewMock: moq.IMock<ScreenViewport>;
  let iModelElementsMock: moq.IMock<IModelConnection.Elements>;

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    await BreakdownTrees.initialize();
    await TestUtils.initializeUiFramework(connection.object);
    await IModelApp.localization.registerNamespace("BreakdownTrees");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey); // eslint-disable-line deprecation/deprecation

    isolateRoomsForStoriesStub = sinon.stub(SectioningUtil, "isolateRoomsForStories");

    const elementProps: ElementProps = { model: connection.object.iModelId!, code: Code.createEmpty(), classFullName: "BuildingSpatial.Space" };
    const viewStateMock = moq.Mock.ofType<ViewState>();
    viewStateMock.setup((x) => x.setViewClip(moq.It.isAny()));

    selectedViewMock = moq.Mock.ofType<ScreenViewport>();
    iModelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
    iModelElementsMock.setup(async (x) => x.getProps(moq.It.isAny())).returns(async () => Promise.resolve([elementProps]));
    connection.setup((x) => x.elements).returns(() => iModelElementsMock.object);
    selectedViewMock.setup((x) => x.view).returns(() => viewStateMock.object);

    await IModelApp.viewManager.setSelectedView(selectedViewMock.object);

    checkIsSpaceStub = sinon.stub(SpaceClipPlanesProvider.prototype, "checkIsSpace" as any).returns(async () => Promise.resolve(new Range3d(0, 0, 0, 1, 1, 1)));
    createCaptureSpy = sinon.spy(ClipVector, "createCapture");

    dataProviderMock.setup((x) => x.imodel).returns(() => connection.object);

  });

  after(async () => {
    isolateRoomsForStoriesStub.restore();
    checkIsSpaceStub.restore();
    createCaptureSpy.restore();
    TestUtils.terminateUiFramework();
    BreakdownTrees.terminate();
  });
  it("should perform action for SpaceClipPlanesProvider", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new SpaceClipPlanesProvider("tests", dataProviderMock.object, false, 2.0);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(checkIsSpaceStub.calledOnce, true);
    assert.strictEqual(createCaptureSpy.calledOnce, true);
  });
});
