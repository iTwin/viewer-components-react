/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyDataChangeEvent } from "@itwin/components-react";
import { KeySet } from "@itwin/presentation-common";
import { PropertyGridContent } from "../../property-grid-react/components/PropertyGridContent.js";
import { PropertyGridSettingsMenuItem, ShowHideNullValuesSettingsMenuItem } from "../../property-grid-react/components/SettingsDropdownMenu.js";
import { NullValueSettingContext } from "../../property-grid-react/hooks/UseNullValuesSetting.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { createPropertyRecord, render, stubSelectionManager, waitFor } from "../TestUtils.js";

import type { ReactElement } from "react";
import type { PrimitiveValue } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { PropertyGridContentProps } from "../../property-grid-react/components/PropertyGridContent.js";

describe("<PropertyGridContent />", () => {
  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
    stubSelectionManager();
  });

  const createProvider = () =>
    ({
      keys: new KeySet([{ className: "class", id: "id" }]),
      onDataChanged: new PropertyDataChangeEvent(),
      getData: async () => {
        return {
          categories: [
            {
              expand: true,
              label: "Test Category",
              name: "test-category",
            },
          ],
          label: PropertyRecord.fromString("Test Instance"),
          records: {
            ["test-category"]: [
              createPropertyRecord(
                { valueFormat: PropertyValueFormat.Primitive, value: "Prop Value", displayValue: "Prop Value" },
                { name: "test-prop", displayLabel: "Test Prop" },
              ),
              createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: undefined }, { name: "null-prop", displayLabel: "Null Prop" }),
            ],
          },
        };
      },
    }) as unknown as IPresentationPropertyDataProvider;

  function renderWithContext(ui: ReactElement) {
    return render(<NullValueSettingContext>{ui}</NullValueSettingContext>);
  }

  it("renders header with instance label", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();
    const { getByText, queryByText } = renderWithContext(<PropertyGridContent dataProvider={provider} imodel={imodel} />);

    await waitFor(() => getByText("Test Prop"));
    expect(queryByText("Test Instance")).not.toBeNull();
  });

  it("renders header with back button", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();
    const onBackClickSpy = vi.fn();

    const { getByText, getByRole, user } = renderWithContext(<PropertyGridContent dataProvider={provider} imodel={imodel} onBackButton={onBackClickSpy} />);

    await waitFor(() => getByText("Test Prop"));
    const backButton = getByRole("button", { name: "header.back" });
    await user.click(backButton);
    expect(onBackClickSpy).toHaveBeenCalledOnce();
  });

  it("renders header with settings dropdown", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();
    const spy = vi.fn();

    const { getByText, getByRole, user } = renderWithContext(
      <PropertyGridContent
        dataProvider={provider}
        imodel={imodel}
        settingsMenuItems={[
          () => (
            <PropertyGridSettingsMenuItem id="testSetting" onClick={spy}>
              Test Setting
            </PropertyGridSettingsMenuItem>
          ),
        ]}
      />,
    );

    const settingsButton = await waitFor(() => getByRole("button", { name: "settings.label" }));
    await user.click(settingsButton);

    const setting = await waitFor(() => getByText("Test Setting"));
    await user.click(setting);

    expect(spy).toHaveBeenCalledOnce();
  });

  it("renders with extended props action buttons", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();
    const stub = vi.fn().mockReturnValue(<div>Test action button</div>);

    const { getAllByText } = renderWithContext(<PropertyGridContent dataProvider={provider} imodel={imodel} actionButtonRenderers={[stub]} />);

    await waitFor(() => {
      expect(stub).toHaveBeenCalledWith(expect.objectContaining({ dataProvider: provider }));
      getAllByText("Test action button");
    });
  });

  it("allows filtering out empty values", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();

    const { getByText, getByRole, queryByText, user } = renderWithContext(
      <PropertyGridContent dataProvider={provider} imodel={imodel} settingsMenuItems={[(props) => <ShowHideNullValuesSettingsMenuItem {...props} />]} />,
    );

    await waitFor(() => {
      expect(queryByText("Test Prop")).not.toBeNull();
      expect(queryByText("Null Prop")).not.toBeNull();
    });

    const settingsButton = await waitFor(() => getByRole("button", { name: "settings.label" }));
    await user.click(settingsButton);

    const setting = await waitFor(() => getByText("settings.hide-null.label"));
    await user.click(setting);

    await waitFor(() => {
      expect(queryByText("Test Prop")).not.toBeNull();
      expect(queryByText("Null Prop")).toBeNull();
    });
  });

  it("filters properties according to search prompt", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();

    const { queryByText, user, getByRole, getByText } = renderWithContext(<PropertyGridContent dataProvider={provider} imodel={imodel} />);

    await waitFor(() => {
      expect(queryByText("Test Prop")).not.toBeNull();
      expect(queryByText("Null Prop")).not.toBeNull();
    });

    const searchButton = await waitFor(() => getByText(PropertyGridManager.translate("search-bar.open")));
    await user.click(searchButton);

    const searchTextInput = await waitFor(() => getByRole("searchbox"));
    // input text that should match
    await user.type(searchTextInput, "test prop");

    await waitFor(() => {
      expect(queryByText("Test Prop")).not.toBeNull();
      expect(queryByText("Null Prop")).toBeNull();
    });

    // input text that should not match
    await user.clear(searchTextInput);
    await user.type(searchTextInput, "null prop");
    await waitFor(() => {
      expect(queryByText("Test Prop")).toBeNull();
      expect(queryByText("Null Prop")).not.toBeNull();
    });
  });

  it("successfully clears filter", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();

    const { queryByText, user, getByRole, getByText } = renderWithContext(<PropertyGridContent dataProvider={provider} imodel={imodel} />);

    await waitFor(() => {
      expect(queryByText("Test Category")).not.toBeNull();
    });

    const searchButton = await waitFor(() => getByText(PropertyGridManager.translate("search-bar.open")));
    await user.click(searchButton);

    // input text that should not match anything, thus rendering nothing
    const searchTextInput = await waitFor(() => getByRole("searchbox"));
    await user.type(searchTextInput, "input text for test");

    await waitFor(() => {
      expect(queryByText("Test Category")).toBeNull();
    });

    // press collapse button which should clear the filter
    const collapseSearchButton = await waitFor(() => getByText(PropertyGridManager.translate("search-bar.close")));
    await user.click(collapseSearchButton);

    await waitFor(() => {
      expect(queryByText("Test Category")).not.toBeNull();
    });
  });

  it("allows editing property", async () => {
    const imodel = {} as IModelConnection;
    const provider = createProvider();
    const stub = vi.fn<Required<PropertyGridContentProps>["onPropertyUpdated"]>().mockResolvedValue(true);

    const { findByText, findByDisplayValue, user } = renderWithContext(
      <PropertyGridContent dataProvider={provider} imodel={imodel} isPropertyEditingEnabled={true} onPropertyUpdated={stub} />,
    );

    const propertyValue = await findByText("Prop Value");

    // enter editing mode
    await user.dblClick(propertyValue);

    const editor = await findByDisplayValue("Prop Value");
    // type ` Updated` and press enter to commit new value
    await user.type(editor, " Updated{Enter}");

    await waitFor(() => {
      expect(stub).toHaveBeenCalledOnce();
      const [{ dataProvider, newValue }] = stub.mock.calls[0];
      expect(dataProvider).toBe(provider);
      expect((newValue as PrimitiveValue).value).toBe("Prop Value Updated");
    });
  });

  describe("feature usage reporting", () => {
    it("reports when filters properties according to search prompt", async () => {
      const imodel = {} as IModelConnection;
      const provider = createProvider();
      const onFeatureUsedSpy = vi.fn();

      const { queryByText, user, getByRole, getByText } = renderWithContext(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <PropertyGridContent dataProvider={provider} imodel={imodel} />
        </TelemetryContextProvider>,
      );

      await waitFor(() => {
        expect(queryByText("Test Prop")).not.toBeNull();
        expect(queryByText("Null Prop")).not.toBeNull();
      });

      const searchButton = await waitFor(() => getByText(PropertyGridManager.translate("search-bar.open")));
      await user.click(searchButton);

      const searchTextInput = await waitFor(() => getByRole("searchbox"));
      // input text that should match
      await user.type(searchTextInput, "test prop");

      await waitFor(() => {
        expect(queryByText("Test Prop")).not.toBeNull();
        expect(queryByText("Null Prop")).toBeNull();
        expect(onFeatureUsedSpy).toHaveBeenCalledExactlyOnceWith("filter-properties");
      });
      onFeatureUsedSpy.mockClear();

      // clear input text
      await user.clear(searchTextInput);
      await waitFor(() => {
        expect(queryByText("Test Prop")).not.toBeNull();
        expect(queryByText("Null Prop")).not.toBeNull();
      });
      expect(onFeatureUsedSpy).not.toHaveBeenCalledWith("filter-properties");
    });

    it("reports once when filter keeps changing", async () => {
      const imodel = {} as IModelConnection;
      const provider = createProvider();
      const onFeatureUsedSpy = vi.fn();

      const { queryByText, user, getByRole, getByText } = renderWithContext(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <PropertyGridContent dataProvider={provider} imodel={imodel} />
        </TelemetryContextProvider>,
      );

      await waitFor(() => {
        expect(queryByText("Test Prop")).not.toBeNull();
        expect(queryByText("Null Prop")).not.toBeNull();
      });

      const searchButton = await waitFor(() => getByText(PropertyGridManager.translate("search-bar.open")));
      await user.click(searchButton);

      const searchTextInput = await waitFor(() => getByRole("searchbox"));
      // input text that should match
      await user.type(searchTextInput, "test ");
      await user.type(searchTextInput, "prop");

      await waitFor(() => {
        expect(queryByText("Test Prop")).not.toBeNull();
        expect(queryByText("Null Prop")).toBeNull();
      });

      expect(onFeatureUsedSpy).toHaveBeenCalledExactlyOnceWith("filter-properties");
    });
  });
});
