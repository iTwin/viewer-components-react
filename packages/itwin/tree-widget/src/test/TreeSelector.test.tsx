/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { fireEvent, render } from "@testing-library/react";
import { TreeSelector } from "../components/TreeSelector";

before(async () => {
  window.HTMLElement.prototype.scrollIntoView = function () {};
});

describe("<TreeSelector />", () => {
  it("lists all given content components in select box", async () => {
    const { getByText, queryAllByText, getByRole } = render(
      <TreeSelector defaultSelectedContentId={""} trees={[
        { id: "a", label: "A", render: () => <div /> },
        { id: "b", label: "B", render: () => <div /> },
        { id: "c", label: "C", render: () => <div /> },
      ]} />
    );

    const select = getByRole("combobox");
    fireEvent.click(select);

    expect(queryAllByText("A")).to.have.length(2);
    getByText("B");
    getByText("C");
  });

  it("renders with default selected content", () => {
    const { getByTestId } = render(
      <TreeSelector defaultSelectedContentId={"b"} trees={[
        { id: "a", label: "A", render: () => <div data-testid="a" /> },
        { id: "b", label: "B", render: () => <div data-testid="b" /> },
        { id: "c", label: "C", render: () => <div data-testid="c" /> },
      ]} />
    );
    getByTestId("b");
  });

  it("renders the first content in children list if `defaultSelectedContentId` doesn't match provided content definitions", () => {
    const { getByTestId } = render(
      <TreeSelector defaultSelectedContentId={"b"} trees={[ { id: "a", label: "A", render: () => <div data-testid="a" /> } ]} />
    );
    getByTestId("a");
  });

  it("renders without content when provided an empty children list", () => {
    const { container } = render(<TreeSelector defaultSelectedContentId={""} trees={[]} />);
    expect(
      container.getElementsByClassName("presentation-components-tree-selector-content-wrapper")[0].innerHTML
    ).to.be.empty;
  });

  it("changes displayed content based on selected item in select box", async () => {
    const { getByText, getByRole, queryByText } = render(
        <TreeSelector defaultSelectedContentId={"a"} trees={[
          { id: "a", label: "A", render: () => <div data-testid="a" /> },
          { id: "b", label: "B", render: () => <div data-testid="b" /> },
          { id: "c", label: "C", render: () => <div data-testid="c" /> },
        ]} />
    );
    getByText("A");

    const select = getByRole("combobox");
    fireEvent.click(select);

    fireEvent.click(getByText("B"));

    expect(queryByText("A")).to.be.null;
    getByText("B");
  });
});
