/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import sinon from "sinon";
import { EmptyLocalization } from "@itwin/core-common";
import { render, waitFor } from "@testing-library/react";
import userEvents from "@testing-library/user-event";
import { SearchBox, SearchBoxProps } from "../../components/tree-header/SearchBox";
import { TreeWidget } from "../../TreeWidget";

describe("<SearchBox />", () => {
  const defaultProps: SearchBoxProps = {
    searchOpen: true,
    onFilterClear: () => {},
    onFilterStart: () => {},
    onSearchClose: () => {},
    onSearchOpen: () => {},
    onSelectedChanged: () => {},
  };

  before(async () => {
    await TreeWidget.initialize(new EmptyLocalization());
  });

  after(() => {
    TreeWidget.terminate();
  });

  it("invokes 'onSearchOpen' when button is clicked while searchbox is closed", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox {...defaultProps} searchOpen={false} onSearchOpen={spy} />);
    const button = getByRole("button", { name: TreeWidget.translate("searchBox.open") });
    await userEvents.click(button);
    expect(spy).to.be.calledOnce;
  });

  it("invokes 'onSearchClose' when button is clicked while searchbox is closed", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox {...defaultProps} searchOpen={true} onSearchClose={spy} />);
    const button = getByRole("button", { name: TreeWidget.translate("searchBox.close") });
    await userEvents.click(button);
    expect(spy).to.be.calledOnce;
  });

  it("invokes 'onFilterStart' when text is entered", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox {...defaultProps} searchOpen={true} onFilterStart={spy} valueChangedDelay={100} />);
    const input = getByRole("searchbox");
    await userEvents.type(input, "SearchString");
    await waitFor(() => expect(spy).to.be.calledOnceWithExactly("SearchString"));
  });

  it("invokes 'onFilterClear' when search box is cleared", async () => {
    const filterStartSpy = sinon.spy();
    const filterClearSpy = sinon.spy();
    const { getByRole } = render(<SearchBox {...defaultProps} searchOpen={true} onFilterStart={filterStartSpy} onFilterClear={filterClearSpy} valueChangedDelay={100} />);
    filterClearSpy.resetHistory();

    const input = getByRole("searchbox");
    await userEvents.type(input, "SearchString");
    await waitFor(() => expect(filterStartSpy).to.be.calledOnceWithExactly("SearchString"));

    await userEvents.clear(input);
    await waitFor(() => expect(filterClearSpy).to.be.calledOnce);
  });

  it("invokes 'onFilterClear' when search box is closed", async () => {
    const filterStartSpy = sinon.spy();
    const filterClearSpy = sinon.spy();
    const { getByRole } = render(<SearchBox {...defaultProps} searchOpen={true} onFilterStart={filterStartSpy} onFilterClear={filterClearSpy} valueChangedDelay={100} />);
    filterClearSpy.resetHistory();

    const input = getByRole("searchbox");
    await userEvents.type(input, "SearchString");
    await waitFor(() => expect(filterStartSpy).to.be.calledOnceWithExactly("SearchString"));

    await userEvents.click(getByRole("button", { name: TreeWidget.translate("searchBox.close") }));
    await waitFor(() => expect(filterClearSpy).to.be.calledOnce);
  });

  it("renders matches selector", async () => {
    const { queryByText } = render(<SearchBox
      {...defaultProps}
      searchOpen={true}
      onFilterStart={() => {}}
      onFilterClear={() => {}}
      resultCount={10}
      selectedIndex={5}
    />);
    await waitFor(() => expect(queryByText("5/10")).to.not.be.null);
  });

  it("defaults to first match if `selectedIndex` is `undefined`", async () => {
    const { queryByText } = render(<SearchBox
      {...defaultProps}
      searchOpen={true}
      onFilterStart={() => {}}
      onFilterClear={() => {}}
      resultCount={10}
    />);
    await waitFor(() => expect(queryByText("1/10")).to.not.be.null);
  });

  it("invokes `onSelectedChanged` when 'Next' button is clicked", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox
      {...defaultProps}
      searchOpen={true}
      onFilterStart={() => {}}
      onFilterClear={() => {}}
      onSelectedChanged={spy}
      selectedIndex={5}
      resultCount={10}
    />);
    const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("searchBox.next") }));
    await userEvents.click(button);
    expect(spy).to.be.calledOnceWithExactly(6);
  });

  it("does not invoke `onSelectedChanged` when 'Next' button is clicked on last index", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox
      {...defaultProps}
      searchOpen={true}
      onFilterStart={() => {}}
      onFilterClear={() => {}}
      onSelectedChanged={spy}
      selectedIndex={10}
      resultCount={10}
    />);
    const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("searchBox.next") }));
    await userEvents.click(button);
    expect(spy).to.not.be.called;
  });

  it("invokes `onSelectedChanged` when 'Previous' button is clicked", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox
      {...defaultProps}
      searchOpen={true}
      onFilterStart={() => {}}
      onFilterClear={() => {}}
      onSelectedChanged={spy}
      selectedIndex={5}
      resultCount={10}
    />);
    const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("searchBox.previous") }));
    await userEvents.click(button);
    expect(spy).to.be.calledOnceWithExactly(4);
  });

  it("does not invoke `onSelectedChanged` when 'Previous' button is clicked on first index", async () => {
    const spy = sinon.spy();
    const { getByRole } = render(<SearchBox
      {...defaultProps}
      searchOpen={true}
      onFilterStart={() => {}}
      onFilterClear={() => {}}
      onSelectedChanged={spy}
      selectedIndex={1}
      resultCount={10}
    />);
    const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("searchBox.previous") }));
    await userEvents.click(button);
    expect(spy).to.not.be.called;
  });
});
