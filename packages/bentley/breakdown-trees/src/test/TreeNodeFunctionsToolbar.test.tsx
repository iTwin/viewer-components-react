/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as Moq from "typemoq";
import { TreeModel, TreeModelNode } from "@bentley/ui-components";
import { mount } from "enzyme";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { expect } from "chai";
import { TreeNodeFunctionalityProvider, TreeNodeFunctionIconInfoMapper } from "../Views/FunctionalityProviders";
import { TreeNodeFunctionsToolbar } from "../Views/TreeNodeFunctionsToolbar";

describe("TreeNodeFunctionsToolbar", () => {
  const nodeMock = Moq.Mock.ofType<TreeModelNode>();
  const treeModelMock = Moq.Mock.ofType<TreeModel>();
  const mapperMock = Moq.Mock.ofType<TreeNodeFunctionIconInfoMapper>();
  const functionalityProviderTestMock = Moq.Mock.ofType<TreeNodeFunctionalityProvider>();

  before(() => {
    functionalityProviderTestMock.setup(x => x.performAction(Moq.It.isAny(), Moq.It.isAny())).verifiable(Moq.Times.once());

    mapperMock.setup(x => x.getFunctionIconInfosFor(Moq.It.isAny())).returns(() => Promise.resolve([{
      key: "test1",
      label: "test1",
      toolbarIcon: "testIcon",
      disabled: false,
      functionalityProvider: functionalityProviderTestMock.object
    }]))
  })

  after(() => {
    nodeMock.reset();
    treeModelMock.reset();
    mapperMock.reset();
    functionalityProviderTestMock.reset();
    cleanup();
  })

  it("should render", () => {
    mount(
      <TreeNodeFunctionsToolbar
        treeModel={treeModelMock.object}
        treeNodeIconMapper={mapperMock.object}
        selectedNodes={[nodeMock.object]}
      />
    ).should.matchSnapshot();
  })

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
  })
})
