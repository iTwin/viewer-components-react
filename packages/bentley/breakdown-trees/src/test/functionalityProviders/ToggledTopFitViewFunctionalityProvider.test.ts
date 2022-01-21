/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import { TestUtils } from "../Utils";
import { Presentation } from "@itwin/presentation-frontend";
import * as moq from "typemoq";
import { ToggledTopFitViewFunctionalityProvider } from "../../Views/FunctionalityProviders";
import sinon from "sinon";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { ECInstancesNodeKey } from "@itwin/presentation-common";
import { assert } from "chai";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";


describe("ToggledTopFitViewFunctionalityProvider", () => {
  let forEachViewportSpy: sinon.SinonSpy;

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
    await NoRenderApp.startup();

    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.localization.registerNamespace("BreakdownTrees");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey);

    forEachViewportSpy = sinon.spy(IModelApp.viewManager, "forEachViewport");

  });
  afterEach(() => {
    forEachViewportSpy.resetHistory();
  });
  after(async () => {
    forEachViewportSpy.restore();
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  it("should perform action for ToggledTopFitViewProvider when setTopView is set to true", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ToggledTopFitViewFunctionalityProvider("tests", dataProviderMock.object, true);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(forEachViewportSpy.callCount, 1);
  });

  it("should not perform action for ToggledTopFitViewProvider when setTopView is set to false", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ToggledTopFitViewFunctionalityProvider("tests", dataProviderMock.object, false);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(forEachViewportSpy.callCount, 0);
  });

});
