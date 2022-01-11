/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TreeModelNode, TreeNodeItem } from "@bentley/ui-components";
import { TestUtils } from "../Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import sinon from "sinon";
import { ZoomFunctionalityProvider } from "../../Views/FunctionalityProviders";
import { IModelApp, IModelConnection, NoRenderApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { ECInstancesNodeKey } from "@bentley/presentation-common";
import { Code, ElementProps } from "@bentley/imodeljs-common";
import { FunctionalityProviderTestUtils, MockClassNames, MockStrings } from "./FunctionalityProviderTestUtils";
import { BeEvent } from "@bentley/bentleyjs-core";
import { DataLink } from "../../Views/visibility/DataLink";

describe("ZoomFunctionalityProvider", () => {
  let selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  let iModelElementsMock: moq.IMock<IModelConnection.Elements>;


  const connection = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  before(async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
    await NoRenderApp.startup();

    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.i18n.registerNamespace("BreakdownTrees");

    const ifcWallNodeKey = FunctionalityProviderTestUtils.createClassNodeKey([], [FunctionalityProviderTestUtils.createECInstanceKey(MockClassNames.IfcWall, "0x3")]);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isObjectWith<TreeNodeItem>({ id: MockStrings.IfcWallNode }))).returns((_item: TreeNodeItem): ECInstancesNodeKey => ifcWallNodeKey);

    const elementProps: ElementProps = { model: connection.object.iModelId!, code: Code.createEmpty(), classFullName: "BuildingSpatial.Space" };
    selectedViewMock.setup((x) => x.zoomToElementProps(moq.It.isAny()));
    iModelElementsMock = moq.Mock.ofType<IModelConnection.Elements>();
    iModelElementsMock.setup((x) => x.getProps(moq.It.isAny())).returns(() => Promise.resolve([elementProps]));
    connection.setup((x) => x.elements).returns(() => iModelElementsMock.object);
    selectedViewMock.setup((x) => x.iModel).returns(() => connection.object);

    IModelApp.viewManager.setSelectedView(selectedViewMock.object);

  });

  after(async () => {
    selectedViewMock.reset();
    iModelElementsMock.reset();
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  it("should perform action for ZoomFunctionalityProvider", async () => {
    const dummyTreeModelItem: TreeModelNode = FunctionalityProviderTestUtils.createTreeModelNode(MockStrings.IfcWallNode);
    const functionalityProvider = new ZoomFunctionalityProvider("tests", dataProviderMock.object, new BeEvent());
    const querySpatialIndexStub = sinon.stub(DataLink, "querySpatialIndex").returns(Promise.resolve(moq.It.isAny()));

    await functionalityProvider.performAction([dummyTreeModelItem]);
    selectedViewMock.verify((x) => x.zoomToElementProps(moq.It.isAny()), moq.Times.once());
    querySpatialIndexStub.restore();
  });
});
