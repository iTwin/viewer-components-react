/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as appuiReactModule from "@itwin/appui-react";
import { UiFramework } from "@itwin/appui-react";
import { EmptyLocalization } from "@itwin/core-common";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { Selectables, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import { PropertyGridManager } from "../property-grid-react/PropertyGridManager.js";
import { createPropertyGrid, PropertyGridWidget, PropertyGridWidgetId } from "../property-grid-react/PropertyGridUiItemsProvider.js";
import { act, render, stubSelectionStorage, waitFor } from "./TestUtils.js";

import type { ReactElement } from "react";
import type { WidgetDef } from "@itwin/appui-react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { EventArgs, Props } from "@itwin/presentation-shared";
import type { Selectable } from "@itwin/unified-selection";
import type { PropertyGridWidgetProps } from "../property-grid-react/PropertyGridUiItemsProvider.js";

describe("createPropertyGrid", () => {
  function TestPropertyGridComponent() {
    return <>Test PropertyGridComponent</>;
  }

  let selectionStorage: ReturnType<typeof stubSelectionStorage>;

  beforeAll(async () => {
    await PropertyGridManager.initialize(new EmptyLocalization());
  });

  afterAll(() => {
    PropertyGridManager.terminate();
  });

  beforeEach(async () => {
    selectionStorage = stubSelectionStorage();
  });

  it("creates a basic widget", async () => {
    const widget = createPropertyGrid({ selectionStorage });
    expect(widget.content).toBeDefined();
  });

  it("renders property grid component", async () => {
    const { getByText } = render(<PropertyGridWidget widgetId="x" selectionStorage={selectionStorage} propertyGridComponent={<TestPropertyGridComponent />} />);
    await waitFor(() => getByText("Test PropertyGridComponent"));
  });

  it("renders error message if property grid component throws", async () => {
    const errorStub = vi.spyOn(console, "error").mockImplementation(() => {});
    function ThrowingComponent(): ReactElement | null {
      throw new Error("Test error");
    }
    const { getByText } = render(<PropertyGridWidget widgetId="x" selectionStorage={selectionStorage} propertyGridComponent={<ThrowingComponent />} />);
    await waitFor(() => getByText("error"));
    errorStub.mockRestore();
  });

  describe("widget state", () => {
    const imodel = { key: "test-imodel" } as IModelConnection;
    const widgetDef = {
      id: PropertyGridWidgetId,
      state: appuiReactModule.WidgetState.Hidden,
      setWidgetState: vi.fn<appuiReactModule.WidgetDef["setWidgetState"]>(),
    };

    beforeEach(async () => {
      widgetDef.state = appuiReactModule.WidgetState.Hidden;
      widgetDef.setWidgetState.mockReset();

      vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodel);
    });

    describe("with unified selection storage", () => {
      async function setupSelection(keys: Selectable[]) {
        selectionStorage.getSelection.mockReset();
        selectionStorage.getSelection.mockReturnValue(Selectables.create(keys));
      }
      function triggerSelectionChange(props?: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
        selectionStorage.selectionChangeEvent.raiseEvent({ source: "TestSource", imodelKey: imodel.key, ...props } as EventArgs<
          typeof selectionStorage.selectionChangeEvent
        >);
      }

      function renderWidget(widgetProps?: Partial<PropertyGridWidgetProps>) {
        const props = {
          widgetId: "test",
          widgetDef: widgetDef as unknown as WidgetDef,
          propertyGridComponent: <TestPropertyGridComponent />,
          selectionStorage,
          ...widgetProps,
        } as Props<typeof PropertyGridWidget>;
        render(<PropertyGridWidget {...props} />);
      }

      it("hides widget if unified selection changes to empty", async () => {
        await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
        renderWidget();

        widgetDef.state = appuiReactModule.WidgetState.Open;
        await setupSelection([]);
        act(() => triggerSelectionChange());

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Hidden);
        });
      });

      it("hides widget if unified selection has only transient instance keys", async () => {
        await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
        renderWidget();

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Open);
        });

        widgetDef.setWidgetState.mockReset();
        widgetDef.state = appuiReactModule.WidgetState.Open;
        await setupSelection([{ id: "0xffffff0000000001", className: TRANSIENT_ELEMENT_CLASSNAME }]);
        act(() => triggerSelectionChange());

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Hidden);
        });
      });

      it("opens widget if unified selection changes to non-empty", async () => {
        await setupSelection([]);
        renderWidget();

        widgetDef.setWidgetState.mockReset();
        await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
        act(() => triggerSelectionChange());

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Open);
        });
      });

      it("opens widget if unified selection has node keys", async () => {
        await setupSelection([]);
        renderWidget();

        widgetDef.setWidgetState.mockReset();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const key: ECClassGroupingNodeKey = {
          className: "TestSchema.TestClass",
          groupedInstancesCount: 5,
          pathFromRoot: [],
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          type: StandardNodeTypes.ECClassGroupingNode,
          version: 2,
        };
        await setupSelection([{ identifier: "class grouping node", data: key, async *loadInstanceKeys() {} }]);
        act(() => triggerSelectionChange());

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Open);
        });
      });

      it("does not open widget when unified selection changes to non-empty if the widget is not hidden", async () => {
        await setupSelection([{ id: "0x2", className: "TestSchema.TestClass" }]);
        renderWidget();

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Open);
        });

        widgetDef.setWidgetState.mockReset();
        widgetDef.state = appuiReactModule.WidgetState.Closed;

        await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
        act(() => triggerSelectionChange());

        await waitFor(() => expect(widgetDef.setWidgetState).not.toHaveBeenCalled());
      });

      it("opens widget if unified selection non-empty with instance keys and `shouldShow` return true", async () => {
        await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
        renderWidget({ shouldShow: async () => true });

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Open);
        });
      });

      it("opens widget if unified selection non-empty with node keys and `shouldShow` returns true", async () => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const key: ECClassGroupingNodeKey = {
          className: "TestSchema.TestClass",
          groupedInstancesCount: 5,
          pathFromRoot: [],
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          type: StandardNodeTypes.ECClassGroupingNode,
          version: 2,
        };
        await setupSelection([{ identifier: "class grouping node", data: key, async *loadInstanceKeys() {} }]);
        renderWidget({ shouldShow: async () => true });

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Open);
        });
      });

      it("hides widget if unified selection changes non-empty and `shouldShow` returns false", async () => {
        widgetDef.state = appuiReactModule.WidgetState.Open;
        await setupSelection([{ id: "0x1", className: "TestSchema.TestClass" }]);
        renderWidget({ shouldShow: async () => false });

        await waitFor(() => {
          expect(widgetDef.setWidgetState).toHaveBeenCalled();
          expect(widgetDef.setWidgetState).toHaveBeenCalledWith(appuiReactModule.WidgetState.Hidden);
        });
      });
    });
  });
});
