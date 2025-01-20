/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { EmptyLocalization } from "@itwin/core-common";
import { Button } from "@itwin/itwinui-react";
import { TreeHeader } from "../../components/tree-header/TreeHeader.js";
import { TreeWidget } from "../../TreeWidget.js";
import { render, stubCancelAnimationFrame, waitFor } from "../TestUtils.js";

import type { ComponentPropsWithoutRef } from "react";
import type { TreeFilteringProps } from "../../components/tree-header/TreeHeader.js";

describe("<TreeHeader />", () => {
  stubCancelAnimationFrame();

  const filteringProps: TreeFilteringProps = {
    onFilterClear: () => {},
    onFilterStart: () => {},
    onSelectedChanged: () => {},
  };

  const defaultProps: ComponentPropsWithoutRef<typeof TreeHeader> = {
    filteringProps,
  };

  before(async () => {
    await TreeWidget.initialize(new EmptyLocalization());
  });

  after(() => {
    TreeWidget.terminate();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("renders supplied buttons", async () => {
    const { queryByRole } = render(
      <TreeHeader {...defaultProps}>
        <Button>Button1</Button>
        <Button>Button2</Button>
      </TreeHeader>,
    );

    await waitFor(() => {
      expect(queryByRole("button", { name: "Button1" })).to.not.be.null;
      expect(queryByRole("button", { name: "Button2" })).to.not.be.null;
    });
  });

  it("handles buttons overflow when only dropdown button can be seen", async () => {
    sinon.stub(HTMLElement.prototype, "scrollWidth").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 32);

    const { queryByRole } = render(
      <TreeHeader {...defaultProps}>
        <Button>Button1</Button>
        <Button>Button2</Button>
      </TreeHeader>,
    );

    expect(queryByRole("button", { name: "Button1" })).to.be.null;
    expect(queryByRole("button", { name: "Button2" })).to.be.null;
  });

  it("handles buttons overflow when provided buttons and dropdown button can be seen", async () => {
    sinon.stub(HTMLElement.prototype, "scrollWidth").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);

    const { queryByRole } = render(
      <TreeHeader {...defaultProps}>
        <Button>Button1</Button>
        <Button>Button2</Button>
        <Button>Button3</Button>
      </TreeHeader>,
    );

    expect(queryByRole("button", { name: "Button1" })).to.not.be.null;
    expect(queryByRole("button", { name: "Button2" })).to.be.null;
    expect(queryByRole("button", { name: "Button3" })).to.be.null;
  });

  describe("search box", () => {
    it("renders search box", async () => {
      const { getByRole, user } = render(<TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, selectedIndex: 5, resultCount: 10 }} />);

      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      expect(openButton).to.not.be.null;
      await user.click(openButton);

      const closeButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.close") });
      const nextButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.next") });
      const previousButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.previous") });

      expect(closeButton).to.not.be.null;
      expect(nextButton).to.not.be.null;
      expect(previousButton).to.not.be.null;
    });

    it("opens and closes search box", async () => {
      const { getByRole, queryByRole, user } = render(<TreeHeader {...defaultProps} />);

      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      await waitFor(() => expect(queryByRole("button", { name: TreeWidget.translate("header.searchBox.close") })).to.not.be.null);

      const closeButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.close") });
      await user.click(closeButton);

      await waitFor(() => expect(queryByRole("button", { name: TreeWidget.translate("header.searchBox.close") })).to.be.null);
    });

    it("invokes 'onFilterStart' when text is entered", async () => {
      const spy = sinon.spy();
      const { getByRole, user } = render(<TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onFilterStart: spy }} />);
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const input = getByRole("searchbox");
      await user.type(input, "SearchString");
      await waitFor(() => expect(spy).to.be.calledOnceWithExactly("SearchString"));
    });

    it("invokes 'onFilterClear' when search box is cleared", async () => {
      const filterStartSpy = sinon.spy();
      const filterClearSpy = sinon.spy();
      const { getByRole, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onFilterStart: filterStartSpy, onFilterClear: filterClearSpy }} />,
      );
      filterClearSpy.resetHistory();

      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const input = getByRole("searchbox");
      await user.type(input, "SearchString");
      await waitFor(() => expect(filterStartSpy).to.be.calledWithExactly("SearchString"));

      await user.clear(input);
      await waitFor(() => expect(filterClearSpy).to.be.calledOnce);
    });

    it("invokes 'onFilterClear' when search box is closed", async () => {
      const filterStartSpy = sinon.spy();
      const filterClearSpy = sinon.spy();
      const { getByRole, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onFilterStart: filterStartSpy, onFilterClear: filterClearSpy }} />,
      );
      filterClearSpy.resetHistory();

      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const input = getByRole("searchbox");
      await user.type(input, "SearchString");
      await waitFor(() => expect(filterStartSpy).to.be.calledWithExactly("SearchString"));

      await user.click(getByRole("button", { name: TreeWidget.translate("header.searchBox.close") }));
      await waitFor(() => expect(filterClearSpy).to.be.calledOnce);
    });

    it("renders matches selector", async () => {
      const { getByRole, queryByText, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, resultCount: 10, selectedIndex: 5 }} />,
      );
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      await waitFor(() => expect(queryByText("5/10")).to.not.be.null);
    });

    it("defaults to first match if `selectedIndex` is `undefined`", async () => {
      const { getByRole, queryByText, user } = render(<TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, resultCount: 10 }} />);
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      await waitFor(() => expect(queryByText("1/10")).to.not.be.null);
    });
    it("invokes `onSelectedChanged` when 'Next' button is clicked", async () => {
      const spy = sinon.spy();
      const { getByRole, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onSelectedChanged: spy, resultCount: 10, selectedIndex: 5 }} />,
      );
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("header.searchBox.next") }));
      await user.click(button);
      expect(spy).to.be.calledOnceWithExactly(6);
    });

    it("does not invoke `onSelectedChanged` when 'Next' button is clicked on last index", async () => {
      const spy = sinon.spy();
      const { getByRole, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onSelectedChanged: spy, resultCount: 10, selectedIndex: 10 }} />,
      );
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("header.searchBox.next") }));
      await user.click(button);
      expect(spy).to.not.be.called;
    });

    it("invokes `onSelectedChanged` when 'Previous' button is clicked", async () => {
      const spy = sinon.spy();
      const { getByRole, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onSelectedChanged: spy, resultCount: 10, selectedIndex: 5 }} />,
      );
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("header.searchBox.previous") }));
      await user.click(button);
      expect(spy).to.be.calledOnceWithExactly(4);
    });

    it("does not invoke `onSelectedChanged` when 'Previous' button is clicked on first index", async () => {
      const spy = sinon.spy();
      const { getByRole, user } = render(
        <TreeHeader {...defaultProps} filteringProps={{ ...filteringProps, onSelectedChanged: spy, resultCount: 10, selectedIndex: 1 }} />,
      );
      const openButton = getByRole("button", { name: TreeWidget.translate("header.searchBox.open") });
      await user.click(openButton);

      const button = await waitFor(() => getByRole("button", { name: TreeWidget.translate("header.searchBox.previous") }));
      await user.click(button);
      expect(spy).to.not.be.called;
    });
  });
});
