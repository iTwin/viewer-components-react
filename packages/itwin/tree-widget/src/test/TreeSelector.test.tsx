/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { TreeSelector } from "../components/TreeSelector.js";
import { render, waitFor } from "./TestUtils.js";

before(async () => {
  window.HTMLElement.prototype.scrollIntoView = function () {};
});

describe("<TreeSelector />", () => {
  it("lists all given content components in select box", async () => {
    const { user, getByText, queryAllByText, getByRole } = render(
      <TreeSelector
        defaultSelectedContentId={""}
        trees={[
          { id: "a", label: "A", render: () => <div /> },
          { id: "b", label: "B", render: () => <div /> },
          { id: "c", label: "C", render: () => <div /> },
        ]}
      />,
    );

    const select = await waitFor(() => getByRole("combobox"));
    await user.click(select);

    await waitFor(() => {
      expect(queryAllByText("A")).to.have.length(2);
      expect(getByText("B")).to.not.be.null;
      expect(getByText("C")).to.not.be.null;
    });
  });

  it("renders with default selected content", async () => {
    const { getByTestId } = render(
      <TreeSelector
        defaultSelectedContentId={"b"}
        trees={[
          { id: "a", label: "A", render: () => <div data-testid="a" /> },
          { id: "b", label: "B", render: () => <div data-testid="b" /> },
          { id: "c", label: "C", render: () => <div data-testid="c" /> },
        ]}
      />,
    );

    await waitFor(() => expect(getByTestId("b")).to.not.be.null);
  });

  it("renders the first content in children list if `defaultSelectedContentId` doesn't match provided content definitions", async () => {
    const { getByTestId } = render(<TreeSelector defaultSelectedContentId={"b"} trees={[{ id: "a", label: "A", render: () => <div data-testid="a" /> }]} />);

    await waitFor(() => expect(getByTestId("a")).to.not.be.null);
  });

  it("renders without content when provided an empty children list", async () => {
    const { container } = render(<TreeSelector defaultSelectedContentId={""} trees={[]} />);

    await waitFor(() => {
      expect(container.getElementsByClassName("presentation-components-tree-selector-content-wrapper")[0].innerHTML).to.be.empty;
    });
  });

  it("renders default selection start icon when provided", async () => {
    const { getByText, queryByText, queryAllByText } = render(
      <TreeSelector
        defaultSelectedContentId={""}
        trees={[
          { id: "a", label: "A", render: () => <div />, startIcon: <div>Icon</div> },
          { id: "b", label: "B", render: () => <div /> },
          { id: "c", label: "C", render: () => <div /> },
        ]}
      />,
    );

    await waitFor(() => {
      expect(queryAllByText("A")).to.not.be.null;
      expect(getByText("Icon")).to.not.be.null;
      expect(queryByText("B")).to.be.null;
      expect(queryByText("C")).to.be.null;
    });
  });

  it("renders selected content with start icon when icon provided", async () => {
    const { user, getByText, queryByText, queryAllByText, getByRole } = render(
      <TreeSelector
        defaultSelectedContentId={""}
        trees={[
          { id: "a", label: "A", render: () => <div /> },
          { id: "b", label: "B", render: () => <div />, startIcon: <div>Icon</div> },
          { id: "c", label: "C", render: () => <div /> },
        ]}
      />,
    );

    await waitFor(() => {
      expect(queryAllByText("A")).to.not.be.null;
      expect(queryByText("Icon")).to.be.null;
      expect(queryByText("B")).to.be.null;
      expect(queryByText("C")).to.be.null;
    });

    const select = await waitFor(() => getByRole("combobox"));
    await user.click(select);

    await waitFor(() => {
      expect(queryAllByText("A")).to.have.length(2);
      expect(getByText("Icon")).to.not.be.null;
      expect(getByText("B")).to.not.be.null;
      expect(getByText("C")).to.not.be.null;
    });

    const option = getByText("B");
    await user.click(option);

    await waitFor(() => {
      expect(queryAllByText("B")).to.not.be.null;
      expect(getByText("Icon")).to.not.be.null;
      expect(queryByText("A")).to.be.null;
      expect(queryByText("C")).to.be.null;
    });
  });

  it("changes displayed content based on selected item in select box", async () => {
    const { user, getByText, getByRole, queryByText } = render(
      <TreeSelector
        defaultSelectedContentId={"a"}
        trees={[
          { id: "a", label: "A", render: () => <div data-testid="a" /> },
          { id: "b", label: "B", render: () => <div data-testid="b" /> },
          { id: "c", label: "C", render: () => <div data-testid="c" /> },
        ]}
      />,
    );
    await waitFor(() => expect(getByText("A")).to.not.be.null);

    const select = await waitFor(() => getByRole("combobox"));
    await user.click(select);

    const menuItem = await waitFor(() => getByText("B"));
    await user.click(menuItem);

    await waitFor(() => {
      expect(queryByText("A")).to.be.null;
      expect(getByText("B")).to.not.be.null;
    });
  });

  it("reports on tree selection", async () => {
    const onFeatureUsedSpy = sinon.spy();
    const { user, getByText, getByRole, queryByText } = render(
      <TreeSelector
        defaultSelectedContentId={"a"}
        onFeatureUsed={onFeatureUsedSpy}
        trees={[
          { id: "a", label: "A", render: () => <div data-testid="a" /> },
          { id: "b", label: "B", render: () => <div data-testid="b" /> },
          { id: "c", label: "C", render: () => <div data-testid="c" /> },
        ]}
      />,
    );
    await waitFor(() => expect(getByText("A")).to.not.be.null);

    const select = await waitFor(() => getByRole("combobox"));
    await user.click(select);

    const menuItem = await waitFor(() => getByText("B"));
    await user.click(menuItem);

    await waitFor(() => expect(queryByText("A")).to.be.null);
    expect(onFeatureUsedSpy).to.be.calledOnceWith("choose-b");
  });
});
