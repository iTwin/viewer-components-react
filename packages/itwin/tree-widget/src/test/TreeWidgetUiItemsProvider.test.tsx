/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { createRef } from "react";
import sinon from "sinon";
import { StagePanelLocation, StagePanelSection, StageUsage, UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import * as selectableTreeModule from "../components/SelectableTree";
import * as categoriesTreeComponents from "../components/trees/category-tree/CategoriesTreeComponent";
import * as modelsTreeComponents from "../components/trees/models-tree/ModelsTreeComponent";
import { TreeWidgetUiItemsProvider } from "../components/TreeWidgetUiItemsProvider";
import * as useTreeTransientStateModule from "../components/utils/UseTreeTransientState";
import { TreeWidget } from "../TreeWidget";
import { render, TestUtils, waitFor } from "./TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";

describe("TreeWidgetUiItemsProvider", () => {
  beforeEach(async () => {
    sinon.stub(IModelApp, "viewManager").get(() => ({ onSelectedViewportChanged: new BeEvent() }));

    const ref = createRef<HTMLDivElement>();
    sinon.stub(useTreeTransientStateModule, "useTreeTransientState").callsFake(() => ref);

    await TestUtils.initialize();
  });

  afterEach(() => {
    TestUtils.terminate();
    sinon.restore();
  });

  it("provides widgets to default location", () => {
    const provider = new TreeWidgetUiItemsProvider();

    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start)).to.not.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.End)).to.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.Start)).to.be.empty;
  });

  it("provides widgets to preferred location", () => {
    const provider = new TreeWidgetUiItemsProvider({
      defaultPanelLocation: StagePanelLocation.Left,
      defaultPanelSection: StagePanelSection.End,
    });

    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start)).to.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.End)).to.not.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.Start)).to.be.empty;
  });

  it("renders default trees", () => {
    const widgetComponentStub = sinon.stub(selectableTreeModule, "SelectableTree").returns(null);
    const modelsTreeComponentStub = sinon.stub(modelsTreeComponents, "ModelsTreeComponent").returns(null);
    const categoriesTreeComponentStub = sinon.stub(categoriesTreeComponents, "CategoriesTreeComponent").returns(null);
    const provider = new TreeWidgetUiItemsProvider();
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start);
    render(<>{widget.content}</>);

    expect(widgetComponentStub).to.be.called;
    const [props] = widgetComponentStub.args[0];
    expect(props.trees).to.have.lengthOf(2);

    render(<>{props.trees[0].render()}</>);
    expect(modelsTreeComponentStub).to.be.called;

    render(<>{props.trees[1].render()}</>);
    expect(categoriesTreeComponentStub).to.be.called;
  });

  it("renders supplied trees", () => {
    const widgetComponentStub = sinon.stub(selectableTreeModule, "SelectableTree").returns(null);
    const trees: selectableTreeModule.TreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <div>Tree Content</div>,
      },
    ];
    const provider = new TreeWidgetUiItemsProvider({ trees });
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start);
    render(<>{widget.content}</>);

    expect(widgetComponentStub).to.be.called;
    const [props] = widgetComponentStub.args[0];
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

    const trees: selectableTreeModule.TreeDefinition[] = [
      {
        id: "tree",
        getLabel: () => "Tree Label",
        render: () => <TestTree />,
      },
    ];
    const provider = new TreeWidgetUiItemsProvider({ trees });
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start);
    const { queryByText } = render(<>{widget.content}</>);

    await waitFor(() => expect(queryByText(TreeWidget.translate("error"))).to.not.be.null);
  });
});
