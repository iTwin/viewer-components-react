/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as Moq from "typemoq";
import type { TreeModel, TreeModelNode } from "@itwin/components-react";
import { mount } from "enzyme";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { expect } from "chai";
import type { TreeNodeFunctionalityProvider, TreeNodeFunctionIconInfoMapper } from "../Views/FunctionalityProviders";
import { TreeNodeFunctionsToolbar } from "../Views/TreeNodeFunctionsToolbar";

describe("TreeNodeFunctionsToolbar", () => {
  const nodeMock = Moq.Mock.ofType<TreeModelNode>();
  const treeModelMock = Moq.Mock.ofType<TreeModel>();
  const mapperMock = Moq.Mock.ofType<TreeNodeFunctionIconInfoMapper>();
  const functionalityProviderTestMock = Moq.Mock.ofType<TreeNodeFunctionalityProvider>();

  before(() => {
    functionalityProviderTestMock.setup(async (x) => x.performAction(Moq.It.isAny(), Moq.It.isAny())).verifiable(Moq.Times.once());

    mapperMock.setup(async (x) => x.getFunctionIconInfosFor(Moq.It.isAny())).returns(async () => Promise.resolve([{
      key: "test1",
      label: "test1",
      toolbarIcon: "testIcon",
      disabled: false,
      functionalityProvider: functionalityProviderTestMock.object,
    }]));
  });

  after(() => {
    nodeMock.reset();
    treeModelMock.reset();
    mapperMock.reset();
    functionalityProviderTestMock.reset();
    cleanup();
  });

  it("should render", () => {
    mount(
      <TreeNodeFunctionsToolbar
        treeModel={treeModelMock.object}
        treeNodeIconMapper={mapperMock.object}
        selectedNodes={[nodeMock.object]}
      />
    ).should.matchSnapshot();
  });

  it("should call performAction", async () => {
    const wrapper = render(
      <TreeNodeFunctionsToolbar
        treeModel={treeModelMock.object}
        treeNodeIconMapper={mapperMock.object}
        selectedNodes={[nodeMock.object]}
      />
    );

    await waitFor(() => expect(wrapper.queryByTitle("test1")).to.exist);

    fireEvent.click(wrapper.queryByTitle("test1")!);

    functionalityProviderTestMock.verifyAll();
  });
});
