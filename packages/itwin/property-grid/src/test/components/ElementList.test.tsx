/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import { ElementList } from "../../property-grid-react/components/ElementList.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { act, createResolvablePromise, render, waitFor } from "../TestUtils.js";

import type { PropsWithChildren } from "react";
import type { MockInstance } from "vitest";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { PerformanceTrackedFeatures } from "../../property-grid-react/hooks/UseTelemetryContext.js";

describe("<ElementList />", () => {
  const imodel = {} as IModelConnection;
  const buildLabel = (key: InstanceKey) => `${key.className}-${key.id}`;

  let getLabelsStub: MockInstance<PresentationLabelsProvider["getLabels"]>;

  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
    getLabelsStub = vi.spyOn(PresentationLabelsProvider.prototype, "getLabels");
    getLabelsStub.mockImplementation(async (keys) => keys.map(buildLabel));
  });

  it("loads and renders instance labels", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);

    const { getByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    for (const expected of expectedLabels) {
      await waitFor(() => getByText(expected));
    }

    expect(getLabelsStub).toHaveBeenCalledWith(instanceKeys);
  });

  it("loads and orders elements by labels", async () => {
    const instanceKeys = [
      { id: "0x0", className: "B_Second" },
      { id: "0x0", className: "A_First" },
      { id: "0x0", className: "C_Last" },
    ];

    const expectedLabels = instanceKeys.map(buildLabel).sort();

    const { findAllByRole } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    const listItems = await findAllByRole("listitem");
    listItems.forEach((item, index) => {
      expect(item.textContent).toBe(expectedLabels[index]);
    });
  });

  it("loads instance labels in chunks", async () => {
    const instanceKeys = Array(1500)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);

    const { getByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    // wait for first element to be rendered
    await waitFor(() => getByText(expectedLabels[0]));
    expect(getLabelsStub).toHaveBeenCalledWith(instanceKeys.slice(0, 1000));
    expect(getLabelsStub).toHaveBeenCalledWith(instanceKeys.slice(1000));
  });

  it("invokes `onSelect` when item is clicked", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    const onSelectSpy = vi.fn();

    const { getByText, user } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={onSelectSpy} />);

    // wait for element to be rendered
    const item = await waitFor(() => getByText(expectedLabels[2]));
    await user.click(item);

    expect(onSelectSpy).toHaveBeenCalledOnce();
    expect(onSelectSpy).toHaveBeenCalledWith(instanceKeys[2]);
  });

  it("invokes `onBack` when 'Back' button is clicked", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    const onBackSpy = vi.fn();

    const { getByText, getByRole, user } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={onBackSpy} onSelect={() => {}} />);

    // wait for element to be rendered
    await waitFor(() => getByText(expectedLabels[2]));
    const button = getByRole("button", { name: "header.back" });
    await user.click(button);

    expect(onBackSpy).toHaveBeenCalledOnce();
  });

  describe("performance tracking", () => {
    const onPerformanceMeasuredStub = vi.fn<(feature: PerformanceTrackedFeatures, duration: number) => void>();

    function Wrapper({ children }: PropsWithChildren<object>) {
      return <TelemetryContextProvider onPerformanceMeasured={onPerformanceMeasuredStub}>{children}</TelemetryContextProvider>;
    }

    beforeEach(() => {
      onPerformanceMeasuredStub.mockReset();
    });

    it("logs performance metrics", async () => {
      const instanceKeys = [{ id: "0x1", className: "Schema:Class" }];
      render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(onPerformanceMeasuredStub).toHaveBeenCalledOnce();
        expect(onPerformanceMeasuredStub).toHaveBeenCalledWith("elements-list-load", expect.any(Number));
      });
    });

    it("logs metrics only for latest request", async () => {
      const firstRequest = createResolvablePromise<string[]>();
      getLabelsStub.mockImplementation(async () => firstRequest.promise);
      const instanceKeys = [{ id: "0x1", className: "Schema:Class" }];
      const { rerender } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(getLabelsStub).toHaveBeenCalled();
        expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();
      });
      getLabelsStub.mockReset();

      const secondRequest = createResolvablePromise<string[]>();
      getLabelsStub.mockImplementation(async () => secondRequest.promise);
      const secondInstanceKeys = [{ id: "0x2", className: "Schema:Class" }];
      rerender(<ElementList imodel={imodel} instanceKeys={secondInstanceKeys} onBack={() => {}} onSelect={() => {}} />);
      await waitFor(() => {
        expect(getLabelsStub).toHaveBeenCalled();
        expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();
      });

      await act(async () => {
        await firstRequest.resolve(["Test-instance-1"]);
      });
      expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();

      await act(async () => {
        await secondRequest.resolve(["Test-instance-2"]);
      });
      expect(onPerformanceMeasuredStub).toHaveBeenCalledOnce();
      expect(onPerformanceMeasuredStub).toHaveBeenCalledWith("elements-list-load", expect.any(Number));
    });
  });
});
