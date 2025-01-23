/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as td from "testdouble";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import * as selectableTreeModule from "../components/SelectableTree.js";
import { render, waitFor } from "./TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

describe("createTreeWidget", () => {
  beforeEach(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({ onSelectedViewportChanged: new BeEvent() }));
    sinon.stub(IModelApp, "toolAdmin").get(() => ({ activeToolChanged: new BeEvent() }));
  });

  afterEach(() => {
    sinon.restore();
    td.reset();
  });

  it("renders supplied trees", async () => {
    const stubSelectableTree = sinon.stub().returns(null);
    await td.replaceEsm("../components/SelectableTree.js", {
      ...selectableTreeModule,
      SelectableTree: stubSelectableTree,
    });
    const { createTreeWidget } = await initialize();

    const trees: selectableTreeModule.SelectableTreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <div>Tree Content</div>,
      },
    ];
    const widget = createTreeWidget({ trees });
    render(<>{widget.content}</>);
    expect(stubSelectableTree).to.be.called;
    const [props] = stubSelectableTree.args[0];
    expect(props.trees).to.be.eq(trees);
  });

  it("renders error message if tree component throws", async () => {
    const { UiFramework, TreeWidget, createTreeWidget } = await initialize();
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
    const widget = createTreeWidget({ trees });
    const { queryByText } = render(<>{widget.content}</>);
    await waitFor(() => expect(queryByText(TreeWidget.translate("errorState.title"))).to.not.be.null);
  });

  async function initialize() {
    const UiFramework = (await import("@itwin/appui-react")).UiFramework;
    await UiFramework.initialize();

    const TreeWidget = (await import("../TreeWidget.js")).TreeWidget;
    await TreeWidget.initialize(new EmptyLocalization());

    const createTreeWidget = (await import("../components/TreeWidgetUiItemsProvider.js")).createTreeWidget;

    return { UiFramework, TreeWidget, createTreeWidget };
  }
});
