/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import type {
  IModelConnection,
  SelectionSet,
  SelectionSetEvent,
} from "@itwin/core-frontend";
import { NoRenderApp } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { setupServer } from "msw/node";
import {
  render,
  screen,
  TestUtils,
  waitForElementToBeRemoved,
} from "./test-utils";
import ReportAction from "../widget/components/ReportAction";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import type { Report } from "@itwin/insights-client";
import * as moq from "typemoq";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";
import type {
  SelectionManager,
  SelectionScopesManager,
} from "@itwin/presentation-frontend";
import {
  Presentation,
  SelectionChangeEvent,
} from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

jest.mock("../widget/components/ReportMappings", () => ({
  ReportMappings: () => "MockReportMappings",
}));

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

const server = setupServer();

beforeAll(async () => {
  // This is required by the i18n module within iTwin.js
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires

  await NoRenderApp.startup();
  await Presentation.initialize();
  const selectionSet = moq.Mock.ofType<SelectionSet>();
  const onChanged = moq.Mock.ofType<BeEvent<(ev: SelectionSetEvent) => void>>();
  selectionSet.setup((x) => x.elements).returns(() => new Set([]));
  selectionSet.setup((x) => x.onChanged).returns(() => onChanged.object);
  connectionMock
    .setup((x) => x.selectionSet)
    .returns(() => selectionSet.object);
  connectionMock.setup((x) => x.iModelId).returns(() => mockIModelId);
  connectionMock.setup((x) => x.iTwinId).returns(() => mockITwinId);

  selectionManagerMock
    .setup((x) => x.selectionChange)
    .returns(() => new SelectionChangeEvent());

  selectionScopesManagerMock
    .setup(async (x) => x.getSelectionScopes(connectionMock.object))
    .returns(async () => []);
  selectionManagerMock
    .setup((x) => x.scopes)
    .returns(() => selectionScopesManagerMock.object);

  Presentation.setSelectionManager(selectionManagerMock.object);
  await TestUtils.initializeUiFramework(connectionMock.object);
  await ReportsConfigWidget.initialize();
  server.listen();
});

afterAll(() => {
  TestUtils.terminateUiFramework();
  server.close();
});

afterEach(() => server.resetHandlers());

describe("Reports Action", () => {
  it("required fields should be filled out", async () => {
    const mockReturnFn = jest.fn();

    render(<ReportAction iTwinId={mockITwinId} returnFn={mockReturnFn} />);

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
      displayName: faker.random.word(),
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
      <ReportAction iTwinId={mockITwinId} returnFn={mockReturnFn} />
    );

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

    await userEvent.type(nameInput, faker.random.word());
    await userEvent.type(descriptionInput, faker.random.words());
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
      <ReportAction iTwinId={mockITwinId} returnFn={mockReturnFn} />
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
      <ReportAction iTwinId={mockITwinId} returnFn={mockReturnFn} />
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
      <ReportAction iTwinId={mockITwinId} returnFn={mockReturnFn} />
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
      <ReportAction iTwinId={mockITwinId} returnFn={mockReturnFn} />
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
