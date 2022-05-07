/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, TestUtils, waitForElementToBeRemoved, within } from "../test/test-utils";
import { Reports } from "../widget/components/Reports";
import { NoRenderApp } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { rest } from "msw";
import { setupServer } from "msw/node";
import type { ActiveIModel } from "../widget/hooks/useActiveIModel";
import faker from "@faker-js/faker";
import type { ReportCollection } from "@itwin/insights-client";
import userEvent from "@testing-library/user-event";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();

const reportsFactory = (): ReportCollection => ({
  reports: Array.from({ length: faker.datatype.number({ min: 3, max: 5 }) }, () => (
    {
      id: `${faker.datatype.uuid()}`,
      displayName: faker.random.alpha(10),
      description: faker.random.words(10),
    }),
  ),
  _links: {
    next: undefined,
    self: {
      href: "",
    },
  },
});

jest.mock("../widget/hooks/useActiveIModel", () => ({
  useActiveIModel: () => {
    const activeIModel: ActiveIModel = { iTwinId: mockITwinId, iModelId: mockIModelId };
    return activeIModel;
  },
}));

jest.mock("../widget/components/ReportMappings", () => ({ ReportMappings: () => "MockReportMappings" }));

const server = setupServer();

beforeAll(async () => {
  await TestUtils.initializeUiFramework();
  await NoRenderApp.startup();
  await ReportsConfigWidget.initialize(TestUtils.localization);
  server.listen();

});

afterAll(() => {
  TestUtils.terminateUiFramework();
  server.close();
});

afterEach(() => server.resetHandlers());

describe("Reports View", () => {

  it("call to action button should be clickable with no reports", async () => {
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(500), ctx.status(200), ctx.json({ reports: [] }));
        },
      ),
    );

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    const ctaButton = screen.getByRole("button", { name: /createonereportcta/i });
    await user.click(ctaButton);
    expect(screen.getByText(/addreport/i)).toBeInTheDocument();
  });

  it("be able to add new report", async () => {
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(500), ctx.status(200), ctx.json({ reports: [] }));
        },
      ),
    );

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    const newButton = screen.getByRole("button", {
      name: /new/i,
    });
    await user.click(newButton);
    expect(screen.getByText(/addreport/i)).toBeInTheDocument();
  });

  it("list all reports", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(500), ctx.status(200), ctx.json(mockedReports));
        },
      ),
    );

    render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    // TODO check for all descriptions and names and imodels
    expect(horizontalTiles).toHaveLength(mockedReports?.reports!.length);

    for (const [index, horizontalTile] of horizontalTiles.entries()) {
      const reportMappingTile = within(horizontalTile);
      expect(reportMappingTile.getByText(mockedReports?.reports![index].displayName ?? "")).toBeInTheDocument();
      expect(reportMappingTile.getByTitle(mockedReports?.reports![index].description ?? "")).toBeInTheDocument();
    }

  });

  it("able to modify a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(500), ctx.status(200), ctx.json(mockedReports));
        },
      ),
    );

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const firstMenuDropdown = within(screen.getAllByTestId(/tile-action-button/i)[0]).getByRole("button");
    await user.click(firstMenuDropdown);
    const modifyButton = screen.getByRole("menuitem", { name: /modify/i });
    await user.click(modifyButton);

    expect(screen.getByText(/modifyreport/i)).toBeInTheDocument();
  });

  it("remove a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    const mockedReportsOriginalLength = mockedReports.reports!.length;
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(200), ctx.status(200), ctx.json(mockedReports));
        },
      ),
      rest.delete(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/${mockedReports.reports![0].id}`,
        async (_req, res, ctx) => {
          mockedReports.reports = mockedReports.reports!.filter((report) => report.id !== mockedReports.reports![0].id);
          return res(ctx.delay(100), ctx.status(204));
        },
      ),
    );

    const { user } = render(<Reports />);

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

    await waitForElementToBeRemoved(() => screen.getByTestId(/rcw-loading-delete/i));
    await waitForElementToBeRemoved(() => screen.getByRole("dialog"));

    // Should be one less report
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(mockedReportsOriginalLength - 1);

  });

  it("search for a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(200), ctx.status(200), ctx.json(mockedReports));
        },
      )
    );

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const searchButton = within(screen.getByTestId(/search-bar/i)).getByRole("button");
    await user.click(searchButton);
    const searchInput = screen.getByRole("textbox", { name: /search\-textbox/i });

    // Be an exact match on display name.
    await userEvent.type(searchInput, mockedReports.reports![0].displayName ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(mockedReports.reports![0].displayName ?? "")).toBeInTheDocument();

    // Be an exact match on description.
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, mockedReports.reports![0].description ?? "");
    expect(screen.getAllByTestId("horizontal-tile")).toHaveLength(1);
    expect(screen.getByText(mockedReports.reports![0].displayName ?? "")).toBeInTheDocument();

  });

  it("modify a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(200), ctx.status(200), ctx.json(mockedReports));
        },
      )
    );

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const firstMenuDropdown = within(screen.getAllByTestId(/tile-action-button/i)[0]).getByRole("button");
    await user.click(firstMenuDropdown);
    const modifyButton = screen.getByRole("menuitem", { name: /modify/i });
    await user.click(modifyButton);
    // Modify report should appear
    expect(screen.getByText(/modifyreport/i)).toBeInTheDocument();
  });

  it("click a report", async () => {
    const mockedReports: ReportCollection = reportsFactory();
    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports`,
        async (_req, res, ctx) => {
          return res(ctx.delay(200), ctx.status(200), ctx.json(mockedReports));
        },
      )
    );

    const { user } = render(<Reports />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    const reportName = screen.getByText(mockedReports.reports![0].displayName ?? "");
    await user.click(reportName);
    expect(screen.getByText(/MockReportMappings/i)).toBeInTheDocument();
  });
});
