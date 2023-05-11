/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { StagePanelLocation, StagePanelSection, StageUsage } from "@itwin/appui-react";
import { render } from "@testing-library/react";
import * as categoriesTreeComponents from "../components/trees/category-tree/CategoriesTreeComponent";
import * as modelsTreeComponents from "../components/trees/models-tree/ModelsTreeComponent";
import * as widgetComponent from "../components/TreeWidgetComponent";
import { TreeWidgetUiItemsProvider } from "../components/TreeWidgetUiItemsProvider";
import { TestUtils } from "./TestUtils";

describe("TreeWidgetUiItemsProvider", () => {
  before(async () => {
    await TestUtils.initialize();
  });

  after(() => {
    TestUtils.terminate();
  });

  afterEach(() => {
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
    const widgetComponentStub = sinon.stub(widgetComponent, "TreeWidgetComponent").returns(null);
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
    const widgetComponentStub = sinon.stub(widgetComponent, "TreeWidgetComponent").returns(null);
    const trees: widgetComponent.TreeDefinition[] = [{
      id: "tree",
      getLabel: () => "Tree Label",
      render: () => <div>Tree Content</div>,
    }];
    const provider = new TreeWidgetUiItemsProvider({trees});
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start);
    render(<>{widget.content}</>);

    expect(widgetComponentStub).to.be.called;
    const [props] = widgetComponentStub.args[0];
    expect(props.trees).to.be.eq(trees);
  });
});
