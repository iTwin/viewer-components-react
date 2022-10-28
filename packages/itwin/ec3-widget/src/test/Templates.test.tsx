/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitForElementToBeRemoved, waitFor } from "@testing-library/react";
import Templates from "../components/Templates";
import TemplateMenu from "../components/TemplateMenu";
import * as moq from "typemoq";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { AuthorizationClient } from "@itwin/core-common";
import { ReportingClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { setupServer } from "msw/node";
import userEvent from "@testing-library/user-event";
import sampleMetadata from "./metadataSample";
import { EC3Config } from "../components/EC3/EC3Config";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportingClient = moq.Mock.ofType<ReportingClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportingClient: jest.fn().mockImplementation(() => reportingClient.object)
}));


describe("Templates view", () => {
  const mockedReports = ({
    reports: Array.from(
      { length: faker.datatype.number({ min: 3, max: 5 }) },
      (_, index) => ({
        id: `${faker.datatype.uuid()}`,
        displayName: `mOcKRePoRT${index}`,
        description: `mOcKRePoRTDeScRiPtIoN${index}`,
      })
    ),
    _links: {
      next: undefined,
      self: {
        href: "",
      },
    },
  });

  const mockedResponses = ({
    "@odata.context": "context",
    value: Array.from(
      { length: faker.datatype.number({ min: 3, max: 5 }) },
      (_, index) => ({
        name: `mapping${index}`
      })
    ),
  });

  var firstMapping = mockedResponses.value[0].name!;
  const iTwinId = faker.datatype.uuid();
  const accessToken = faker.datatype.uuid();
  const authClient = moq.Mock.ofType<AuthorizationClient>();
  const server = setupServer();
  const config = new EC3Config({ clientId: "", redirectUri: "" })

  beforeAll(async () => {
    const metadata: Response = {
      text: async () => { return sampleMetadata },
    } as unknown as Response;

    authClient.setup((x) => x.getAccessToken()).returns(async () => accessToken);
    IModelApp.authorizationClient = authClient.object;
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportingClient.setup((x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports?.reports!);
    const reportId = mockedReports.reports![0].id!;
    reportingClient.setup((x) => x.getODataReport(accessToken, reportId)).returns(async () => mockedResponses);
    reportingClient.setup((x) => x.getODataReportMetadata(accessToken, reportId)).returns(async () => metadata);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("Templates view should render successfully", function () {
    render(<Templates config={config} />);
    expect(screen.getByText("Templates")).toBeDefined();
  });

  it("Template Menu should render successfully", async () => {
    const returnfn = async () => { };
    render(<TemplateMenu goBack={returnfn} config={config} />);
    expect(screen.getByText("Create template")).toBeInTheDocument();
  });

  it("Clicking create button should open creating template menu", async () => {
    const user = render(<Templates config={config} />);
    const button = screen.getByText("Create Template");
    button.click();
    expect(screen.getByText("Create template")).toBeInTheDocument();
  });

  it("Reports dropdown should be populated with data", async () => {
    const returnfn = async () => { };
    render(<TemplateMenu goBack={returnfn} config={config} />);
    await waitForElementToBeRemoved(() => screen.getByText("Loading"));
    const dropdown = screen.getByText("Select report");
    dropdown.click();
    mockedReports.reports!.forEach(report => {
      expect(screen.getByText(report.displayName!)).toBeInTheDocument();
    });
  });

  it("Created template should appear in the list", async () => {
    const user = render(<Templates config={config} />);
    const button = screen.getByText("Create Template");
    button.click();
    await waitForElementToBeRemoved(() => screen.getByText("Loading"));
    const dropdown = screen.getByText("Select report");
    dropdown.click();
    const report = mockedReports.reports![0];
    const option = user.getAllByRole("option")[0];
    option.scrollIntoView = jest.fn();
    option.click();
    expect(screen.getByText(report.displayName!)).toBeInTheDocument();

    const labeledDescriptionInput = screen.getByText("Template description");
    const descriptionInput = labeledDescriptionInput.parentElement!.children[1] as HTMLInputElement;
    const templateDescription = faker.animal.dog();
    userEvent.type(descriptionInput, templateDescription);
    await waitFor(() => screen.getByDisplayValue(templateDescription));

    const labeledInput = screen.getByText("Template name");
    const nameInput = labeledInput.parentElement!.children[1] as HTMLInputElement;
    const templateName = faker.animal.cat();
    userEvent.type(nameInput, templateName);
    await waitFor(() => screen.getByDisplayValue(templateName));

    const saveButton = screen.getByText("Save");
    saveButton.click();
    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText(templateName)).toBeInTheDocument();
    expect(screen.getByText(templateDescription)).toBeInTheDocument();
  });

  it("Added label should appear in the list", async () => {
    const user = render(<Templates config={config} />);
    const button = screen.getByText("Create Template");
    button.click();
    await waitForElementToBeRemoved(() => screen.getByText("Loading"));
    const dropdown = screen.getByText("Select report");
    dropdown.click();

    const report = mockedReports.reports![0];
    const option = user.getAllByRole("option")[0];
    option.scrollIntoView = jest.fn();
    option.click();
    expect(screen.getByText(report.displayName!)).toBeInTheDocument();

    const labeledInput = screen.getByText("Template name");
    const nameInput = labeledInput.parentElement!.children[1] as HTMLInputElement;
    const templateName = faker.animal.cat();
    userEvent.type(nameInput, templateName);
    await waitFor(() => screen.getByDisplayValue(templateName));

    const addLabelButton = screen.getByText("Add Label");
    addLabelButton.click();

    await waitForElementToBeRemoved(() => screen.getByText("Loading report tables"));

    const reportTableDropdown = screen.getByText("Select report table");
    reportTableDropdown.click();

    const reportOption = user.getAllByRole("option")[0];
    reportOption.scrollIntoView = jest.fn();
    reportOption.click();

    await waitForElementToBeRemoved(() => screen.getByText("Loading elements"));

    const quantityInput = screen.getByText("Element quantity");
    const quantityDropdown = quantityInput.parentElement!.children[1].children[0].children[0] as HTMLSelectElement;
    quantityDropdown.click();
    const quantityOption = user.getAllByRole("option")[0];
    quantityOption.scrollIntoView = jest.fn();
    quantityOption.click();

    const saveButton = screen.getByText("Save");
    saveButton.click();

    expect(screen.getByText(firstMapping)).toBeInTheDocument();
  });
});
