/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { cleanup, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import Templates from "../components/Templates";
import TemplateMenu from "../components/TemplateMenu";
import * as moq from "typemoq";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { AuthorizationClient} from "@itwin/core-common";
import { Guid } from "@itwin/core-bentley";
import { ReportingClient } from "@itwin/insights-client";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { ReportCollection } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import {  LabeledSelect } from "@itwin/itwinui-react";
import { setupServer } from "msw/node";
import { rest } from "msw";


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


const mockedReports: ReportCollection = reportsFactory();




//const r = new reportingClient.object()

beforeEach(async () => {
 


  
})

const iTwinId = faker.datatype.uuid();
const accessToken = faker.datatype.uuid(); 

const authClient = moq.Mock.ofType<AuthorizationClient>();
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

beforeAll(async () => {      



  authClient.setup((x) => x.getAccessToken()).returns(async () => accessToken);
  IModelApp.authorizationClient = authClient.object;

  activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);

  
  reportingClient.setup((x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports?.reports!);


  
  //jest.mock()
  //reportingClient.setup(x => x.repot)
  //(global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
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
 


    //const mockedReports: ReportCollection = reportsFactory();

    
    
    const returnfn = async () => {};
  
    render(<TemplateMenu goBack={returnfn} />);

    
    //const loads = await screen.findAllByText("Loading");
    //if (loads.length > 0)
    //await waitForElementToBeRemoved(() => screen.getByText("Loading"));

    //const dropdown = screen.getByText("Report");
    const dropdown = screen.getByText("Select report");
    await new Promise(resolve => setTimeout(resolve, 1000));
    //const dropdown = screen.getBy
    //dropdown.ariaExpanded = "true";
    dropdown.click();
    //dropdown.click();
    //user.click

    mockedReports.reports!.forEach(report => {
      expect(screen.getByText(report.displayName!)).toBeInTheDocument();
    });
    //expect(screen.getByText(mockedReports.reports![0].displayName + "ASD" ?? "")).toBeInTheDocument();
    //console.log(screen);
    //const dropdown = screen.getByTestId('reportId');
    //console.log(dropdown);
    //const children = dropdown.children;
    //console.log(children);
    
    //expect(children[0].textContent).toBe(options[0].text);


    //const dropDown = screen.getByRole("listbox");
    //expect(dropDown.childElementCount).toBe(mockedReports.reports?.length);
    //const select = screen.getByTestId("reportId");
    //select.
    //(select ).options
    //const horizontalTiles = screen.getAllByTestId("horizontal-tile");


    //expect(screen.getByText("Create template")).toBeInTheDocument();
  });


});
