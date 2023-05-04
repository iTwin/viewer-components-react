/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { setupServer } from "msw/node";
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "./test-utils";
import { ReportAction } from "../widget/components/ReportAction";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import type { Report } from "@itwin/insights-client";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import { EmptyLocalization } from "@itwin/core-common";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();

jest.mock("../widget/components/ReportMappings", () => ({
  ReportMappings: () => "MockReportMappings",
}));

const server = setupServer();

beforeAll(async () => {
  const localization = new EmptyLocalization();
  await ReportsConfigWidget.initialize(localization);
  server.listen();
});

afterAll(() => {
  server.close();
});

afterEach(() => server.resetHandlers());

describe("Reports Action", () => {
  it("required fields should be filled out", async () => {
    const mockReturnFn = jest.fn();

    render(<ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { iModelId: mockIModelId, iTwinId: mockITwinId });

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });
    const cancelButton = screen.getByRole("button", {
      name: /cancel/i,
    });

    expect(cancelButton).toBeEnabled();
    expect(addButton).toBeDisabled();
  });

  it("should be able to add report", async () => {
    const mockReport: Report = {
      id: faker.datatype.uuid(),
      displayName: "mOcKRePoRt1",
      description: "",
      deleted: false,
      _links: {
        project: {
          href: "",
        },
      },
    };
    server.use(
      rest.post(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(400), ctx.status(200), ctx.json(mockReport));
        }
      )
    );

    const mockReturnFn = jest.fn();

    const { user } = render(
      <ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { iModelId: mockIModelId, iTwinId: mockITwinId });

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });
    const cancelButton = screen.getByRole("button", {
      name: /cancel/i,
    });
    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });
    const descriptionInput = screen.getByRole("textbox", {
      name: /description/i,
    });

    await userEvent.type(nameInput, "mOcKTeXt");
    await userEvent.type(descriptionInput, "moCk DeScRiPtIoN");
    expect(cancelButton).toBeEnabled();
    expect(addButton).toBeEnabled();

    await user.click(addButton);

    expect(addButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(nameInput).toBeDisabled();

    await waitForElementToBeRemoved(() =>
      screen.getByTestId(/loading\-spinner/i)
    );

    expect(mockReturnFn).toHaveBeenCalledTimes(1);
  });

  it("No duplicate underscores in the beginning of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(
      <ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { iModelId: mockIModelId, iTwinId: mockITwinId }
    );

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, "__testName");
    await user.click(addButton);
    expect(
      screen.getByText(/validators\.noduplicateunderscore/i)
    ).toBeInTheDocument();
  });

  it("Only begin with letters or underscores of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(
      <ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { iModelId: mockIModelId, iTwinId: mockITwinId }
    );

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, "$testName");
    await user.click(addButton);
    expect(
      screen.getByText(/validators\.onlybeginswithletterorunderscore/i)
    ).toBeInTheDocument();
  });

  it("Only letters underscores and digits of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(
      <ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { iModelId: mockIModelId, iTwinId: mockITwinId }
    );

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, "_# ");
    await user.click(addButton);
    expect(
      screen.getByText(
        /validators\.FollowedByLettersUnderscoresSpacesAndDigits/i
      )
    ).toBeInTheDocument();
  });

  it("check for character limits of name", async () => {
    const mockReturnFn = jest.fn();

    const { user } = render(
      <ReportAction onClickCancel={jest.fn()} onSaveSuccess={mockReturnFn} />, { iModelId: mockIModelId, iTwinId: mockITwinId }
    );

    const addButton = screen.getByRole("button", {
      name: /add/i,
    });

    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    });

    await userEvent.type(nameInput, faker.random.alpha(200));
    await user.click(addButton);
    expect(screen.getByText(/validators\.charlimit/i)).toBeInTheDocument();
  });
});
