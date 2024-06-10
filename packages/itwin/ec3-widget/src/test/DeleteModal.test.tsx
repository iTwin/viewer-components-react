/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import { renderWithContext, simulateClick } from "./test-utils";
import { DeleteModal } from "../components/DeleteModal";

describe("DeleteModal", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Delete modal with the show prop should be visible", async () => {
    await renderWithContext({
      component: <DeleteModal entityName="template" show={true} setShow={() => {}} onDelete={async () => {}} refresh={async () => {}} />,
    });
    expect(screen.getByTestId("ec3-delete-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();
  });

  it("Delete modal without the show prop should not be visible", async () => {
    await renderWithContext({
      component: <DeleteModal entityName="template" show={false} setShow={() => {}} onDelete={async () => {}} refresh={async () => {}} />,
    });
    expect(document.querySelector(".ec3-delete-modal")).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeNull();
  });

  it("Closing using button in top right calls setShow function", async () => {
    const show = jest.fn();
    await renderWithContext({
      component: <DeleteModal entityName="template" show={true} setShow={show} onDelete={async () => {}} refresh={async () => {}} />,
    });
    expect(screen.getByTestId("ec3-delete-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();

    const button = document.querySelector(".iui-dialog-title-bar > .iui-button") as HTMLInputElement;
    expect(button).toBeDefined();
    await simulateClick(button);
    expect(show).toHaveBeenCalledWith(false);
  });

  it("Closing using cancel button calls setShow function", async () => {
    const show = jest.fn();
    await renderWithContext({
      component: <DeleteModal entityName="template" show={true} setShow={show} onDelete={async () => {}} refresh={async () => {}} />,
    });
    expect(screen.getByTestId("ec3-delete-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();

    const button = screen.getByTestId("ec3-delete-modal-cancel-button");
    expect(button).toBeDefined();
    await simulateClick(button);
    expect(show).toHaveBeenCalledWith(false);
  });

  it("Delete modal calls onDelete and refresh and setShow functions after pressing the delete button", async () => {
    const deleteing = jest.fn().mockImplementation((f) => setTimeout(f, 1));
    const refresh = jest.fn();
    const show = jest.fn();

    await renderWithContext({
      component: <DeleteModal entityName="template" show={true} setShow={show} onDelete={deleteing} refresh={refresh} />,
    });
    expect(screen.getByTestId("ec3-delete-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();

    const button = screen.getByTestId("ec3-delete-modal-button");
    await simulateClick(button);

    expect(deleteing).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(false);
  });
});
