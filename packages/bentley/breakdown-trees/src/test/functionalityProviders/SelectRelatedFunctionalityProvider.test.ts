/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import { TestUtils } from "../Utils";
import { Presentation, SelectionManager } from "@itwin/presentation-frontend";
import * as moq from "typemoq";
import sinon from "sinon";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { ECInstancesNodeKey, GroupingNodeKey, RegisteredRuleset } from "@itwin/presentation-common";
import { assert } from "chai";
import { BeEvent } from "@itwin/core-bentley";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";
import spatialRules from "../../assets/SpatialBreakdown.json";
import { UiFramework } from "@itwin/appui-react";
import { SelectRelatedFunctionalityProvider } from "../../Views/FunctionalityProviders";
import { RelatedElementIdsProvider } from "../../Views/RelatedElementIdsProvider";

describe("SelectRelatedFunctionalityProvider", () => {
  let replaceSelectionSpy: sinon.SinonSpy;
  let relatedElementSpy: sinon.SinonSpy;

  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    if (IModelApp.initialized) {
      Presentation.terminate();
      await IModelApp.shutdown();
    }
    await NoRenderApp.startup();
    try {
      await Presentation.initialize();
    } catch (error) { }

    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.localization.registerNamespace("BreakdownTrees");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey);

    const selectionManager = new SelectionManager({ scopes: undefined as any });
    sinon.stub(Presentation, "selection").get(() => selectionManager);
    replaceSelectionSpy = sinon.stub(Presentation.selection, "replaceSelection").returns();
    relatedElementSpy = sinon.stub(RelatedElementIdsProvider.prototype, "getElementIds" as any);
  });

  afterEach(() => {
    replaceSelectionSpy.restore();
    relatedElementSpy.restore();
  });
  after(async () => {
    TestUtils.terminateUiFramework();
    Presentation.terminate();
    await IModelApp.shutdown();
  });

  it("should perform action for SelectRelatedFunctionalityProvider", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new SelectRelatedFunctionalityProvider("tests", dataProviderMock.object, spatialRules.id, new BeEvent());
    await functionalityProvider.performAction([dummyTreeModelItem]);
    assert.strictEqual(relatedElementSpy.callCount, 1);
    assert.strictEqual(replaceSelectionSpy.callCount, 1);
  });

  it("should perform action for SelectRelatedFunctionalityProvider for a Group node", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.GroupNode);
    const functionalityProvider = new SelectRelatedFunctionalityProvider("tests", dataProviderMock.object, spatialRules.id, new BeEvent());
    const groupNodeKey = FunctionalityProviderTestUtils.createGroupNodeKey([], 0);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.GroupNode }))).returns((_item: TreeNodeItem): GroupingNodeKey => groupNodeKey);
    dataProviderMock.setup((x) => x.getNodes(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.GroupNode }))).returns(() => Promise.resolve([]));
    await functionalityProvider.performAction([dummyTreeModelItem]);

    assert.strictEqual(replaceSelectionSpy.callCount, 1);
  });
});
