/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as td from "testdouble";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as selectableTreeModule from "../components/SelectableTree.js";
import * as treeWidgetModule from "../TreeWidget.js";
import { render, TestUtils, waitFor } from "./TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

describe("createTreeWidget", () => {
  beforeEach(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({ onSelectedViewportChanged: new BeEvent() }));
    sinon.stub(IModelApp, "toolAdmin").get(() => ({ activeToolChanged: new BeEvent() }));
    await td.replaceEsm("../TreeWidget.js", { ...treeWidgetModule });
    await TestUtils.initialize();
  });

  afterEach(() => {
    TestUtils.terminate();
    sinon.restore();
    td.reset();
  });

  it("renders supplied trees", async () => {
    const stubSelectableTree = sinon.stub().returns(null);
    await td.replaceEsm("../components/SelectableTree.js", {
      ...selectableTreeModule,
      SelectableTree: stubSelectableTree,
    });
    const trees: selectableTreeModule.SelectableTreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <div>Tree Content</div>,
      },
    ];
    const createTreeWidget = (await import("../components/TreeWidgetUiItemsProvider.js")).createTreeWidget;
    const widget = createTreeWidget({ trees });
    render(<>{widget.content}</>);

    expect(stubSelectableTree).to.be.called;
    const [props] = stubSelectableTree.args[0];
    expect(props.trees).to.be.eq(trees);
  });

  it("renders error message if tree component throws", async () => {
    UiFramework.setIModelConnection({
      isBlankConnection: () => true,
      selectionSet: {
        onChanged: new BeEvent(),
        elements: { size: 0 },
      },
    } as IModelConnection);

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
    const createTreeWidget = (await import("../components/TreeWidgetUiItemsProvider.js")).createTreeWidget;
    const widget = createTreeWidget({ trees });
    const { queryByText } = render(<>{widget.content}</>);

    await waitFor(() => expect(queryByText(treeWidgetModule.TreeWidget.translate("errorState.title"))).to.not.be.null);
  });
});
