/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { useNullValueSetting } from "../../property-grid-react/hooks/UseNullValuesSetting.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { PreferencesContextProvider } from "../../property-grid-react/PropertyGridPreferencesContext.js";
import { createFunctionStub, render, waitFor } from "../TestUtils.js";

import type { ReactNode } from "react";
import type { PreferencesContextProviderProps } from "../../property-grid-react/PropertyGridPreferencesContext.js";
import type { PreferencesStorage } from "../../property-grid-react/api/PreferencesStorage.js";

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
    const { getByRole, user } = renderWithContext(<TestComponent />, { storage });

    const button = await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
    await user.click(button);

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

      const { getByRole, user } = renderWithContext(<TestComponent persistOnClick={true} />, { storage });

      const button = await waitFor(() => getByRole("button", { name: "Show Null Values" }));
      await user.click(button);

      await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
      expect(storage.set).to.be.calledWith("showNullValues", JSON.stringify(true));
    });
  });

  describe("feature usage reporting", () => {
    it("reports initial value", async () => {
      const onFeatureUsedSpy = sinon.spy();
      storage.get.resolves(JSON.stringify(false));

      const { getByRole } = renderWithContext(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <TestComponent />
        </TelemetryContextProvider>,
        { storage },
      );

      await waitFor(() => getByRole("button", { name: "Show Null Values" }));
      expect(onFeatureUsedSpy).to.be.calledWith("hide-empty-values-enabled");
    });
  });

  it("reports when updates value", async () => {
    const onFeatureUsedSpy = sinon.spy();
    const { getByRole, user } = renderWithContext(
      <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
        <TestComponent />
      </TelemetryContextProvider>,
      { storage },
    );

    const hideButton = await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
    await user.click(hideButton);

    await waitFor(() => getByRole("button", { name: "Show Null Values" }));
    expect(onFeatureUsedSpy).to.be.calledWith("hide-empty-values-enabled");

    const showButton = await waitFor(() => getByRole("button", { name: "Show Null Values" }));
    await user.click(showButton);

    await waitFor(() => getByRole("button", { name: "Hide Null Values" }));
    expect(onFeatureUsedSpy).to.be.calledWith("hide-empty-values-disabled");
  });
});
