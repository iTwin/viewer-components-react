/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "./test-utils";
import DeleteModal from "../widget/components/DeleteModal";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { EmptyLocalization } from "@itwin/core-common";

beforeAll(async () => {
  const localization = new EmptyLocalization();
  await ReportsConfigWidget.initialize(localization);
});

describe("Delete modal", () => {
  it("should render", () => {
    const { container } = render(<DeleteModal entityName="test" onDelete={jest.fn()} refresh={jest.fn()} onClose={jest.fn()} />);
    expect(container).toBeTruthy();
  });

  it("should call onDelete when delete button is clicked", async () => {
    const onDelete = jest.fn();
    const { user } = render(<DeleteModal entityName="test" onDelete={onDelete} refresh={jest.fn()} onClose={jest.fn()} />);
    const deleteButton = screen.getByRole("button", {
      name: /delete/i,
    });
    await user.click(deleteButton);
    expect(onDelete).toHaveBeenCalled();
  });
});
