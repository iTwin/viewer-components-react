/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { SelectableTree } from "../components/SelectableTree";
import { TreeWidget } from "../TreeWidget";
import { createResolvablePromise, render, stubCancelAnimationFrame, TestUtils, waitFor } from "./TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectableTreeDefinition } from "../components/SelectableTree";

describe("<SelectableTree />", () => {
  stubCancelAnimationFrame();

  before(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({
      onSelectedViewportChanged: new BeEvent(),
    }));
    sinon.stub(IModelApp, "toolAdmin").get(() => ({
      activeToolChanged: new BeEvent(),
    }));
    await TestUtils.initialize();
  });

  after(() => {
    TestUtils.terminate();
    sinon.restore();
  });

  beforeEach(() => {
    UiFramework.setIModelConnection({
      isBlankConnection: () => true,
      selectionSet: {
        onChanged: new BeEvent(),
        elements: { size: 0 },
      },
    } as IModelConnection);
  });

  it("renders nothing if there is no active imodel connection", () => {
    UiFramework.setIModelConnection(undefined);
    const trees: SelectableTreeDefinition[] = [
      {
        id: "tree-1",
        getLabel: () => "Tree Label 1",
        render: () => <div>Tree Content 1</div>,
      },
    ];
    const { container } = render(<SelectableTree trees={trees} />);
    expect(container.children).to.be.empty;
  });

  it("renders without trees", async () => {
    const trees: SelectableTreeDefinition[] = [];
    const { queryByText } = render(<SelectableTree trees={trees} />);
    await waitFor(() => expect(queryByText(TreeWidget.translate("selectableTree.noTrees"))).to.not.be.null);
  });

  it("renders supplied trees", async () => {
    const trees: SelectableTreeDefinition[] = [
      {
        id: "tree-1",
        getLabel: () => "Tree Label 1",
        render: () => <div>Tree Content 1</div>,
      },
      {
        id: "tree-2",
        getLabel: () => "Tree Label 2",
        render: () => <div>Tree Content 2</div>,
      },
    ];
    const { queryByText } = render(<SelectableTree trees={trees} density="enlarged" />);
    await waitFor(() => expect(queryByText("Tree Content 1")).to.not.be.null);
  });

  it("does not render tree that should not be shown", async () => {
    const trees: SelectableTreeDefinition[] = [
      {
        id: "tree-1",
        getLabel: () => "Tree Label 1",
        render: () => <div>Tree Content 1</div>,
        shouldShow: async () => false,
      },
      {
        id: "tree-2",
        getLabel: () => "Tree Label 2",
        render: () => <div>Tree Content 2</div>,
      },
    ];
    const { queryByText } = render(<SelectableTree trees={trees} />);
    await waitFor(() => {
      expect(queryByText("Tree Content 1")).to.be.null;
      expect(queryByText("Tree Content 2")).to.not.be.null;
    });
  });

  it("renders loader while determining visible trees", async () => {
    const { promise, resolve } = createResolvablePromise<boolean>();
    const trees = [
      {
        id: "tree-1",
        getLabel: () => "Tree Label 1",
        render: () => <div>Tree Content 1</div>,
        shouldShow: async () => promise,
      },
    ];

    const { container, queryByText } = render(<SelectableTree trees={trees} />);
    await waitFor(() => {
      const content = container.querySelector(".presentation-components-tree-selector-content-wrapper"); // eslint-disable-line deprecation/deprecation
      expect(content?.children).to.not.be.empty;
    });

    expect(queryByText("Tree Content 1")).to.be.null;
    resolve(true);

    await waitFor(() => expect(queryByText("Tree Content 1")).to.not.be.null);
  });
});
