/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { KeySet } from "@itwin/presentation-common";
import { PresentationLabelsProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { SelectionChangeType } from "@itwin/presentation-frontend";
import { normalizeFullClassName } from "@itwin/presentation-shared";
import { Selectables } from "@itwin/unified-selection";
import { MultiElementPropertyGrid } from "../../property-grid-react/components/MultiElementPropertyGrid.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import {
  act,
  createPropertyRecord,
  getByRole as getByRoleRTL,
  render,
  stubFavoriteProperties,
  stubPresentation,
  stubSelectionManager,
  stubSelectionStorage,
  waitFor,
} from "../TestUtils.js";

import type { MockInstance } from "vitest";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ISelectionProvider } from "@itwin/presentation-frontend";
import type { EventArgs } from "@itwin/presentation-shared";
import type { SelectableInstanceKey } from "@itwin/unified-selection";
import type * as UseTelemetryContextModule from "../../property-grid-react/hooks/UseTelemetryContext.js";

describe("<MultiElementPropertyGrid />", () => {
  const imodel = {
    key: "test-imodel",
  } as IModelConnection;

  let getDataStub: ReturnType<typeof vi.spyOn>;
  let getLabelsStub: MockInstance<(keys: InstanceKey[]) => Promise<string[]>>;
  let selectionStorage: ReturnType<typeof stubSelectionStorage>;
  let selectionManager: ReturnType<typeof stubSelectionManager>;
  const getParentInstanceKeyStub = vi.fn<(key: InstanceKey) => Promise<InstanceKey | undefined>>();

  beforeEach(() => {
    getDataStub = vi.spyOn(PresentationPropertyDataProvider.prototype, "getData");
    getLabelsStub = vi.spyOn(PresentationLabelsProvider.prototype, "getLabels");

    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);

    stubFavoriteProperties();
    stubPresentation();

    selectionStorage = stubSelectionStorage();
    selectionManager = stubSelectionManager();
    getParentInstanceKeyStub.mockResolvedValue(undefined);
  });

  [
    {
      name: "with unified selection storage",
      getProps: () => ({ imodel, selectionStorage, getParentInstanceKey: getParentInstanceKeyStub }),
      setupSelection(keys: SelectableInstanceKey[]) {
        selectionStorage.getSelection.mockReset();
        selectionStorage.getSelection.mockReturnValue(Selectables.create(keys));
      },
      triggerSelectionChange(props: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
        selectionStorage.selectionChangeEvent.raiseEvent({
          imodelKey: imodel.key,
          iModelKey: imodel.key,
          level: 0,
          source: "TestSource",
          storage: selectionStorage,
          changeType: "clear",
          selectables: Selectables.create([]),
          timestamp: new Date(),
          ...props,
        });
      },
    },
    {
      name: "with deprecated selection manager",
      getProps: () => ({ imodel, getParentInstanceKey: getParentInstanceKeyStub }),
      setupSelection(keys: SelectableInstanceKey[]) {
        selectionManager.getSelection.mockReset();
        selectionManager.getSelection.mockReturnValue(new KeySet(keys));
      },
      triggerSelectionChange(props: Pick<Partial<EventArgs<typeof selectionStorage.selectionChangeEvent>>, "source">) {
        selectionManager.selectionChange.raiseEvent(
          {
            imodel,
            level: 0,
            source: "TestSource",
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            changeType: SelectionChangeType.Clear,
            keys: new KeySet(),
            timestamp: new Date(),
            ...props,
          },
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          selectionManager as ISelectionProvider,
        );
      },
    },
  ].forEach(({ name, getProps, setupSelection, triggerSelectionChange }) => {
    describe(name, () => {
      it("renders properties for a single instance", async () => {
        setupMultiInstanceData([
          {
            key: { id: "0x1", className: "TestSchema.TestClass" },
            value: "Test-Value",
          },
        ]);

        const { getByText, queryByRole } = render(<MultiElementPropertyGrid {...getProps()} />);

        await waitFor(() => getByText("Test-Value"));
        // verify button for opening element list is not rendered
        expect(queryByRole("button", { name: "element-list.title" })).toBeNull();
      });

      it("renders properties for multiple instances", async () => {
        setupMultiInstanceData([
          {
            key: { id: "0x1", className: "TestSchema.TestClass" },
            value: "Test-Value-1",
          },
          {
            key: { id: "0x2", className: "TestSchema.TestClass" },
            value: "Test-Value-2",
          },
        ]);

        const { getByText, queryByRole } = render(<MultiElementPropertyGrid {...getProps()} />);

        await waitFor(() => getByText("MultiInstances"));
        // verify button for opening element list is rendered
        expect(queryByRole("button", { name: "element-list.title" })).not.toBeNull();
      });

      it("renders element list", async () => {
        const instanceKeys = [
          { id: "0x1", className: "TestSchema.TestClass" },
          { id: "0x2", className: "TestSchema.TestClass" },
        ];
        const expectedLabels = instanceKeys.map(buildLabel);

        setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
        getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

        const { getByText, getByRole, user } = render(<MultiElementPropertyGrid {...getProps()} />);

        await waitFor(() => getByText("MultiInstances"));
        const button = getByRole("button", { name: "element-list.title" });

        await user.click(button);
        // verify element list is rendered
        for (const expected of expectedLabels) {
          await waitFor(() => getByText(expected));
        }
      });

      it("renders specific element props", async () => {
        const instanceKeys = [
          { id: "0x1", className: "TestSchema.TestClass" },
          { id: "0x2", className: "TestSchema.TestClass" },
        ];
        const expectedLabels = instanceKeys.map(buildLabel);

        setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
        getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

        const { getByText, getByRole, user } = render(<MultiElementPropertyGrid {...getProps()} />);

        await waitFor(() => getByText("MultiInstances"));
        const button = getByRole("button", { name: "element-list.title" });

        await user.click(button);
        const element = await waitFor(() => getByText(expectedLabels[1]));

        // setup data provider for single element property grid
        setupSingleElementData(expectedLabels[1], "Test-Value-2");

        await user.click(element);
        await waitFor(() => getByText("Test-Value-2"));
      });

      it("navigates from single element to multi element grid using 'Back' button", async () => {
        const instanceKeys = [
          { id: "0x1", className: "TestSchema.TestClass" },
          { id: "0x2", className: "TestSchema.TestClass" },
        ];
        const expectedLabels = instanceKeys.map(buildLabel);

        setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
        getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

        const { getByText, getByRole, container, user } = render(<MultiElementPropertyGrid {...getProps()} />);

        await waitFor(() => getByText("MultiInstances"));
        const listButton = getByRole("button", { name: "element-list.title" });

        // navigate to element list
        await user.click(listButton);
        const element = await waitFor(() => getByText(expectedLabels[1]));

        // setup data provider for single element property grid
        setupSingleElementData(expectedLabels[1], "Test-Value-2");

        // navigate to specific element properties
        await user.click(element);
        await waitFor(() => getByText("Test-Value-2"));

        // navigate back to element list
        const singleElementGrid = container.querySelector<HTMLButtonElement>(".property-grid-react-single-element-property-grid");
        expect(singleElementGrid).not.toBeNull();
        const singleElementBackButton = getByRoleRTL(singleElementGrid!, "button", { name: "header.back" });
        await user.click(singleElementBackButton);
        await waitFor(() => getByText(expectedLabels[0]));

        // navigate back to multi instances properties grid
        const elementList = container.querySelector<HTMLDivElement>(".property-grid-react-element-list");
        expect(elementList).not.toBeNull();
        const elementListBackButton = getByRoleRTL(elementList!, "button", { name: "header.back" });
        await user.click(elementListBackButton);
        await waitFor(() => getByText("MultiInstances"));
      });

      it("goes back to multi element property grid after selection changes", async () => {
        const instanceKeys = [
          { id: "0x1", className: "TestSchema.TestClass" },
          { id: "0x2", className: "TestSchema.TestClass" },
        ];
        const expectedLabels = instanceKeys.map(buildLabel);

        setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
        getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

        const { getByText, getByRole, user, unmount } = render(<MultiElementPropertyGrid {...getProps()} />);

        await waitFor(() => getByText("MultiInstances"));
        const listButton = getByRole("button", { name: "element-list.title" });

        // navigate to element list
        await user.click(listButton);
        await waitFor(() => getByText(expectedLabels[1]));

        act(() => triggerSelectionChange({ source: "TestSource" }));
        await waitFor(() => getByText("MultiInstances"));

        // Selection change causes multiple pieces of the component to asynchronously update and we only care about one piece of
        // that - showing the default view. Unmount the component to avoid testing library warning about state changes in non `act` environment.
        unmount();
      });

      it("renders buttons for ancestor navigation", async () => {
        const { AncestorsNavigationControls } = await import("../../property-grid-react/components/MultiElementPropertyGrid.js");

        const instanceKey = { id: "0x1", className: "TestSchema.TestClass" };
        setupMultiInstanceData([{ key: instanceKey, value: "Test-Value-1" }]);

        getParentInstanceKeyStub.mockReset();
        getParentInstanceKeyStub.mockResolvedValue({ id: "0x2", className: "TestSchema.ParentClass" });

        const { getByText, queryByRole } = render(
          <MultiElementPropertyGrid {...getProps()} ancestorsNavigationControls={(navigationProps) => <AncestorsNavigationControls {...navigationProps} />} />,
        );

        await waitFor(() => {
          getByText("Test-Value-1");
          expect(queryByRole("button", { name: "header.navigateUp" })).not.toBeNull();
          expect(queryByRole("button", { name: "header.navigateDown" })).not.toBeNull();
        });
      });

      describe("feature usage reporting", () => {
        let TelemetryContextProvider: typeof UseTelemetryContextModule.TelemetryContextProvider;

        beforeAll(async () => {
          TelemetryContextProvider = (await import("../../property-grid-react/hooks/UseTelemetryContext.js")).TelemetryContextProvider;
        });

        it("reports when properties for a single instance are shown", async () => {
          const onFeatureUsedSpy = vi.fn();
          setupMultiInstanceData([
            {
              key: { id: "0x1", className: "TestSchema.TestClass" },
              value: "Test-Value",
            },
          ]);

          const { getByText } = render(
            <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
              <MultiElementPropertyGrid {...getProps()} />
            </TelemetryContextProvider>,
          );

          await waitFor(() => getByText("Test-Value"));
          expect(onFeatureUsedSpy).toHaveBeenCalledWith("single-element");
          expect(onFeatureUsedSpy).not.toHaveBeenCalledWith("multiple-elements");
        });

        it("reports when properties of multiple instances are shown", async () => {
          const onFeatureUsedSpy = vi.fn();
          setupMultiInstanceData([
            {
              key: { id: "0x1", className: "TestSchema.TestClass" },
              value: "Test-Value-1",
            },
            {
              key: { id: "0x2", className: "TestSchema.TestClass" },
              value: "Test-Value-2",
            },
          ]);

          const { getByText } = render(
            <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
              <MultiElementPropertyGrid {...getProps()} />
            </TelemetryContextProvider>,
          );

          await waitFor(() => getByText("MultiInstances"));
          expect(onFeatureUsedSpy).toHaveBeenCalledWith("multiple-elements");
          expect(onFeatureUsedSpy).not.toHaveBeenCalledWith("single-element");
        });

        it("does not report when no properties are shown", async () => {
          const onFeatureUsedSpy = vi.fn();
          setupSelection([]);
          getDataStub.mockImplementation(async () => {
            return {
              categories: [{ expand: true, label: "Test Category", name: "test-category" }],
              label: PropertyRecord.fromString("Test Instance"),
              records: {},
            };
          });

          const { getByText } = render(
            <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
              <MultiElementPropertyGrid {...getProps()} />
            </TelemetryContextProvider>,
          );

          await waitFor(() => getByText("Test Instance"));
          expect(onFeatureUsedSpy).not.toHaveBeenCalledWith("single-element");
          expect(onFeatureUsedSpy).not.toHaveBeenCalledWith("multiple-elements");
        });

        it("reports when element list is shown", async () => {
          const onFeatureUsedSpy = vi.fn();
          const instanceKeys = [
            { id: "0x1", className: "TestSchema.TestClass" },
            { id: "0x2", className: "TestSchema.TestClass" },
          ];
          const expectedLabels = instanceKeys.map(buildLabel);

          setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
          getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

          const { getByText, getByRole, user } = render(
            <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
              <MultiElementPropertyGrid {...getProps()} />
            </TelemetryContextProvider>,
          );

          await waitFor(() => getByText("MultiInstances"));
          const button = getByRole("button", { name: "element-list.title" });

          await user.click(button);
          // verify element list is rendered
          for (const expected of expectedLabels) {
            await waitFor(() => getByText(expected));
          }
          expect(onFeatureUsedSpy).toHaveBeenCalledWith("elements-list");
        });

        it("reports when element selected from element list", async () => {
          const onFeatureUsedSpy = vi.fn();
          const instanceKeys = [
            { id: "0x1", className: "TestSchema.TestClass" },
            { id: "0x2", className: "TestSchema.TestClass" },
          ];
          const expectedLabels = instanceKeys.map(buildLabel);

          setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
          getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

          const { getByText, getByRole, user } = render(
            <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
              <MultiElementPropertyGrid {...getProps()} />
            </TelemetryContextProvider>,
          );

          await waitFor(() => getByText("MultiInstances"));
          const button = getByRole("button", { name: "element-list.title" });

          await user.click(button);
          const element = await waitFor(() => getByText(expectedLabels[1]));

          // setup data provider for single element property grid
          setupSingleElementData(expectedLabels[1], "Test-Value-2");

          await user.click(element);
          await waitFor(() => getByText("Test-Value-2"));
          expect(onFeatureUsedSpy).toHaveBeenCalledWith("single-element-from-list");
        });

        it("reports when navigates from single element to multi element grid using 'Back' button", async () => {
          const onFeatureUsedSpy = vi.fn();
          const instanceKeys = [
            { id: "0x1", className: "TestSchema.TestClass" },
            { id: "0x2", className: "TestSchema.TestClass" },
          ];
          const expectedLabels = instanceKeys.map(buildLabel);

          setupMultiInstanceData(instanceKeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
          getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));

          const { container, getByText, getByRole, user } = render(
            <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
              <MultiElementPropertyGrid {...getProps()} />
            </TelemetryContextProvider>,
          );

          await waitFor(() => getByText("MultiInstances"));
          const listButton = getByRole("button", { name: "element-list.title" });

          // navigate to element list
          await user.click(listButton);
          const element = await waitFor(() => getByText(expectedLabels[1]));

          // setup data provider for single element property grid
          setupSingleElementData(expectedLabels[1], "Test-Value-2");

          // navigate to specific element properties
          await user.click(element);
          await waitFor(() => getByText("Test-Value-2"));

          // navigate back to element list
          onFeatureUsedSpy.mockClear();
          const singleElementGrid = container.querySelector<HTMLButtonElement>(".property-grid-react-single-element-property-grid");
          expect(singleElementGrid).not.toBeNull();
          const singleElementBackButton = getByRoleRTL(singleElementGrid!, "button", { name: "header.back" });
          await user.click(singleElementBackButton);
          await waitFor(() => getByText(expectedLabels[0]));
          expect(onFeatureUsedSpy).toHaveBeenCalledWith("elements-list");

          // navigate back to multi instances properties grid
          onFeatureUsedSpy.mockClear();
          const elementList = container.querySelector<HTMLDivElement>(".property-grid-react-element-list");
          expect(elementList).not.toBeNull();
          const elementListBackButton = getByRoleRTL(elementList!, "button", { name: "header.back" });
          await user.click(elementListBackButton);
          await waitFor(() => getByText("MultiInstances"));
          expect(onFeatureUsedSpy).toHaveBeenCalledWith("multiple-elements");
        });
      });

      const buildLabel = (key: InstanceKey) => `${normalizeFullClassName(key.className)}-${key.id}`;

      interface InstanceData {
        key: InstanceKey;
        value: string;
      }
      const setupMultiInstanceData = (instances: InstanceData[]) => {
        setupSelection(instances.map((i) => i.key));

        const value = instances.length > 1 ? "MultiInstances" : instances[0].value;

        getDataStub.mockImplementation(async () => {
          return {
            categories: [{ expand: true, label: "Test Category", name: "test-category" }],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  { valueFormat: PropertyValueFormat.Primitive, value, displayValue: value },
                  { name: "test-prop", displayLabel: "Test Prop" },
                ),
              ],
            },
          };
        });
      };

      const setupSingleElementData = (label: string, value: string) => {
        getDataStub.mockReset();
        getDataStub.mockImplementation(async () => ({
          categories: [{ expand: true, label: "Test Category", name: "test-category" }],
          label: PropertyRecord.fromString(label),
          records: {
            ["test-category"]: [
              createPropertyRecord(
                { valueFormat: PropertyValueFormat.Primitive, value, displayValue: value },
                { name: "test-prop", displayLabel: "Test Prop" },
              ),
            ],
          },
        }));
      };
    });
  });
});
