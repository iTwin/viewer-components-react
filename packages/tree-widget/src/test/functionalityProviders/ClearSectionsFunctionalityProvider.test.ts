/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { TreeModelNode } from "@bentley/ui-components";
import { TestUtils } from "../Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import { ClearSectionsFunctionalityProvider } from "../../components/trees/FunctionalityProviders";
import sinon from "sinon";
import { IModelApp, IModelConnection, NoRenderApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { assert } from "chai";
import { SectioningUtil } from "../../components/trees/visibility/SectioningUtil";
import { FunctionalityProviderTestUtils, MockStrings } from "./FunctionalityProviderTestUtils";

describe("ClearSectionsFunctionalityProvider", () => {
  let isolateRoomsForStoriesStub: sinon.SinonStub;
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();

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

    isolateRoomsForStoriesStub = sinon.stub(SectioningUtil, "isolateRoomsForStories" as any);
    IModelApp.viewManager.setSelectedView(selectedViewMock.object);
  });
  afterEach(() => {
    isolateRoomsForStoriesStub.resetHistory();
  });
  after(() => {
    isolateRoomsForStoriesStub.restore();
    selectedViewMock.reset();
    TestUtils.terminateUiFramework();
    IModelApp.shutdown();
  });

  it("should clear a Clipped section and remove section handles", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ClearSectionsFunctionalityProvider("tests", dataProviderMock.object);
    const runToolRegistryStub = sinon.stub(IModelApp.tools, "run");
    await functionalityProvider.performAction(dummyTreeModelItem);

    assert.strictEqual(isolateRoomsForStoriesStub.calledOnce, true);
    assert.strictEqual(runToolRegistryStub.calledOnce, true);
  });

});
