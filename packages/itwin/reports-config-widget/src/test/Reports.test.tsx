/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitForElementToBeRemoved, within } from "../test/test-utils";
import { Reports } from "../widget/components/Reports";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import faker from "@faker-js/faker";
import type { ReportCollection, ReportsClient } from "@itwin/insights-client";
import userEvent from "@testing-library/user-event";
import { EmptyLocalization } from "@itwin/core-common";
import * as moq from "typemoq";

const reportsFactory = (): ReportCollection => ({
  reports: Array.from({ length: faker.datatype.number({ min: 3, max: 5 }) }, (_, index) => ({
    id: `${faker.datatype.uuid()}`,
    displayName: `mOcKRePoRT${index}`,
    description: `mOcKRePoRTDeScRiPtIoN${index}`,
    deleted: false,
    _links: {
      project: {
        href: "",
      },
      odata: {
        href: "",
      },
    },
  })),
  _links: {
    next: undefined,
    self: {
      href: "",
    },
  },
});

const mockGetReports = jest.fn();
const mockDeleteReport = jest.fn();

const mockReportsClient = moq.Mock.ofType<ReportsClient>();

beforeAll(async () => {
  const localization = new EmptyLocalization();
  await ReportsConfigWidget.initialize(localization);

  mockReportsClient.setup(async (x) => x.getReports(moq.It.isAny(), moq.It.isAny())).returns(mockGetReports);
  mockReportsClient.setup(async (x) => x.deleteReport(moq.It.isAny(), moq.It.isAny())).returns(mockDeleteReport);
});

afterEach(() => {
  mockGetReports.mockReset();
  mockDeleteReport.mockReset();
});

describe("Reports View", () => {
  it("call to action button should be clickable with no reports", async () => {
    mockGetReports.mockReturnValueOnce([]);
    const onClickAddMock = jest.fn();

    const { user } = render(<Reports onClickAddReport={onClickAddMock} />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    const ctaButton = screen.getByRole("button", {
      name: /createonereportcta/i,
    });
    await user.click(ctaButton);
    expect(onClickAddMock).toBeCalled();
  });

  it("be able to add new report", async () => {
    mockGetReports.mockReturnValueOnce([]);

    const onClickAddMock = jest.fn();
    const { user } = render(<Reports onClickAddReport={onClickAddMock} />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    const newButton = screen.getByRole("button", {
      name: /new/i,
    });
    await user.click(newButton);
    expect(onClickAddMock).toBeCalled();
  });

  it("list all reports", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    mockGetReports.mockReturnValueOnce(mockedReports.reports);

    render(<Reports />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    // TODO check for all descriptions and names and imodels
    expect(horizontalTiles).toHaveLength(mockedReports?.reports.length);

    for (const [index, horizontalTile] of horizontalTiles.entries()) {
      const reportMappingTile = within(horizontalTile);
      expect(reportMappingTile.getByText(mockedReports?.reports[index].displayName ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByTitle(mockedReports?.reports[index].description ?? "")).toBeInTheDocument();
    }
  });

  it("able to modify a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    mockGetReports.mockReturnValueOnce(mockedReports.reports);
    const onClickModifyMock = jest.fn();
    const { user } = render(<Reports onClickReportModify={onClickModifyMock} />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const firstMenuDropdown = within(screen.getAllByTestId(/tile-action-button/i)[0]).getByRole("button");
    await user.click(firstMenuDropdown);
    const modifyButton = screen.getByRole("menuitem", { name: /modify/i });
    await user.click(modifyButton);

    expect(onClickModifyMock).toBeCalled();
  });

  it("remove a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();

    mockGetReports.mockReturnValue(mockedReports.reports);

    const { user } = render(<Reports />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const firstMenuDropdown = within(screen.getAllByTestId(/tile-action-button/i)[0]).getByRole("button");
    await user.click(firstMenuDropdown);
    const removeButton = screen.getByRole("menuitem", { name: /remove/i });
    await user.click(removeButton);
    // Delete modal dialog should appear
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", {
      name: /delete/i,
    });

    await user.click(deleteButton);

    await waitForElementToBeRemoved(() => screen.getByRole("dialog"));

    expect(mockDeleteReport).toBeCalled();
    // Two calls, when it is first rendered and when it is refreshed.
    expect(mockGetReports).toBeCalledTimes(2);
  });

  it("search for a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    mockGetReports.mockReturnValueOnce(mockedReports.reports);
    const { user } = render(<Reports />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const searchButton = screen.getByTestId(/rcw-search-button/i);

    await user.click(searchButton);
    const searchInput = screen.getByRole("textbox", {
      name: /search\-textbox/i,
    });

    // Be an exact match on display name.
    await userEvent.type(searchInput, mockedReports.reports[0].displayName);
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(mockedReports.reports[0].displayName)).toBeInTheDocument();

    // Be an exact match on description.
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, mockedReports.reports[0].description ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(mockedReports.reports[0].displayName)).toBeInTheDocument();
  });

  it("modify a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    mockGetReports.mockReturnValueOnce(mockedReports.reports);
    const onClickModifyMock = jest.fn();
    const { user } = render(<Reports onClickReportModify={onClickModifyMock} />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const firstMenuDropdown = within(screen.getAllByTestId(/tile-action-button/i)[0]).getByRole("button");
    await user.click(firstMenuDropdown);
    const modifyButton = screen.getByRole("menuitem", { name: /modify/i });
    await user.click(modifyButton);
    expect(onClickModifyMock).toBeCalled();
  });

  it("click a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    mockGetReports.mockReturnValueOnce(mockedReports.reports);
    const onClickTitleMock = jest.fn();
    const { user } = render(<Reports onClickReportTitle={onClickTitleMock} />, { reportsClient: mockReportsClient.object });

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const reportName = screen.getByText(mockedReports.reports[0].displayName);
    await user.click(reportName);
    expect(onClickTitleMock).toBeCalled();
  });
});
