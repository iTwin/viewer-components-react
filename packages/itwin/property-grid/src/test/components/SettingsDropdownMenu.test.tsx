/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDropdownMenu, ShowHideNullValuesSettingsMenuItem } from "../../property-grid-react/components/SettingsDropdownMenu.js";
import { NullValueSettingContext, SHOWNULL_KEY } from "../../property-grid-react/hooks/UseNullValuesSetting.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { PreferencesContextProvider } from "../../property-grid-react/PropertyGridPreferencesContext.js";
import { createFunctionStub, render, waitFor } from "../TestUtils.js";

import type { ReactElement } from "react";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { PreferencesStorage } from "../../property-grid-react/api/PreferencesStorage.js";

describe("<SettingsDropdownMenu />", () => {
  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
  });

  it("renders nothing if no settings provided", async () => {
    const { container } = render(<SettingsDropdownMenu dataProvider={{} as IPresentationPropertyDataProvider} />);
    expect(container.children).toHaveLength(0);
  });

  it("renders provided settings", async () => {
    const spy = vi.fn();
    const { getByRole, queryByText, user } = render(
      <SettingsDropdownMenu
        dataProvider={{} as IPresentationPropertyDataProvider}
        settingsMenuItems={[
          ({ close }) => (
            <button
              onClick={() => {
                spy();
                close();
              }}
            >
              Test Setting
            </button>
          ),
        ]}
      />,
    );

    const dropdownButton = getByRole("button", { name: "settings.label" });
    await user.click(dropdownButton);

    await waitFor(() => expect(queryByText("Test Setting")).not.toBeNull());
  });

  it("closes settings menu", async () => {
    const spy = vi.fn();
    const { getByRole, getByText, queryByText, user } = render(
      <SettingsDropdownMenu
        dataProvider={{} as IPresentationPropertyDataProvider}
        settingsMenuItems={[
          ({ close }) => (
            <button
              onClick={() => {
                spy();
                close();
              }}
            >
              Test Setting
            </button>
          ),
        ]}
      />,
    );

    const dropdownButton = getByRole("button", { name: "settings.label" });
    await user.click(dropdownButton);

    const setting = await waitFor(() => getByText("Test Setting"));
    await user.click(setting);

    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    expect(queryByText("Test Setting")).toBeNull();
  });
});

describe("Default settings", () => {
  const storage = {
    get: createFunctionStub<PreferencesStorage["get"]>(),
    set: createFunctionStub<PreferencesStorage["set"]>(),
  };

  function renderWithContext(ui: ReactElement) {
    return render(
      <PreferencesContextProvider storage={storage}>
        <NullValueSettingContext>{ui}</NullValueSettingContext>
      </PreferencesContextProvider>,
    );
  }

  const settingProps = {
    close: vi.fn(),
    dataProvider: {} as IPresentationPropertyDataProvider,
  };

  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
    storage.get.mockReset();
    storage.set.mockReset();
    settingProps.close.mockReset();
  });

  describe("'Hide Empty Values' setting", () => {
    beforeEach(() => {
      storage.get.mockResolvedValue(JSON.stringify(true));
    });

    it("renders", async () => {
      const { queryByText } = renderWithContext(<ShowHideNullValuesSettingsMenuItem {...settingProps} />);
      await waitFor(() => expect(queryByText("settings.hide-null.label")).not.toBeNull());
    });

    it("does not persist new value by default", async () => {
      const { getByText, queryByText, user } = renderWithContext(<ShowHideNullValuesSettingsMenuItem {...settingProps} />);
      const item = await waitFor(() => getByText("settings.hide-null.label"));
      await user.click(item);

      // wait until empty values are hidden
      await waitFor(() => expect(queryByText("settings.show-null.label")).not.toBeNull());
      expect(storage.set).not.toHaveBeenCalled();
    });

    it("persist new value", async () => {
      const { getByText, queryByText, user } = renderWithContext(<ShowHideNullValuesSettingsMenuItem {...settingProps} persist={true} />);
      const item = await waitFor(() => getByText("settings.hide-null.label"));
      await user.click(item);

      // wait until empty values are hidden
      await waitFor(() => expect(queryByText("settings.show-null.label")).not.toBeNull());
      expect(storage.set).toHaveBeenCalledExactlyOnceWith(SHOWNULL_KEY, JSON.stringify(false));
    });
  });

  describe("'Show Empty Values' setting", () => {
    beforeEach(() => {
      storage.get.mockResolvedValue(JSON.stringify(false));
    });

    it("renders", async () => {
      const { queryByText } = renderWithContext(<ShowHideNullValuesSettingsMenuItem {...settingProps} />);
      await waitFor(() => expect(queryByText("settings.show-null.label")).not.toBeNull());
    });

    it("does not persist new value by default", async () => {
      const { getByText, queryByText, user } = renderWithContext(<ShowHideNullValuesSettingsMenuItem {...settingProps} />);
      const item = await waitFor(() => getByText("settings.show-null.label"));
      await user.click(item);

      // wait until empty values are shown
      await waitFor(() => expect(queryByText("settings.hide-null.label")).not.toBeNull());
      expect(storage.set).not.toHaveBeenCalled();
    });

    it("persist new value", async () => {
      const { getByText, queryByText, user } = renderWithContext(<ShowHideNullValuesSettingsMenuItem {...settingProps} persist={true} />);
      const item = await waitFor(() => getByText("settings.show-null.label"));
      await user.click(item);

      // wait until empty values are shown
      await waitFor(() => expect(queryByText("settings.hide-null.label")).not.toBeNull());
      expect(storage.set).toHaveBeenCalledExactlyOnceWith(SHOWNULL_KEY, JSON.stringify(true));
    });
  });
});
