/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { act, screen } from "@testing-library/react";
import * as moq from "typemoq";
import type { EC3Job, IEC3JobsClient } from "@itwin/insights-client";
import { CarbonUploadState } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { renderWithContext } from "./test-utils";
import { ExportModal } from "../components/ExportModal";

jest.mock("@itwin/itwinui-react", () => ({
  ...jest.requireActual("@itwin/itwinui-react"),
  toaster: {
    positive: (_: string) => {},
    negative: (_: string) => {},
  },
}));

const jobsClient = moq.Mock.ofType<IEC3JobsClient>();

describe("ExportModal", () => {
  const templateId = faker.datatype.uuid();
  const jobId = faker.datatype.uuid();

  const job: EC3Job = {
    id: jobId,
    _links: {
      status: {
        href: "status",
      },
    },
  };

  function status(state: CarbonUploadState) {
    return {
      status: state,
      _links: {
        ec3Project: {
          href: jobId,
        },
      },
    };
  }

  const accessToken = faker.datatype.uuid();
  const ec3Token = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    jobsClient.setup(async (x) => x.createJob(accessToken, moq.It.isAny())).returns(async () => job);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Export modal with the isOpen prop should render successfully and be visible", async () => {
    await renderWithContext({
      component: <ExportModal projectName="" isOpen={true} close={() => {}} templateId={templateId} token={undefined} />,
    });
    expect(screen.getByTestId("ec3-export-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();
  });

  it("Export modal without the isOpen prop should be invisible", async () => {
    await renderWithContext({
      component: <ExportModal projectName="" isOpen={false} close={() => {}} templateId={templateId} token={undefined} />,
    });
    expect(document.querySelector(".ec3-export-modal")).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeNull();
  });

  it("Interval should be set when modal is open and ec3 token is received", async () => {
    let event: Function | undefined;
    jest.spyOn(window, "setInterval").mockImplementation((callback, _) => {
      event = callback;
      return setTimeout(() => {});
    });

    expect(event).toBe(undefined);
    await renderWithContext({
      component: <ExportModal projectName="" isOpen={true} close={() => {}} templateId={templateId} token={ec3Token} />,
      ec3JobsClient: jobsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-export-modal")).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeDefined();
    await new Promise((f) => setTimeout(f, 1));
    expect(event).not.toBe(undefined);
  });

  it("Text describing the status of an export should be displayed for each status", async () => {
    let event: Function | undefined;
    jest.spyOn(window, "setInterval").mockImplementation((callback, _) => {
      event = callback;
      return setTimeout(() => {});
    });

    expect(event).toBe(undefined);
    await renderWithContext({
      component: <ExportModal projectName="" isOpen={true} close={() => {}} templateId={templateId} token={ec3Token} />,
      ec3JobsClient: jobsClient.object,
      getAccessTokenFn,
    });
    const modal = screen.getByTestId("ec3-export-modal");
    expect(modal).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeDefined();
    await new Promise((f) => setTimeout(f, 1));
    expect(event).not.toBe(undefined);

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Queued));
    await act(async () => {
      await event!();
    });
    expect(modal.querySelector(".iui-text-leading")).toHaveTextContent("Export queued");

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Running));
    await act(async () => {
      await event!();
    });
    expect(modal.querySelector(".iui-text-leading")).toHaveTextContent("Export running");

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Succeeded));
    await act(async () => {
      await event!();
    });
    expect(modal.querySelector(".ec3w-report-button")).toHaveTextContent("Open in EC3");

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Failed));
    await act(async () => {
      await event!();
    });
    expect(modal.querySelector(".iui-text-leading")).toHaveTextContent("Export failed");
  });
});
