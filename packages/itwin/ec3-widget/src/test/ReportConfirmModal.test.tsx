/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import { renderWithContext, simulateClick } from "./test-utils";
import { ReportConfirmModal } from "../components/ReportConfirmModal";

describe("ReportConfirmModal", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Report Confirm modal with the show prop should render successfully and be visible", async () => {
    await renderWithContext({
      component: <ReportConfirmModal show={true} setShow={() => {}} onConfirm={() => {}} refresh={async () => {}} onCancel={() => {}} />,
    });
    expect(screen.getByTestId("ec3-report-confirm-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();
  });

  it("Report Confirm modal without the show prop should not be visible", async () => {
    await renderWithContext({
      component: <ReportConfirmModal show={false} setShow={() => {}} onConfirm={() => {}} refresh={async () => {}} onCancel={() => {}} />,
    });
    expect(document.querySelector("ec3-report-confirm-modal")).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeNull();
  });

  it("Closing using button in top right calls setShow and onCancel function", async () => {
    const show = jest.fn();
    const cancel = jest.fn();
    await renderWithContext({
      component: <ReportConfirmModal show={true} setShow={show} onConfirm={() => {}} refresh={async () => {}} onCancel={cancel} />,
    });
    expect(screen.getByTestId("ec3-report-confirm-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();

    const button = document.querySelector(".iui-dialog-title-bar > .iui-button") as HTMLInputElement;
    expect(button).toBeDefined();
    await simulateClick(button);
    expect(show).toHaveBeenCalledWith(false);
    expect(cancel).toHaveBeenCalled();
  });

  it("Closing using cancel button calls setShow and onCancel functions", async () => {
    const show = jest.fn();
    const cancel = jest.fn();
    await renderWithContext({
      component: <ReportConfirmModal show={true} setShow={show} onConfirm={() => {}} refresh={async () => {}} onCancel={cancel} />,
    });
    expect(screen.getByTestId("ec3-report-confirm-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();

    const button = screen.getByTestId("ec3-report-confirm-modal-cancel-button");
    expect(button).toBeDefined();
    await simulateClick(button);
    expect(show).toHaveBeenCalledWith(false);
    expect(cancel).toHaveBeenCalled();
  });

  it("Reports confirm modal calls confirm, refresh and setShow functions after pressing the confirm button", async () => {
    const confirm = jest.fn();
    const refresh = jest.fn().mockImplementation((f) => setTimeout(f, 1));
    const show = jest.fn();

    await renderWithContext({
      component: <ReportConfirmModal show={true} setShow={show} onConfirm={confirm} refresh={refresh} onCancel={() => {}} />,
    });
    expect(screen.getByTestId("ec3-report-confirm-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();

    const button = screen.getByTestId("ec3-report-confirm-modal-button");
    await simulateClick(button);

    expect(confirm).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(false);
  });
});
