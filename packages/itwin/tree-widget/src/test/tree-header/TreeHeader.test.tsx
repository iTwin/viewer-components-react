/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import sinon from "sinon";
import { EmptyLocalization } from "@itwin/core-common";
import { Button } from "@itwin/itwinui-react";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvents from "@testing-library/user-event";
import { TreeHeader, TreeHeaderProps } from "../../components/tree-header/TreeHeader";
import { TreeWidget } from "../../TreeWidget";

describe("<TreeHeader />", () => {
  const defaultProps: TreeHeaderProps = {
    onFilterClear: () => {},
    onFilterStart: () => {},
    onSelectedChanged: () => {},
  };

  before(async () => {
    await TreeWidget.initialize(new EmptyLocalization());
  });

  after(() => {
    TreeWidget.terminate();
  });

  afterEach(() => {
    global.cancelAnimationFrame = sinon.stub();
    cleanup();
    delete (global as any).cancelAnimationFrame;
    sinon.restore();
  });

  it("renders supplied buttons", async () => {
    const { queryByRole } = render(
      <TreeHeader {...defaultProps}>
        <Button>Button1</Button>
        <Button>Button2</Button>
      </TreeHeader>
    );

    await waitFor(() => {
      expect(queryByRole("button", {name: "Button1"})).to.not.be.null;
      expect(queryByRole("button", {name: "Button2"})).to.not.be.null;
    });
  });

  it("opens and closes search box", async () => {
    const { getByRole, container } = render(
      <TreeHeader {...defaultProps}>
        <Button>Button1</Button>
        <Button>Button2</Button>
      </TreeHeader>
    );

    const openButton = getByRole("button", { name: TreeWidget.translate("searchBox.open")  });
    await userEvents.click(openButton);

    await waitFor(() => expect(container.querySelector(".tree-widget-searchbox.open")).to.not.be.null);

    const closeButton = getByRole("button", { name: TreeWidget.translate("searchBox.close")  });
    await userEvents.click(closeButton);

    await waitFor(() => expect(container.querySelector(".tree-widget-searchbox.open")).to.be.null);
  });

  it("handles buttons overflow", async () => {
    sinon.stub(HTMLElement.prototype, "scrollWidth").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 32);

    const { queryByRole } = render(
      <TreeHeader {...defaultProps}>
        <Button>Button1</Button>
        <Button>Button2</Button>
      </TreeHeader>
    );

    expect(queryByRole("button", { name: "Button1" })).to.be.null;
    expect(queryByRole("button", { name: "Button2" })).to.be.null;
  });
});
