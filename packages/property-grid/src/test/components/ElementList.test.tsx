/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstanceLabelsProvider } from "../../property-grid-react/common/InstanceLabelsProvider.js";
import { ElementList } from "../../property-grid-react/components/ElementList.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { act, createResolvablePromise, fireEvent, render, waitFor } from "../TestUtils.js";

import type { PropsWithChildren } from "react";
import type { MockInstance } from "vitest";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { LabelsPage } from "../../property-grid-react/common/InstanceLabelsProvider.js";
import type { PerformanceTrackedFeatures } from "../../property-grid-react/hooks/UseTelemetryContext.js";

describe("<ElementList />", () => {
  const imodel = {} as IModelConnection;
  const buildLabel = (key: InstanceKey) => `${key.className}-${key.id}`;
  const buildPage = async (keys: InstanceKey[], page: { offset: number; limit: number }) => {
    const sorted = keys
      .map((instanceKey) => ({ instanceKey, label: buildLabel(instanceKey) }))
      .sort((first, second) => first.label.localeCompare(second.label));
    return { items: sorted.slice(page.offset, page.offset + page.limit), hasMore: sorted.length > page.offset + page.limit };
  };

  let getLabelsStub: MockInstance<InstanceLabelsProvider["getLabelsPage"]>;

  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
    getLabelsStub = vi.spyOn(InstanceLabelsProvider.prototype, "getLabelsPage");
    getLabelsStub.mockImplementation(buildPage);
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

    expect(getLabelsStub).toHaveBeenCalledWith(instanceKeys, { offset: 0, limit: 100 });
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

  it("does not overwrite current labels with an outdated load", async () => {
    const firstRequest = createResolvablePromise<LabelsPage>();
    getLabelsStub.mockImplementation(async () => firstRequest.promise);
    const firstInstanceKeys = [{ id: "0x1", className: "Schema:Class" }];
    const { rerender, queryByText, getByText } = render(<ElementList imodel={imodel} instanceKeys={firstInstanceKeys} onBack={() => {}} onSelect={() => {}} />);
    await waitFor(() => expect(getLabelsStub).toHaveBeenCalled());

    // start a newer load before the first one resolves
    const secondRequest = createResolvablePromise<LabelsPage>();
    getLabelsStub.mockImplementation(async () => secondRequest.promise);
    const secondInstanceKeys = [{ id: "0x2", className: "Schema:Class" }];
    rerender(<ElementList imodel={imodel} instanceKeys={secondInstanceKeys} onBack={() => {}} onSelect={() => {}} />);

    // resolve the newer load first and make sure it is rendered
    await act(async () => {
      await secondRequest.resolve({ items: [{ instanceKey: secondInstanceKeys[0], label: "Current-label" }], hasMore: false });
    });
    getByText("Current-label");

    // resolving the outdated load must not overwrite the current labels
    await act(async () => {
      await firstRequest.resolve({ items: [{ instanceKey: firstInstanceKeys[0], label: "Outdated-label" }], hasMore: false });
    });
    expect(queryByText("Outdated-label")).toBeNull();
    getByText("Current-label");
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

  describe("paging", () => {
    const instanceKeys = Array.from({ length: 105 }, (_, index) => ({ id: `0x${String(index + 1).padStart(3, "0")}`, className: "TestClass" }));

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
        return this.getAttribute("role") === "listitem" ? 29 : 600;
      });
    });

    it("loads only the first 100 rows until Load More is clicked, then appends the next page once", async () => {
      const next = createResolvablePromise<LabelsPage>();
      getLabelsStub.mockImplementation(async (keys, page) => (page.offset === 100 ? next.promise : buildPage(keys, page)));
      const { getByRole, findByText, queryByText, user } = render(
        <ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />,
        {
          disableStrictMode: true,
        },
      );
      await findByText(buildLabel(instanceKeys[0]));
      const initialRequests = getLabelsStub.mock.calls.length;
      expect(getLabelsStub.mock.calls.every(([, page]) => page.offset === 0)).toBe(true);
      expect(getLabelsStub).toHaveBeenLastCalledWith(instanceKeys, { offset: 0, limit: 100 });

      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await findByText("element-list.load-more");
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests);
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2900 } });
      const loadMore = await findByText("element-list.load-more");
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests);
      await user.click(loadMore);
      await waitFor(() => expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1));
      expect(getLabelsStub).toHaveBeenLastCalledWith(instanceKeys, { offset: 100, limit: 100 });
      await user.click(await findByText("element-list.loading"));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2901 } });
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1);

      await act(async () => next.resolve(await buildPage(instanceKeys, { offset: 100, limit: 100 })));
      await findByText(buildLabel(instanceKeys[104]));
      expect(queryByText("element-list.load-more")).toBeNull();
      expect(queryByText("element-list.loading")).toBeNull();
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1);
    });

    it("resets paging and scrolling on selection changes and ignores an outdated next page", async () => {
      const next = createResolvablePromise<LabelsPage>();
      getLabelsStub.mockImplementation(async (keys, page) => (page.offset === 100 ? next.promise : buildPage(keys, page)));
      const { getByRole, findByText, queryByText, rerender, user } = render(
        <ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />,
        { disableStrictMode: true },
      );
      await findByText(buildLabel(instanceKeys[0]));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2900 } });
      await user.click(await findByText("element-list.load-more"));
      await waitFor(() => expect(getLabelsStub).toHaveBeenCalledWith(instanceKeys, { offset: 100, limit: 100 }));

      const selection = [{ className: "NewSelection", id: "0x1" }];
      rerender(<ElementList imodel={imodel} instanceKeys={selection} onBack={() => {}} onSelect={() => {}} />);
      await findByText(buildLabel(selection[0]));
      expect(getByRole("list").scrollTop).toBe(0);
      expect(getLabelsStub).toHaveBeenLastCalledWith(selection, { offset: 0, limit: 100 });
      await act(async () => next.resolve(await buildPage(instanceKeys, { offset: 100, limit: 100 })));
      expect(queryByText(buildLabel(instanceKeys[104]))).toBeNull();
      await findByText(buildLabel(selection[0]));
    });

    it("keeps existing rows and retries a failed next page without skipping its offset", async () => {
      let failed = false;
      getLabelsStub.mockImplementation(async (keys, page) => {
        if (page.offset === 100 && !failed) {
          failed = true;
          throw new Error("Failed to load page");
        }
        return buildPage(keys, page);
      });
      const { getByRole, findByText, user } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await findByText(buildLabel(instanceKeys[0]));
      const initialRequests = getLabelsStub.mock.calls.length;
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2900 } });
      await user.click(await findByText("element-list.load-more"));
      const retry = await findByText("retry");
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1);
      await findByText(buildLabel(instanceKeys[99]));
      await user.click(retry);
      await findByText(buildLabel(instanceKeys[104]));
      expect(getLabelsStub).toHaveBeenLastCalledWith(instanceKeys, { offset: 100, limit: 100 });
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 2);
    });
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
      const firstRequest = createResolvablePromise<LabelsPage>();
      getLabelsStub.mockImplementation(async () => firstRequest.promise);
      const instanceKeys = [{ id: "0x1", className: "Schema:Class" }];
      const { rerender } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(getLabelsStub).toHaveBeenCalled();
        expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();
      });
      getLabelsStub.mockReset();

      const secondRequest = createResolvablePromise<LabelsPage>();
      getLabelsStub.mockImplementation(async () => secondRequest.promise);
      const secondInstanceKeys = [{ id: "0x2", className: "Schema:Class" }];
      rerender(<ElementList imodel={imodel} instanceKeys={secondInstanceKeys} onBack={() => {}} onSelect={() => {}} />);
      await waitFor(() => {
        expect(getLabelsStub).toHaveBeenCalled();
        expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();
      });

      await act(async () => {
        await firstRequest.resolve({ items: [{ instanceKey: instanceKeys[0], label: "Test-instance-1" }], hasMore: false });
      });
      expect(onPerformanceMeasuredStub).not.toHaveBeenCalled();

      await act(async () => {
        await secondRequest.resolve({ items: [{ instanceKey: secondInstanceKeys[0], label: "Test-instance-2" }], hasMore: false });
      });
      expect(onPerformanceMeasuredStub).toHaveBeenCalledOnce();
      expect(onPerformanceMeasuredStub).toHaveBeenCalledWith("elements-list-load", expect.any(Number));
    });
  });
});
