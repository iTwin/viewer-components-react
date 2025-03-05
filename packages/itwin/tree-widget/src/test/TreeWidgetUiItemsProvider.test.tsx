/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mock } from "node:test";
import React from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import * as selectableTreeModule from "../tree-widget-react/components/SelectableTree.js";
import { TreeWidget } from "../tree-widget-react/TreeWidget.js";
import { render, waitFor } from "./TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { createTreeWidget as TCreateTreeWidget } from "../tree-widget-react/components/TreeWidgetUiItemsProvider.js";

describe("createTreeWidget", () => {
  const selectableTreeStub = sinon.stub<[selectableTreeModule.SelectableTreeProps], React.ReactElement | null>();
  let createTreeWidget: typeof TCreateTreeWidget;

  before(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({ onSelectedViewportChanged: new BeEvent() }));
    sinon.stub(IModelApp, "toolAdmin").get(() => ({ activeToolChanged: new BeEvent() }));

    await UiFramework.initialize();
    UiFramework.setIModelConnection({
      isBlankConnection: () => true,
      selectionSet: {
        onChanged: new BeEvent(),
        elements: { size: 0 },
      },
    } as IModelConnection);

    await TreeWidget.initialize(new EmptyLocalization());

    mock.module("../tree-widget-react/components/SelectableTree.js", {
      namedExports: {
        ...selectableTreeModule,
        SelectableTree: selectableTreeStub,
      },
    });
    createTreeWidget = (await import("../tree-widget-react/components/TreeWidgetUiItemsProvider.js")).createTreeWidget;
  });

  after(() => {
    mock.reset();
    sinon.restore();
  });

  beforeEach(() => {
    selectableTreeStub.callsFake((props) => selectableTreeModule.SelectableTree(props));
  });

  afterEach(() => {
    selectableTreeStub.reset();
  });

  it("renders supplied trees", async () => {
    const trees: selectableTreeModule.SelectableTreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <div>Tree Content</div>,
      },
    ];
    const widget = createTreeWidget({ trees });
    render(<>{widget.content}</>);
    expect(selectableTreeStub).to.be.called;
    const [props] = selectableTreeStub.args[0];
    expect(props.trees).to.be.eq(trees);
  });

  it("renders error message if tree component throws", async () => {
    function TestTree(): React.ReactElement {
      throw new Error("Error");
    }
    const trees: selectableTreeModule.SelectableTreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <TestTree />,
      },
    ];
    const widget = createTreeWidget({ trees });
    const { queryByText } = render(<>{widget.content}</>);
    await waitFor(() => expect(queryByText(TreeWidget.translate("errorState.title"))).to.not.be.null);
  });
});
