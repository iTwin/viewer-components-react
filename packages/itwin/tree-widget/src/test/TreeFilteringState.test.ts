/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { act, renderHook, waitFor } from "./TestUtils";
import { useTreeFilteringState } from "../components/TreeFilteringState";

import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

describe("useTreeFilteringState", () => {
  it("updates filterString when `onFilterStart` is called", async () => {
    const { result } = renderHook(useTreeFilteringState);
    await waitFor(() => expect(result.current.filterString).to.be.empty);

    act(() => {
      result.current.searchOptions.onFilterStart("test-string");
    });

    await waitFor(() => {
      expect(result.current.filterString).to.be.eq("test-string");
      expect(result.current.searchOptions.isFiltering).to.be.true;
    });
  });

  it("clears filterString when `onFilterCancel` is called", async () => {
    const { result } = renderHook(useTreeFilteringState);
    await waitFor(() => expect(result.current.filterString).to.be.empty);

    act(() => {
      result.current.searchOptions.onFilterStart("test-string");
    });

    await waitFor(() => {
      expect(result.current.filterString).to.be.eq("test-string");
      expect(result.current.searchOptions.isFiltering).to.be.true;
    });

    act(() => {
      result.current.searchOptions.onFilterCancel();
    });
    await waitFor(() => {
      expect(result.current.filterString).to.be.empty;
      expect(result.current.searchOptions.isFiltering).to.be.false;
    });
  });

  it("updates activeMatchIndex when `onResultSelectedChanged` is called", async () => {
    const { result } = renderHook(useTreeFilteringState);
    await waitFor(() => expect(result.current.searchOptions.activeMatchIndex).to.be.undefined);

    act(() => {
      result.current.searchOptions.onResultSelectedChanged(3);
    });
    await waitFor(() => expect(result.current.searchOptions.activeMatchIndex).to.be.eq(3));
  });

  it("updates matchesCount when `onFilterApplied` is called", async () => {
    const { result } = renderHook(useTreeFilteringState);
    await waitFor(() => expect(result.current.searchOptions.matchedResultCount).to.be.undefined);

    act(() => {
      result.current.onFilterApplied({} as IPresentationTreeDataProvider, 4);
    });
    await waitFor(() => {
      expect(result.current.searchOptions.matchedResultCount).to.be.eq(4);
      expect(result.current.searchOptions.activeMatchIndex).to.be.eq(1);
    });
  });

  it("persists activeMatchIndex when `onFilterApplied` is called again", async () => {
    const { result } = renderHook(useTreeFilteringState);
    await waitFor(() => expect(result.current.searchOptions.matchedResultCount).to.be.undefined);

    act(() => {
      result.current.onFilterApplied({} as IPresentationTreeDataProvider, 6);
    });
    await waitFor(() => {
      expect(result.current.searchOptions.matchedResultCount).to.be.eq(6);
      expect(result.current.searchOptions.activeMatchIndex).to.be.eq(1);
    });

    act(() => {
      result.current.searchOptions.onResultSelectedChanged(3);
    });
    await waitFor(() => expect(result.current.searchOptions.activeMatchIndex).to.be.eq(3));

    act(() => {
      result.current.onFilterApplied({} as IPresentationTreeDataProvider, 4);
    });
    await waitFor(() => {
      expect(result.current.searchOptions.matchedResultCount).to.be.eq(4);
      expect(result.current.searchOptions.activeMatchIndex).to.be.eq(3);
    });
  });
});
