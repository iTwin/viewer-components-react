/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { TreeModelNode } from "@itwin/components-react";
import { TestUtils } from "../Utils";
import * as moq from "typemoq";
import { ClearSectionsFunctionalityProvider } from "../../Views/FunctionalityProviders";
import sinon from "sinon";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { assert } from "chai";
import { FunctionalityProviderTestUtils, MockStrings } from "./FunctionalityProviderTestUtils";
import { SectioningUtil } from "../../Views/visibility/SectioningUtil";

describe("ClearSectionsFunctionalityProvider", () => {
  let isolateRoomsForStoriesStub: sinon.SinonStub;
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    await TestUtils.initializeUiFramework(connection.object);
    await IModelApp.localization.registerNamespace("BreakdownTrees");

    isolateRoomsForStoriesStub = sinon.stub(SectioningUtil, "isolateRoomsForStories");
    await IModelApp.viewManager.setSelectedView(selectedViewMock.object);
  });
  after(async () => {
    isolateRoomsForStoriesStub.restore();
    selectedViewMock.reset();
    TestUtils.terminateUiFramework();
  });

  it("should clear a Clipped section and remove section handles", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ClearSectionsFunctionalityProvider("tests", dataProviderMock.object);

    const runToolRegistryStub = sinon.stub();
    sinon.stub(IModelApp, "tools").get(() => ({
      registerModule: sinon.stub(),
      create: sinon.stub(),
      run: runToolRegistryStub,
    }));
    await functionalityProvider.performAction([dummyTreeModelItem]);

    assert.strictEqual(isolateRoomsForStoriesStub.calledOnce, true);
    assert.strictEqual(runToolRegistryStub.calledOnce, true);
  });

});
