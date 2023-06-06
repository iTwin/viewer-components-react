/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { render, waitFor } from "@testing-library/react";
import { TreeWidgetComponent } from "../tree-widget-react";
import { TreeWidget } from "../TreeWidget";
import { createResolvablePromise, stubCancelAnimationFrame, TestUtils } from "./TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeDefinition } from "../tree-widget-react";

describe("<TreeWidgetComponent />", () => {
  stubCancelAnimationFrame();

  before(async () => {
    await TestUtils.initialize();
  });

  after(() => {
    TestUtils.terminate();
  });

  beforeEach(() => {
    UiFramework.setIModelConnection({
      isBlankConnection: () => true,
      selectionSet: {
        onChanged: new BeEvent(),
      },
    } as IModelConnection);
  });

  it("renders nothing if there is no active imodel connection", () => {
    UiFramework.setIModelConnection(undefined);
    const trees: TreeDefinition[] = [{
      id: "tree-1",
      getLabel: () => "Tree Label 1",
      render: () => <div>Tree Content 1</div>,
    }];
    const { container } = render(<TreeWidgetComponent trees={trees} />);
    expect(container.children).to.be.empty;
  });

  it("renders without trees", async () => {
    const trees: TreeDefinition[] = [];
    const { queryByText } = render(<TreeWidgetComponent trees={trees} />);
    await waitFor(() => expect(queryByText(TreeWidget.translate("noTrees"))).to.not.be.null);
  });

  it("renders supplied trees", async () => {
    const trees: TreeDefinition[] = [{
      id: "tree-1",
      getLabel: () => "Tree Label 1",
      render: () => <div>Tree Content 1</div>,
    },
    {
      id: "tree-2",
      getLabel: () => "Tree Label 2",
      render: () => <div>Tree Content 2</div>,
    }];
    const { queryByText } = render(<TreeWidgetComponent trees={trees} />);
    await waitFor(() => expect(queryByText("Tree Content 1")).to.not.be.null);
  });

  it("does not render tree that should not be shown", async () => {
    const trees: TreeDefinition[] = [{
      id: "tree-1",
      getLabel: () => "Tree Label 1",
      render: () => <div>Tree Content 1</div>,
      shouldShow: async () => false,
    },
    {
      id: "tree-2",
      getLabel: () => "Tree Label 2",
      render: () => <div>Tree Content 2</div>,
    }];
    const { queryByText } = render(<TreeWidgetComponent trees={trees} />);
    await waitFor(() => {
      expect(queryByText("Tree Content 1")).to.be.null;
      expect(queryByText("Tree Content 2")).to.not.be.null;
    });
  });

  it("renders loader while determining visible trees", async () => {
    const { promise, resolve } = createResolvablePromise<boolean>();
    const trees = [{
      id: "tree-1",
      getLabel: () => "Tree Label 1",
      render: () => <div>Tree Content 1</div>,
      shouldShow: async () => promise,
    }];

    const { container, queryByText } = render(<TreeWidgetComponent trees={trees} />);
    await waitFor(() => {
      const content = container.querySelector(".components-selectable-content-wrapper");
      expect(content?.children).to.not.be.empty;
    });

    expect(queryByText("Tree Content 1")).to.be.null;
    resolve(true);

    await waitFor(() => expect(queryByText("Tree Content 1")).to.not.be.null);
  });
});
