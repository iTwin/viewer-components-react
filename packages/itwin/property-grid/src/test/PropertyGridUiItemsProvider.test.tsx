/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import { createRef } from "react";
import { act } from "react-dom/test-utils";
import sinon from "sinon";
import * as td from "testdouble";
import * as appuiReactModule from "@itwin/appui-react";
import { KeySet, StandardNodeTypes } from "@itwin/presentation-common";
import { Selectables, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import * as usePropertyGridTransientStateModule from "../property-grid-react/hooks/UsePropertyGridTransientState.js";
import { createKeysFromSelectable } from "../property-grid-react/hooks/UseUnifiedSelectionHandler.js";
import * as propertyGridComponentModule from "../property-grid-react/PropertyGridComponent.js";
import * as propertyGridUiItemsProviderModule from "../property-grid-react/PropertyGridUiItemsProvider.js";
import { render, stubSelectionManager, stubSelectionStorage, waitFor } from "./TestUtils.js";

import type { Selectable } from "@itwin/unified-selection";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { ISelectionProvider } from "@itwin/presentation-frontend";
import type { EventArgs } from "@itwin/presentation-shared";
import type { IModelConnection } from "@itwin/core-frontend";
import type { PropertyGridWidgetProps } from "../property-grid-react/PropertyGridUiItemsProvider.js";

describe("PropertyGridUiItemsProvider", () => {
  const widgetDef = {
    id: propertyGridUiItemsProviderModule.PropertyGridWidgetId,
    state: appuiReactModule.WidgetState.Hidden,
    setWidgetState: sinon.stub<Parameters<appuiReactModule.WidgetDef["setWidgetState"]>, ReturnType<appuiReactModule.WidgetDef["setWidgetState"]>>(),
  };

  let selectionManager: ReturnType<typeof stubSelectionManager>;
  let selectionStorage: ReturnType<typeof stubSelectionStorage>;
  let propertyGridComponentStub: sinon.SinonStub<
    Parameters<(typeof propertyGridComponentModule)["PropertyGridComponent"]>,
    ReturnType<(typeof propertyGridComponentModule)["PropertyGridComponent"]>
  >;
  let PropertyGridUiItemsProvider: typeof propertyGridUiItemsProviderModule.PropertyGridUiItemsProvider;

  beforeEach(async () => {
    await td.replaceEsm("@itwin/appui-react", {
      ...appuiReactModule,
      useSpecificWidgetDef: () => widgetDef,
    });

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

    const { Presentation } = await import("@itwin/presentation-frontend");
    selectionManager = stubSelectionManager(Presentation);
    selectionStorage = stubSelectionStorage();

    PropertyGridUiItemsProvider = (await import("../property-grid-react/PropertyGridUiItemsProvider.js")).PropertyGridUiItemsProvider;
  });

  afterEach(() => {
    sinon.restore();
    td.reset();
  });

  it("provides widgets to default location", () => {
    const provider = new PropertyGridUiItemsProvider();

    expect(provider.provideWidgets("", appuiReactModule.StageUsage.General, appuiReactModule.StagePanelLocation.Right, appuiReactModule.StagePanelSection.End))
      .to.not.be.empty;
    expect(
      provider.provideWidgets("", appuiReactModule.StageUsage.General, appuiReactModule.StagePanelLocation.Right, appuiReactModule.StagePanelSection.Start),
    ).to.be.empty;
    expect(provider.provideWidgets("", appuiReactModule.StageUsage.General, appuiReactModule.StagePanelLocation.Left, appuiReactModule.StagePanelSection.Start))
      .to.be.empty;
  });

  it("provides widgets to preferred location", () => {
    const provider = new PropertyGridUiItemsProvider({
      defaultPanelLocation: appuiReactModule.StagePanelLocation.Left,
      defaultPanelSection: appuiReactModule.StagePanelSection.End,
    });

    expect(provider.provideWidgets("", appuiReactModule.StageUsage.General, appuiReactModule.StagePanelLocation.Right, appuiReactModule.StagePanelSection.End))
      .to.be.empty;
    expect(provider.provideWidgets("", appuiReactModule.StageUsage.General, appuiReactModule.StagePanelLocation.Left, appuiReactModule.StagePanelSection.End))
      .to.not.be.empty;
    expect(provider.provideWidgets("", appuiReactModule.StageUsage.General, appuiReactModule.StagePanelLocation.Left, appuiReactModule.StagePanelSection.Start))
      .to.be.empty;
  });

  it("renders property grid component", () => {
    const provider = new PropertyGridUiItemsProvider();
    const [widget] = provider.provideWidgets(
      "",
      appuiReactModule.StageUsage.General,
      appuiReactModule.StagePanelLocation.Right,
      appuiReactModule.StagePanelSection.End,
    );
    render(<>{widget.content}</>);

    expect(propertyGridComponentStub).to.be.called;
  });

  it("renders error message if property grid component throws", async () => {
    propertyGridComponentStub.reset();
    propertyGridComponentStub.callsFake(() => {
      throw new Error("Error");
    });

    const provider = new PropertyGridUiItemsProvider();
    const [widget] = provider.provideWidgets(
      "",
      appuiReactModule.StageUsage.General,
      appuiReactModule.StagePanelLocation.Right,
      appuiReactModule.StagePanelSection.End,
    );
    const { queryByText } = render(<>{widget.content}</>);

    await waitFor(() => {
      expect(propertyGridComponentStub).to.be.called;
      expect(queryByText("error")).to.not.be.null;
    });
  });

  describe("widget state", () => {
    const imodel = { key: "test-imodel" } as IModelConnection;

    beforeEach(async () => {
      widgetDef.state = appuiReactModule.WidgetState.Hidden;
      widgetDef.setWidgetState.reset();
    });

    [
      {
        name: "with unified selection storage",
        getProps: (): Partial<PropertyGridWidgetProps> => ({ selectionStorage }),
        async setupSelection(keys: Selectable[]) {
          selectionStorage.getSelection.reset();
          selectionStorage.getSelection.returns(Selectables.create(keys));
        },
        triggerSelectionChange(props?: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
          selectionStorage.selectionChangeEvent.raiseEvent({ source: "TestSource", imodelKey: imodel.key, ...props } as EventArgs<
            typeof selectionStorage.selectionChangeEvent
          >);
        },
      },
      {
        name: "with deprecated selection manager",
        getProps: (): Partial<PropertyGridWidgetProps> => ({}),
        async setupSelection(keys: Selectable[]) {
          selectionManager.getSelection.reset();
          selectionManager.getSelection.returns(new KeySet((await Promise.all(keys.map(createKeysFromSelectable))).flat()));
        },
        triggerSelectionChange(props?: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
          selectionManager.selectionChange.raiseEvent(
            { source: "TestSource", imodel, ...props } as EventArgs<typeof selectionManager.selectionChange>,
            selectionManager as ISelectionProvider,
          );
        },
      },
    ].forEach(({ name, getProps, setupSelection, triggerSelectionChange }) => {
      function renderWidget(props?: propertyGridUiItemsProviderModule.PropertyGridUiItemsProviderProps) {
        const provider = new PropertyGridUiItemsProvider({
          ...props,
          propertyGridProps: { ...getProps(), ...props?.propertyGridProps } as PropertyGridWidgetProps,
        });
        const [widget] = provider.provideWidgets(
          "",
          appuiReactModule.StageUsage.General,
          appuiReactModule.StagePanelLocation.Right,
          appuiReactModule.StagePanelSection.End,
        );
        render(<>{widget.content}</>);
      }

      describe(name, () => {
        it("hides widget if unified selection changes to empty", async () => {
          widgetDef.state = appuiReactModule.WidgetState.Open;
          renderWidget();

          await setupSelection([]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Hidden);
          });
        });

        it("hides widget if unified selection has only transient instance keys", async () => {
          renderWidget();

          await setupSelection([{ id: "0xffffff0000000001", className: TRANSIENT_ELEMENT_CLASSNAME }]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Hidden);
          });
        });

        it("opens widget if unified selection changes to non-empty", async () => {
          renderWidget();

          await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Open);
          });
        });

        it("opens widget if unified selection has node keys", async () => {
          renderWidget();

          const key: ECClassGroupingNodeKey = {
            className: "TestSchema.TestClass",
            groupedInstancesCount: 5,
            pathFromRoot: [],
            type: StandardNodeTypes.ECClassGroupingNode,
            version: 2,
          };
          await setupSelection([{ identifier: "class grouping node", data: key, async *loadInstanceKeys() {} }]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Open);
          });
        });

        it("does not open widget when unified selection changes to non-empty if the widget is not hidden", async () => {
          renderWidget();

          widgetDef.state = appuiReactModule.WidgetState.Closed;

          await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
          act(() => triggerSelectionChange());

          await waitFor(() => expect(widgetDef.setWidgetState).to.not.be.called);
        });

        it("opens widget if unified selection changes to non-empty instance keys and `shouldShow` return true", async () => {
          renderWidget({ propertyGridProps: { shouldShow: () => true } });

          await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Open);
          });
        });

        it("opens widget if unified selection changes to non-empty node keys and `shouldShow` returns true", async () => {
          renderWidget({ propertyGridProps: { shouldShow: () => true } });

          const key: ECClassGroupingNodeKey = {
            className: "TestSchema.TestClass",
            groupedInstancesCount: 5,
            pathFromRoot: [],
            type: StandardNodeTypes.ECClassGroupingNode,
            version: 2,
          };
          await setupSelection([{ identifier: "class grouping node", data: key, async *loadInstanceKeys() {} }]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Open);
          });
        });

        it("hides widget if unified selection changes to non-empty and `shouldShow` returns false", async () => {
          renderWidget({ propertyGridProps: { shouldShow: () => false } });

          await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
          act(() => triggerSelectionChange());

          await waitFor(() => {
            expect(widgetDef.setWidgetState).to.be.called;
            expect(widgetDef.setWidgetState).to.be.calledWith(appuiReactModule.WidgetState.Hidden);
          });
        });
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
