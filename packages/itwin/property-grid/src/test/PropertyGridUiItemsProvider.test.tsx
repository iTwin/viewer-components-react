/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { createRef } from "react";
import sinon from "sinon";
import { StagePanelLocation, StagePanelSection, StageUsage, UiFramework, WidgetState } from "@itwin/appui-react";
import { KeySet, StandardNodeTypes } from "@itwin/presentation-common";
import * as usePropertyGridTransientStateModule from "../hooks/UsePropertyGridTransientState";
import * as propertyGridComponent from "../PropertyGridComponent";
import { PropertyGridManager } from "../PropertyGridManager";
import { PropertyGridUiItemsProvider, PropertyGridWidgetId } from "../PropertyGridUiItemsProvider";
import { render, stubSelectionManager, waitFor } from "./TestUtils";

import type { WidgetDef } from "@itwin/appui-react";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";

describe("PropertyGridUiItemsProvider", () => {
  let propertyGridComponentStub: sinon.SinonStub<
    Parameters<(typeof propertyGridComponent)["PropertyGridComponent"]>,
    ReturnType<(typeof propertyGridComponent)["PropertyGridComponent"]>
  >;

  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);
    propertyGridComponentStub = sinon.stub(propertyGridComponent, "PropertyGridComponent").returns(<></>);

    const ref = createRef<HTMLDivElement>();
    sinon.stub(usePropertyGridTransientStateModule, "usePropertyGridTransientState").callsFake(() => ref);
  });

  after(() => {
    sinon.restore();
  });

  afterEach(() => {
    propertyGridComponentStub.reset();
  });

  it("provides widgets to default location", () => {
    const provider = new PropertyGridUiItemsProvider();

    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End)).to.not.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.Start)).to.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.Start)).to.be.empty;
  });

  it("provides widgets to preferred location", () => {
    const provider = new PropertyGridUiItemsProvider({
      defaultPanelLocation: StagePanelLocation.Left,
      defaultPanelSection: StagePanelSection.End,
    });

    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End)).to.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.End)).to.not.be.empty;
    expect(provider.provideWidgets("", StageUsage.General, StagePanelLocation.Left, StagePanelSection.Start)).to.be.empty;
  });

  it("renders property grid component", () => {
    const provider = new PropertyGridUiItemsProvider();
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End);
    render(<>{widget.content}</>);

    expect(propertyGridComponentStub).to.be.called;
  });

  it("renders error message if property grid component throws", async () => {
    propertyGridComponentStub.reset();
    propertyGridComponentStub.callsFake(() => {
      throw new Error("Error");
    });

    const provider = new PropertyGridUiItemsProvider();
    const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End);
    const { queryByText } = render(<>{widget.content}</>);

    await waitFor(() => {
      expect(propertyGridComponentStub).to.be.called;
      expect(queryByText(PropertyGridManager.translate("error"))).to.not.be.null;
    });
  });

  describe("widget state", () => {
    const widgetDef = {
      id: PropertyGridWidgetId,
      setWidgetState: sinon.stub<Parameters<WidgetDef["setWidgetState"]>, ReturnType<WidgetDef["setWidgetState"]>>(),
    };
    const frontstageDef = {
      findWidgetDef: (id: string) => (id === widgetDef.id ? widgetDef : undefined),
    };

    let selectionManager: ReturnType<typeof stubSelectionManager>;

    before(() => {
      selectionManager = stubSelectionManager();
      sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstageDef);
    });

    beforeEach(() => {
      selectionManager.getSelection.reset();
      widgetDef.setWidgetState.reset();
    });

    function renderWidget() {
      const provider = new PropertyGridUiItemsProvider();
      const [widget] = provider.provideWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End);
      render(<>{widget.content}</>);
    }

    it("hides widget if `UnifiedSelection` changes to empty", async () => {
      renderWidget();

      selectionManager.getSelection.returns(new KeySet());
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Hidden);
      });
    });

    it("hides widget if `UnifiedSelection` has only transient instance keys", async () => {
      renderWidget();

      selectionManager.getSelection.returns(new KeySet([{ id: "0xffffff0000000001", className: "Transient" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Hidden);
      });
    });

    it("opens widget if `UnifiedSelection` changes to non-empty", async () => {
      renderWidget();

      selectionManager.getSelection.returns(new KeySet([{ id: "0x1", className: "TestClass" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Open);
      });
    });

    it("opens widget if `UnifiedSelection` has node keys", async () => {
      renderWidget();

      const key: ECClassGroupingNodeKey = {
        className: "TestClass",
        groupedInstancesCount: 5,
        pathFromRoot: [],
        type: StandardNodeTypes.ECClassGroupingNode,
        version: 2,
      };
      selectionManager.getSelection.returns(new KeySet([key]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Open);
      });
    });
  });
});
