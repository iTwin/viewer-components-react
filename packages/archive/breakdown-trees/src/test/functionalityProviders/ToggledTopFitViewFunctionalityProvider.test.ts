/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import { TestUtils } from "../Utils";
import * as moq from "typemoq";
import { ToggledTopFitViewFunctionalityProvider } from "../../Views/FunctionalityProviders";
import sinon from "sinon";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import { assert } from "chai";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";

describe("ToggledTopFitViewFunctionalityProvider", () => {
  let handleTopViewSpy: sinon.SinonStub;

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    await TestUtils.initializeUiFramework(connection.object);
    await IModelApp.localization.registerNamespace("BreakdownTrees");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey); // eslint-disable-line deprecation/deprecation

    handleTopViewSpy = sinon.stub(ToggledTopFitViewFunctionalityProvider.prototype, "handleTopView" as any);

  });
  afterEach(() => {
    handleTopViewSpy.resetHistory();
  });
  after(async () => {
    handleTopViewSpy.restore();
    TestUtils.terminateUiFramework();
  });

  it("should perform action for ToggledTopFitViewProvider when setTopView is set to true", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ToggledTopFitViewFunctionalityProvider("tests", dataProviderMock.object, true);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(handleTopViewSpy.callCount, 1);
  });

  it("should not perform action for ToggledTopFitViewProvider when setTopView is set to false", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ToggledTopFitViewFunctionalityProvider("tests", dataProviderMock.object, false);
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(handleTopViewSpy.callCount, 0);
  });

});
