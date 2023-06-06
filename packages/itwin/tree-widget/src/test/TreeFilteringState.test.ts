/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import { useTreeFilteringState } from "../components/TreeFilteringState";

import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

describe("useTreeFilteringState", () => {
  it("updates filterString when `onFilterStart` is called", () => {
    const { result } = renderHook(useTreeFilteringState);
    expect(result.current.filterString).to.be.empty;
    result.current.searchOptions.onFilterStart("test-string");

    expect(result.current.filterString).to.be.eq("test-string");
    expect(result.current.searchOptions.isFiltering).to.be.true;
  });

  it("clears filterString when `onFilterCancel` is called", () => {
    const { result } = renderHook(useTreeFilteringState);
    expect(result.current.filterString).to.be.empty;

    result.current.searchOptions.onFilterStart("test-string");
    expect(result.current.filterString).to.be.eq("test-string");
    expect(result.current.searchOptions.isFiltering).to.be.true;

    result.current.searchOptions.onFilterCancel();
    expect(result.current.filterString).to.be.empty;
    expect(result.current.searchOptions.isFiltering).to.be.false;
  });

  it("updates activeMatchIndex when `onResultSelectedChanged` is called", () => {
    const { result } = renderHook(useTreeFilteringState);
    expect(result.current.searchOptions.activeMatchIndex).to.be.undefined;

    result.current.searchOptions.onResultSelectedChanged(3);
    expect(result.current.searchOptions.activeMatchIndex).to.be.eq(3);
  });

  it("updates matchesCount when `onFilterApplied` is called", () => {
    const { result } = renderHook(useTreeFilteringState);
    expect(result.current.searchOptions.matchedResultCount).to.be.undefined;

    result.current.onFilterApplied({} as IPresentationTreeDataProvider, 4);
    expect(result.current.searchOptions.matchedResultCount).to.be.eq(4);
    expect(result.current.searchOptions.activeMatchIndex).to.be.eq(1);
  });

  it("persists activeMatchIndex when `onFilterApplied` is called again", () => {
    const { result } = renderHook(useTreeFilteringState);
    expect(result.current.searchOptions.matchedResultCount).to.be.undefined;

    result.current.onFilterApplied({} as IPresentationTreeDataProvider, 6);
    expect(result.current.searchOptions.matchedResultCount).to.be.eq(6);
    expect(result.current.searchOptions.activeMatchIndex).to.be.eq(1);

    result.current.searchOptions.onResultSelectedChanged(3);
    expect(result.current.searchOptions.activeMatchIndex).to.be.eq(3);

    result.current.onFilterApplied({} as IPresentationTreeDataProvider, 4);
    expect(result.current.searchOptions.matchedResultCount).to.be.eq(4);
    expect(result.current.searchOptions.activeMatchIndex).to.be.eq(3);
  });
});
