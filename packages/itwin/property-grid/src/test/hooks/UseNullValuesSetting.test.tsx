/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import userEvents from "@testing-library/user-event";
import { useNullValueSetting } from "../../hooks/UseNullValuesSetting";
import { PreferencesContextProvider } from "../../PropertyGridPreferencesContext";
import { createFunctionStub, render, waitFor } from "../TestUtils";

import type { ReactNode } from "react";
import type { PreferencesContextProviderProps } from "../../PropertyGridPreferencesContext";
import type { PreferencesStorage } from "../../property-grid-react";

function renderWithContext(element: ReactNode, contextProps: Partial<PreferencesContextProviderProps>) {
  return render(<PreferencesContextProvider {...contextProps}>{element}</PreferencesContextProvider>);
}

function TestComponent({ persistOnClick }: { persistOnClick?: boolean }) {
  const { showNullValues, setShowNullValues } = useNullValueSetting();

  const toggleShowNullValues = async () => {
    await setShowNullValues(!showNullValues, { persist: persistOnClick });
  };

  return <button onClick={toggleShowNullValues}>{showNullValues ? "Hide Null Values" : "Show Null Values"}</button>;
}

describe("useNullValuesSetting", () => {
  const storage = {
    get: createFunctionStub<PreferencesStorage["get"]>(),
    set: createFunctionStub<PreferencesStorage["set"]>(),
  };

  afterEach(() => {
    storage.get.reset();
    storage.set.reset();
  });

  it("defaults to `true`", async () => {
    const { getByRole } = renderWithContext(<TestComponent />, { storage });

    await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
  });

  it("updates value", async () => {
    const { getByRole } = renderWithContext(<TestComponent />, { storage });

    const button = await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
    await userEvents.click(button);

    await waitFor(() => getByRole("button", { name: "Show Null Values" }));
  });

  describe("with persistance", () => {
    it("loads persisted value", async () => {
      storage.get.resolves(JSON.stringify(false));

      const { getByRole } = renderWithContext(<TestComponent />, { storage });

      await waitFor(() => getByRole("button", { name: "Show Null Values" }));
    });

    it("defaults to `true` if there is no persisted value", async () => {
      storage.get.resolves(undefined);

      const { getByRole } = renderWithContext(<TestComponent />, { storage });

      await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
    });

    it("stores persisted value", async () => {
      storage.get.resolves(JSON.stringify(false));

      const { getByRole } = renderWithContext(<TestComponent persistOnClick={true} />, { storage });

      const button = await waitFor(() => getByRole("button", { name: "Show Null Values" }));
      await userEvents.click(button);

      await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
      expect(storage.set).to.be.calledWith("showNullValues", JSON.stringify(true));
    });
  });
});
