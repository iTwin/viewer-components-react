/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import { createRef } from "react";
import sinon from "sinon";
import * as td from "testdouble";
import { StagePanelLocation, StagePanelSection, StageUsage, UiFramework, WidgetState } from "@itwin/appui-react";
import { KeySet, StandardNodeTypes } from "@itwin/presentation-common";
import * as usePropertyGridTransientStateModule from "../property-grid-react/hooks/UsePropertyGridTransientState.js";
import * as propertyGridComponentModule from "../property-grid-react/PropertyGridComponent.js";
import { PropertyGridWidgetId } from "../property-grid-react/PropertyGridUiItemsProvider.js";
import { render, stubSelectionManager, waitFor } from "./TestUtils.js";

import type * as propertyGridUiItemsProviderModule from "../property-grid-react/PropertyGridUiItemsProvider.js";
import type { WidgetDef } from "@itwin/appui-react";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";

describe("PropertyGridUiItemsProvider", () => {
  let propertyGridComponentStub: sinon.SinonStub<
    Parameters<(typeof propertyGridComponentModule)["PropertyGridComponent"]>,
    ReturnType<(typeof propertyGridComponentModule)["PropertyGridComponent"]>
  >;
  let PropertyGridUiItemsProvider: typeof propertyGridUiItemsProviderModule.PropertyGridUiItemsProvider;

  beforeEach(async () => {
    await td.replaceEsm("../property-grid-react/PropertyGridManager.js", {
      PropertyGridManager: {
        translate: (key: string) => key,
      },
    });

    propertyGridComponentStub = sinon
      .stub<
        Parameters<(typeof propertyGridComponentModule)["PropertyGridComponent"]>,
        ReturnType<(typeof propertyGridComponentModule)["PropertyGridComponent"]>
      >()
      .returns(<></>);
    await td.replaceEsm("../property-grid-react/PropertyGridComponent.js", {
      ...propertyGridComponentModule,
      PropertyGridComponent: propertyGridComponentStub,
    });

    const ref = createRef<HTMLDivElement>();
    await td.replaceEsm("../property-grid-react/hooks/UsePropertyGridTransientState.js", {
      ...usePropertyGridTransientStateModule,
      usePropertyGridTransientState: () => ref,
    });

    PropertyGridUiItemsProvider = (await import("../property-grid-react/PropertyGridUiItemsProvider.js")).PropertyGridUiItemsProvider;
  });

  afterEach(() => {
    sinon.restore();
    td.reset();
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
      expect(queryByText("error")).to.not.be.null;
    });
  });

  describe("widget state", () => {
    const widgetDef = {
      id: PropertyGridWidgetId,
      state: WidgetState.Hidden,
      setWidgetState: sinon.stub<Parameters<WidgetDef["setWidgetState"]>, ReturnType<WidgetDef["setWidgetState"]>>(),
    };
    const frontstageDef = {
      findWidgetDef: (id: string) => (id === widgetDef.id ? widgetDef : undefined),
    };

    let selectionManager: ReturnType<typeof stubSelectionManager>;

    beforeEach(async () => {
      const { Presentation } = await import("@itwin/presentation-frontend");
      selectionManager = stubSelectionManager(Presentation);
      selectionManager.getSelection.reset();

      sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstageDef);
      widgetDef.state = WidgetState.Hidden;
      widgetDef.setWidgetState.reset();
    });

    function renderWidget(props?: propertyGridUiItemsProviderModule.PropertyGridUiItemsProviderProps) {
      const provider = new PropertyGridUiItemsProvider(props);
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

    it("does not open widget when state is not `Hidden` and `UnifiedSelection` changes to non-empty", async () => {
      renderWidget();

      widgetDef.state = WidgetState.Closed;
      selectionManager.getSelection.returns(new KeySet([{ id: "0x1", className: "TestClass" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => expect(widgetDef.setWidgetState).to.not.be.called);
    });

    it("opens widget if `UnifiedSelection` changes to non-empty and ", async () => {
      renderWidget({ propertyGridProps: { shouldShow: () => true } });

      selectionManager.getSelection.returns(new KeySet([{ id: "0x1", className: "TestClass" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Open);
      });
    });

    it("opens widget if `UnifiedSelection` changes to non-empty AND shouldShow return true ", async () => {
      renderWidget({ propertyGridProps: { shouldShow: () => true } });

      selectionManager.getSelection.returns(new KeySet([{ id: "0x1", className: "TestClass" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Open);
      });
    });

    it("hides widget if `UnifiedSelection` changes to non-empty AND shouldShow return false ", async () => {
      renderWidget({ propertyGridProps: { shouldShow: () => false } });

      selectionManager.getSelection.returns(new KeySet([{ id: "0x1", className: "TestClass" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Hidden);
      });
    });
  });

  describe("createPropertyGrid", () => {
    it("creates a basic widget", async () => {
      const { createPropertyGrid } = await import("../property-grid-react/PropertyGridUiItemsProvider.js");
      const widget = createPropertyGrid({});
      expect(widget.content).to.not.be.undefined;
    });
  });
});
