/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import { TestUtils } from "../Utils";
import * as moq from "typemoq";
import { StoryClipPlanesProvider, ToggledTopFitViewFunctionalityProvider } from "../../Views/FunctionalityProviders";
import sinon from "sinon";
import type { IModelConnection, ScreenViewport, ViewState } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import { assert } from "chai";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";
import { Range3d } from "@itwin/core-geometry";
import { ViewFlags } from "@itwin/core-common";
import { MessageManager } from "@itwin/appui-react";
import { SectioningUtil } from "../../Views/visibility/SectioningUtil";
import { DataLink } from "../../Views/visibility/DataLink";
import { BreakdownTrees } from "../../BreakdownTrees";

describe("StoryClipPlanesProvider", () => {
  let isolateRoomsForStoriesStub: sinon.SinonStub;
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  const viewStateMock = moq.Mock.ofType<ViewState>();

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    await TestUtils.initializeUiFramework(connection.object);
    await IModelApp.localization.registerNamespace("BreakdownTrees");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey); // eslint-disable-line deprecation/deprecation

    isolateRoomsForStoriesStub = sinon.stub(SectioningUtil, "isolateRoomsForStories");

    viewStateMock.setup((x) => x.setViewClip(moq.It.isAny()));
    selectedViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
    const viewFlagsMoq = moq.Mock.ofType<ViewFlags>();
    viewFlagsMoq.setup((x) => x.with("clipVolume", true)).returns(() => moq.It.isAnyObject(ViewFlags));
    selectedViewMock.setup((x) => x.viewFlags).returns(() => viewFlagsMoq.object);
    await IModelApp.viewManager.setSelectedView(selectedViewMock.object);
  });

  after(async () => {
    selectedViewMock.reset();
    viewStateMock.reset();
    TestUtils.terminateUiFramework();
  });

  it("should perform action for StoryClipPlanesProvider", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new StoryClipPlanesProvider("tests", dataProviderMock.object, false, false);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(isolateRoomsForStoriesStub.calledOnce, true);
    isolateRoomsForStoriesStub.restore();
  });

  it("should not create clip in StoryClipPlanesProvider when no room is returned", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new StoryClipPlanesProvider("tests", dataProviderMock.object, false, false);

    const queryRoomsStub = sinon.stub(DataLink, "queryRooms").returns(Promise.resolve([]));
    const queryStoryRangeStub = sinon.stub(DataLink, "queryStoryRange").returns(Promise.resolve(new Range3d(0, 0, 0, 1, 1, 1)));

    await functionalityProvider.performAction([dummyTreeModelItem]);

    assert.strictEqual(queryRoomsStub.calledOnce, true);
    viewStateMock.verify((x) => x.setViewClip(moq.It.isAny()), moq.Times.once());
    queryRoomsStub.restore();
    queryStoryRangeStub.restore();
  });

  it("should not create clip or perform toggle in StoryClipPlanesProvider when story has no element", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new StoryClipPlanesProvider("tests", dataProviderMock.object, false, false);

    const queryRoomsStub = sinon.stub(DataLink, "queryRooms").returns(Promise.resolve([]));
    const queryStoryRangeStub = sinon.stub(DataLink, "queryStoryRange").returns(Promise.resolve(undefined));
    const performToggleStub = sinon.stub(ToggledTopFitViewFunctionalityProvider.prototype, "performAction" as any);

    await functionalityProvider.performAction([dummyTreeModelItem]);

    assert.strictEqual(queryStoryRangeStub.calledOnce, true);
    assert.strictEqual(performToggleStub.calledOnce, false);
    assert.strictEqual(MessageManager.messages[0].briefMessage, BreakdownTrees.translate("clipSection.briefTimeoutMessage"));
    queryRoomsStub.restore();
    queryStoryRangeStub.restore();
    performToggleStub.restore();
  });

});
