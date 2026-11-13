/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeFullClassName } from "@itwin/presentation-shared";
import { ElementList } from "../../property-grid-react/components/ElementList.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { act, createResolvablePromise, fireEvent, render, waitFor } from "../TestUtils.js";
import { stubInstanceLabelQueries } from "./StubInstanceLabelQueries.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type * as interop from "@itwin/presentation-core-interop";
import type * as shared from "@itwin/presentation-shared";
import type { LabeledInstanceKey } from "./StubInstanceLabelQueries.js";

vi.mock("@itwin/presentation-core-interop", async (importOriginal) => {
  const actual = await importOriginal<typeof interop>();
  return { ...actual, createECSqlQueryExecutor: vi.fn(actual.createECSqlQueryExecutor) };
});
vi.mock("@itwin/presentation-shared", async (importOriginal) => {
  const actual = await importOriginal<typeof shared>();
  return { ...actual, createBisInstanceLabelSelectClauseFactory: vi.fn(actual.createBisInstanceLabelSelectClauseFactory) };
});

describe("<ElementList />", () => {
  const imodel = {} as IModelConnection;
  const buildLabel = (key: InstanceKey) => `${normalizeFullClassName(key.className)}-${key.id}`;
  const buildPage = async (keys: InstanceKey[], page: { offset: number; limit: number }) => {
    const sorted = keys
      .map((instanceKey) => ({ instanceKey, label: buildLabel(instanceKey) }))
      .sort((first, second) => first.label.localeCompare(second.label));
    return sorted.slice(page.offset, page.offset + page.limit);
  };

  let getLabelsStub: ReturnType<typeof vi.fn<(page: { offset: number; limit: number }) => Promise<LabeledInstanceKey[]>>>;
  let createQueryReader: ReturnType<typeof stubInstanceLabelQueries>;

  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
    getLabelsStub = vi.fn();
    createQueryReader = stubInstanceLabelQueries(getLabelsStub);
  });

  it("loads and renders instance labels", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestSchema.TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    getLabelsStub.mockResolvedValue(await buildPage(instanceKeys, { offset: 0, limit: 100 }));

    const { getByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    for (const expected of expectedLabels) {
      await waitFor(() => getByText(expected));
    }

    expect(getLabelsStub).toHaveBeenCalledWith({ offset: 0, limit: 100 });
  });

  it("loads and orders elements by labels", async () => {
    const instanceKeys = [
      { id: "0x0", className: "TestSchema.B_Second" },
      { id: "0x0", className: "TestSchema.A_First" },
      { id: "0x0", className: "TestSchema.C_Last" },
    ];

    const expectedLabels = instanceKeys.map(buildLabel).sort();
    getLabelsStub.mockResolvedValue(await buildPage(instanceKeys, { offset: 0, limit: 100 }));

    const { findAllByRole } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    const listItems = await findAllByRole("listitem");
    listItems.forEach((item, index) => {
      expect(item.textContent).toBe(expectedLabels[index]);
    });
  });

  it("does not overwrite current labels with an outdated load", async () => {
    const firstRequest = createResolvablePromise<LabeledInstanceKey[]>();
    getLabelsStub.mockImplementation(async () => firstRequest.promise);
    const firstInstanceKeys = [{ id: "0x1", className: "Schema:Class" }];
    const { rerender, queryByText, getByText } = render(<ElementList imodel={imodel} instanceKeys={firstInstanceKeys} onBack={() => {}} onSelect={() => {}} />);
    await waitFor(() => expect(getLabelsStub).toHaveBeenCalled());

    // start a newer load before the first one resolves
    const secondRequest = createResolvablePromise<LabeledInstanceKey[]>();
    getLabelsStub.mockImplementation(async () => secondRequest.promise);
    const secondInstanceKeys = [{ id: "0x2", className: "Schema:Class" }];
    rerender(<ElementList imodel={imodel} instanceKeys={secondInstanceKeys} onBack={() => {}} onSelect={() => {}} />);

    // resolve the newer load first and make sure it is rendered
    await act(async () => {
      await secondRequest.resolve([{ instanceKey: secondInstanceKeys[0], label: "Current-label" }]);
    });
    getByText("Current-label");

    // resolving the outdated load must not overwrite the current labels
    await act(async () => {
      await firstRequest.resolve([{ instanceKey: firstInstanceKeys[0], label: "Outdated-label" }]);
    });
    expect(queryByText("Outdated-label")).toBeNull();
    getByText("Current-label");
  });

  it("clears loaded rows when the selection becomes empty without querying", async () => {
    const instanceKeys = [{ id: "0x1", className: "Schema:Class" }];
    getLabelsStub.mockResolvedValue(await buildPage(instanceKeys, { offset: 0, limit: 100 }));
    const { findByText, rerender, queryAllByRole } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);
    await findByText(buildLabel(instanceKeys[0]));
    getLabelsStub.mockClear();

    rerender(<ElementList imodel={imodel} instanceKeys={[]} onBack={() => {}} onSelect={() => {}} />);

    await waitFor(() => expect(queryAllByRole("listitem")).toHaveLength(0));
    expect(getLabelsStub).not.toHaveBeenCalled();
  });

  it("invokes `onSelect` when item is clicked", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestSchema.TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    const onSelectSpy = vi.fn();
    getLabelsStub.mockResolvedValue(await buildPage(instanceKeys, { offset: 0, limit: 100 }));

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
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestSchema.TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    const onBackSpy = vi.fn();
    getLabelsStub.mockResolvedValue(await buildPage(instanceKeys, { offset: 0, limit: 100 }));

    const { getByText, getByRole, user } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={onBackSpy} onSelect={() => {}} />);

    // wait for element to be rendered
    await waitFor(() => getByText(expectedLabels[2]));
    const button = getByRole("button", { name: "header.back" });
    await user.click(button);

    expect(onBackSpy).toHaveBeenCalledOnce();
  });

  describe("paging", () => {
    const instanceKeys = Array.from({ length: 105 }, (_, index) => ({ id: `0x${String(index + 1).padStart(3, "0")}`, className: "TestSchema.TestClass" }));

    beforeEach(() => {
      getLabelsStub.mockImplementation(async (page) => buildPage(instanceKeys, page));
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
        return this.getAttribute("role") === "listitem" ? 29 : 600;
      });
    });

    it("appends skeletons for the next page when scrolled near the end of the loaded rows", async () => {
      const next = createResolvablePromise<LabeledInstanceKey[]>();
      getLabelsStub.mockImplementation(async (page) => (page.offset === 100 ? next.promise : buildPage(instanceKeys, page)));
      const { container, getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await findByText(buildLabel(instanceKeys[0]));
      const initialRequests = getLabelsStub.mock.calls.length;
      expect(getLabelsStub.mock.calls.every(([page]) => page.offset === 0)).toBe(true);
      expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 0, limit: 100 });
      // while idle, the list only contains the loaded rows
      expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);

      // scrolling that stays away from the end must not request the next page
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 1500 } });
      await findByText(buildLabel(instanceKeys[60]));
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests);

      // reaching the end of the loaded rows requests the next page and appends skeletons for it
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1));
      expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 100, limit: 100 });
      await waitFor(() => expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(5));

      await act(async () => next.resolve(await buildPage(instanceKeys, { offset: 100, limit: 100 })));
      await findByText(buildLabel(instanceKeys[104]));
      expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1);
    });

    it("shows skeletons while the first page loads", async () => {
      const first = createResolvablePromise<LabeledInstanceKey[]>();
      getLabelsStub.mockImplementation(async () => first.promise);
      const { container, findByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await waitFor(() => expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0));

      await act(async () => first.resolve(await buildPage(instanceKeys, { offset: 0, limit: 100 })));
      await findByText(buildLabel(instanceKeys[0]));
      expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);
    });

    it("loads following pages as the user keeps scrolling", async () => {
      const manyKeys = Array.from({ length: 250 }, (_, index) => ({ id: `0x${String(index + 1).padStart(3, "0")}`, className: "TestSchema.TestClass" }));
      getLabelsStub.mockImplementation(async (page) => buildPage(manyKeys, page));
      const { getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={manyKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await findByText(buildLabel(manyKeys[0]));

      // reaching the end of the first page loads the second one
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 100, limit: 100 }));
      await findByText(buildLabel(manyKeys[109]));

      // reaching the end of the second page loads the third one
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 5200 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 200, limit: 100 }));

      // once everything is loaded, scrolling to the bottom does not request anything else
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 6650 } });
      await findByText(buildLabel(manyKeys[249]));
      expect(getLabelsStub.mock.calls.map(([page]) => page.offset).filter((offset) => offset > 0)).toEqual([100, 200]);
    });

    it("does not request another page when the loaded count matches the selection count", async () => {
      const selection = instanceKeys.slice(0, 100);
      getLabelsStub.mockImplementation(async (page) => buildPage(selection, page));
      const { getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={selection} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await findByText(buildLabel(selection[0]));
      const initialRequests = getLabelsStub.mock.calls.length;
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await findByText(buildLabel(selection[99]));
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests);
      expect(getLabelsStub.mock.calls.every(([page]) => page.offset === 0)).toBe(true);
    });

    it("deduplicates equivalent class names before paging, but keeps keys from different classes", async () => {
      const keys = instanceKeys.slice(0, 99);
      const otherClass = { ...keys[0], className: "TestSchema.OtherClass" };
      const duplicate = { ...keys[0], className: "TestSchema:TestClass" };
      const selection = [...keys, otherClass, duplicate];
      getLabelsStub.mockImplementation(async (page) => buildPage([...keys, otherClass], page));
      const { getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={selection} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });

      await findByText(buildLabel(duplicate));
      expect(createQueryReader.mock.calls[0][0].bindings).toEqual([
        { type: "idset", value: keys.map((key) => key.id) },
        { type: "idset", value: [otherClass.id] },
        { type: "long", value: 100 },
        { type: "long", value: 0 },
      ]);

      const initialRequests = getLabelsStub.mock.calls.length;
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await findByText(buildLabel(keys[98]));
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests);
      expect(getLabelsStub.mock.calls.every(([page]) => page.offset === 0)).toBe(true);
    });

    it.each([0, 5, 100])("stops paging when only %i of the selected keys have results", async (resultCount) => {
      getLabelsStub.mockImplementation(async (page) => buildPage(instanceKeys.slice(0, resultCount), page));
      const { container, getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      if (resultCount > 0) {
        await findByText(buildLabel(instanceKeys[0]));
      }
      if (resultCount === 100) {
        fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
        await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 100, limit: 100 }));
      }
      await waitFor(() => expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2301 } });
      expect(getLabelsStub.mock.calls.map(([page]) => page.offset).filter((offset) => offset > 0)).toEqual(resultCount === 100 ? [100] : []);
    });

    it("waits for the current page before requesting the next one", async () => {
      const manyKeys = Array.from({ length: 250 }, (_, index) => ({ id: `0x${String(index + 1).padStart(3, "0")}`, className: "TestSchema.TestClass" }));
      const second = createResolvablePromise<LabeledInstanceKey[]>();
      const third = createResolvablePromise<LabeledInstanceKey[]>();
      getLabelsStub.mockImplementation(async (page) =>
        page.offset === 100 ? second.promise : page.offset === 200 ? third.promise : buildPage(manyKeys, page),
      );
      const { container, getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={manyKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await findByText(buildLabel(manyKeys[0]));
      const initialRequests = getLabelsStub.mock.calls.length;

      // request the second page and, while it is still loading, scroll past its placeholders - no new request is made
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 100, limit: 100 }));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 5200 } });
      await waitFor(() => expect(container.querySelector('[data-index="199"][aria-busy="true"]')).not.toBeNull());
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 1);

      // once the second page settles and the user is still at the end, the third page is requested automatically
      await act(async () => second.resolve(await buildPage(manyKeys, { offset: 100, limit: 100 })));
      await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 200, limit: 100 }));
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 2);
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 6650 } });
      await waitFor(() => expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0));
      expect(getLabelsStub).toHaveBeenCalledTimes(initialRequests + 2);

      await act(async () => third.resolve(await buildPage(manyKeys, { offset: 200, limit: 100 })));
      await findByText(buildLabel(manyKeys[249]));
      expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);
    });

    it("does not load another page if the user scrolls away from the end while loading", async () => {
      const manyKeys = Array.from({ length: 250 }, (_, index) => ({ id: `0x${String(index + 1).padStart(3, "0")}`, className: "TestSchema.TestClass" }));
      const second = createResolvablePromise<LabeledInstanceKey[]>();
      getLabelsStub.mockImplementation(async (page) => (page.offset === 100 ? second.promise : buildPage(manyKeys, page)));
      const { container, getByRole, findByText } = render(<ElementList imodel={imodel} instanceKeys={manyKeys} onBack={() => {}} onSelect={() => {}} />, {
        disableStrictMode: true,
      });
      await findByText(buildLabel(manyKeys[0]));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 100, limit: 100 }));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 5200 } });
      await waitFor(() => expect(container.querySelector('[data-index="199"][aria-busy="true"]')).not.toBeNull());
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 0 } });
      await findByText(buildLabel(manyKeys[0]));

      await act(async () => second.resolve(await buildPage(manyKeys, { offset: 100, limit: 100 })));
      expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 100, limit: 100 });

      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 5200 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 200, limit: 100 }));
      await findByText(buildLabel(manyKeys[209]));
    });

    it("resets paging and scrolling on selection changes and ignores an outdated next page", async () => {
      const next = createResolvablePromise<LabeledInstanceKey[]>();
      getLabelsStub.mockImplementation(async (page) => (page.offset === 100 ? next.promise : buildPage(instanceKeys, page)));
      const { getByRole, findByText, queryByText, rerender } = render(
        <ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />,
        { disableStrictMode: true },
      );
      await findByText(buildLabel(instanceKeys[0]));
      fireEvent.scroll(getByRole("list"), { target: { scrollTop: 2300 } });
      await waitFor(() => expect(getLabelsStub).toHaveBeenCalledWith({ offset: 100, limit: 100 }));

      const selection = [{ className: "TestSchema.NewSelection", id: "0x1" }];
      getLabelsStub.mockImplementation(async (page) => buildPage(selection, page));
      rerender(<ElementList imodel={imodel} instanceKeys={selection} onBack={() => {}} onSelect={() => {}} />);
      await findByText(buildLabel(selection[0]));
      expect(getByRole("list").scrollTop).toBe(0);
      expect(getLabelsStub).toHaveBeenLastCalledWith({ offset: 0, limit: 100 });
      await act(async () => next.resolve(await buildPage(instanceKeys, { offset: 100, limit: 100 })));
      expect(queryByText(buildLabel(instanceKeys[104]))).toBeNull();
      await findByText(buildLabel(selection[0]));
    });
  });
});
