/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { cleanup, render, screen, waitForElementToBeRemoved, waitFor } from "@testing-library/react";
import Templates from "../components/Templates";
import TemplateMenu from "../components/TemplateMenu";
import * as moq from "typemoq";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { AuthorizationClient} from "@itwin/core-common";
import { Guid } from "@itwin/core-bentley";
import { ODataEntityResponse, ODataItem, ODataResponse, ReportingClient } from "@itwin/insights-client";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { ReportCollection } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import {  LabeledSelect } from "@itwin/itwinui-react";
import { setupServer } from "msw/node";
import { rest } from "msw";
import userEvent from "@testing-library/user-event";
//import type { ODataResponse } from "./generated/api";

afterAll(() => {
  //server.close();
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

const server = setupServer();

const REPORTS_CONFIG_BASE_URL = "https://api.bentley.com";

const reportsFactory = (): ReportCollection => ({
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


const ODataResponseFactory = (): ODataResponse  => ({
  "@odata.context": "context",
  value: Array.from(
    { length: faker.datatype.number({ min: 3, max: 5 }) },
    (_, index) => ({
      name: `mapping${index}`
    })
  ),
});

const headers = (): Headers => ({
  append: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
  has: jest.fn(),
  set: jest.fn(),
  forEach: jest.fn(),
  entries: jest.fn(),
  keys: jest.fn(),
  values: jest.fn(),
  [Symbol.iterator]: jest.fn(),
});

const headersA = async (): Promise<Headers> => ({
  append: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
  has: jest.fn(),
  set: jest.fn(),
  forEach: jest.fn(),
  entries: jest.fn(),
  keys: jest.fn(),
  values: jest.fn(),
  [Symbol.iterator]: jest.fn(),
});

//const metadataText = async (): Promise<string> => "<?xml version=\"1.0\" encoding=\"utf-8\"?><edmx:Edmx Version=\"4.0\" xmlns:edmx=\"http://docs.oasis-open.org/odata/ns/edmx\"><edmx:DataServices><Schema Namespace=\"Insights_and_Reporting_Extractor\" xmlns=\"http://docs.oasis-open.org/odata/ns/edm\"><EntityType Name=\"map0\"><Property Name=\"ECInstanceId\" Type=\"Edm.String\" /><Property Name=\"ECClassId\" Type=\"Edm.String\" /><Property Name=\"UserLabel\" Type=\"Edm.String\" /><Property Name=\"BBoxLow\" Type=\"Edm.String\" /><Property Name=\"BBoxHigh\" Type=\"Edm.String\" /><Property Name=\"Area\" Type=\"Edm.Double\" /></EntityType></EntityContainer></Schema></edmx:DataServices></edmx:Edmx>"
const metadataText = async (): Promise<string> => "<?xml version=\"1.0\" encoding=\"utf-8\"?><edmx:Edmx Version=\"4.0\" xmlns:edmx=\"http://docs.oasis-open.org/odata/ns/edmx\"><edmx:DataServices><Schema Namespace=\"Insights_and_Reporting_Extractor\" xmlns=\"http://docs.oasis-open.org/odata/ns/edm\"><EntityType Name=\"mapping0\"><Property Name=\"ECInstanceId\" Type=\"Edm.String\" /><Property Name=\"ECClassId\" Type=\"Edm.String\" /><Property Name=\"UserLabel\" Type=\"Edm.String\" /><Property Name=\"BBoxLow\" Type=\"Edm.String\" /><Property Name=\"BBoxHigh\" Type=\"Edm.String\" /><Property Name=\"Area\" Type=\"Edm.Double\" /></EntityType><EntityType Name=\"Demo_RailColumn_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\"><Property Name=\"ECInstanceId\" Type=\"Edm.String\" /><Property Name=\"ECClassId\" Type=\"Edm.String\" /><Property Name=\"UserLabel\" Type=\"Edm.String\" /><Property Name=\"BBoxLow\" Type=\"Edm.String\" /><Property Name=\"BBoxHigh\" Type=\"Edm.String\" /><Property Name=\"Heigth\" Type=\"Edm.Double\" /></EntityType><EntityType Name=\"Demo_RoofBeam_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\"><Property Name=\"ECInstanceId\" Type=\"Edm.String\" /><Property Name=\"ECClassId\" Type=\"Edm.String\" /><Property Name=\"UserLabel\" Type=\"Edm.String\" /><Property Name=\"BBoxLow\" Type=\"Edm.String\" /><Property Name=\"BBoxHigh\" Type=\"Edm.String\" /><Property Name=\"Length\" Type=\"Edm.Double\" /></EntityType><EntityType Name=\"Demo_Slabs_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\"><Property Name=\"ECInstanceId\" Type=\"Edm.String\" /><Property Name=\"ECClassId\" Type=\"Edm.String\" /><Property Name=\"UserLabel\" Type=\"Edm.String\" /><Property Name=\"BBoxLow\" Type=\"Edm.String\" /><Property Name=\"BBoxHigh\" Type=\"Edm.String\" /><Property Name=\"volume\" Type=\"Edm.Double\" /></EntityType></Schema><Schema Namespace=\"Default\" xmlns=\"http://docs.oasis-open.org/odata/ns/edm\"><EntityContainer Name=\"Container\"><EntitySet Name=\"mapping0\" EntityType=\"Insights_and_Reporting_Extractor.mapping0\" /><EntitySet Name=\"Demo_RailColumn_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\" EntityType=\"Insights_and_Reporting_Extractor.Demo_RailColumn_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\" /><EntitySet Name=\"Demo_RoofBeam_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\" EntityType=\"Insights_and_Reporting_Extractor.Demo_RoofBeam_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\" /><EntitySet Name=\"Demo_Slabs_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\" EntityType=\"Insights_and_Reporting_Extractor.Demo_Slabs_Mapping_bd2cc9f9ab5c42e6bc1757b7b7ca5bad\" /></EntityContainer></Schema></edmx:DataServices></edmx:Edmx>";

const fakedMetadata = (): Response => ({
  headers: headers(),
  ok: true,
  redirected: false,
  status: 200,
  statusText: "",
  url: "",
  clone: jest.fn(),
  //response: "",
  type: "basic",
  body: null,
  bodyUsed: false,
  arrayBuffer: jest.fn(),
  blob: jest.fn(),
  formData: jest.fn(),
  json: jest.fn(),
  trailer: headersA(),
  text: metadataText,
});

const mockedReports: ReportCollection = reportsFactory();
const mockedResponses: ODataResponse = ODataResponseFactory();

beforeEach(async () => {
})

const iTwinId = faker.datatype.uuid();
const accessToken = faker.datatype.uuid(); 

const authClient = moq.Mock.ofType<AuthorizationClient>();
const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportingClient = moq.Mock.ofType<ReportingClient>();

const firstMapping = mockedResponses.value[0].name!;

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportingClient: jest.fn().mockImplementation(() => reportingClient.object)
}));

beforeAll(async () => {      

  authClient.setup((x) => x.getAccessToken()).returns(async () => accessToken);
  IModelApp.authorizationClient = authClient.object;

  activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
  
  reportingClient.setup((x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports?.reports!);
  const reportId = mockedReports.reports![0].id!;
  reportingClient.setup((x) => x.getODataReport(accessToken, reportId)).returns(async () => mockedResponses);

  reportingClient.setup((x) => x.getODataReportMetadata(accessToken, reportId)).returns(async () => fakedMetadata());
});

describe("Templates view", function () {

  it("Templates view should render successfully", function () {
    render(<Templates />);
    expect(screen.getByText("Templates")).toBeDefined();
  });

  it("Template Menu should render successfully", async () => {
    const returnfn = async () => {};
    render(<TemplateMenu goBack={returnfn}/>);
    expect(screen.getByText("Create template")).toBeInTheDocument();
  });

  it("Clicking create button should open creating template menu", async () => {
    const user = render(<Templates />);
    const button = screen.getByText("Create Template");
    button.click();
    expect(screen.getByText("Create template")).toBeInTheDocument();
  });

  it("Reports dropdown should be populated with data", async () => {
    const returnfn = async () => {};
    render(<TemplateMenu goBack={returnfn} />);
    await waitForElementToBeRemoved(() => screen.getByText("Loading"));
    const dropdown = screen.getByText("Select report");
    dropdown.click();
    mockedReports.reports!.forEach(report => {
      expect(screen.getByText(report.displayName!)).toBeInTheDocument();
    });
  });

  
  it("Created template should appear in the list", async () => {
    //await new Promise(resolve => setTimeout(resolve, 1000));
    const user = render(<Templates />);
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
    const user = render(<Templates />);
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
