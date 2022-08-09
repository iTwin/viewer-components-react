/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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
import React from "react";

afterEach(() => cleanup());


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

const authClient = moq.Mock.ofType<AuthorizationClient>();
const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
//const reportingClient = moq.Mock.ofType<ReportingClient>();


jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

/*
jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportingClient: () => reportingClient.object,
}));
*/
//const r = new reportingClient.object()


const iTwinId = Guid.createValue();

beforeAll(async () => {      
  const accessToken = Guid.createValue();
  authClient.setup((x) => x.getAccessToken()).returns(async () => accessToken);
  IModelApp.authorizationClient = authClient.object;

  activeIModelConnection.setup(x => x.iTwinId).returns(() => iTwinId);

  //const mockedReports: ReportCollection = reportsFactory();
  //reportingClient.setup(x => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports?.reports!);

  //jest.mock()
  //reportingClient.setup(x => x.repot)

});

describe("Templates view", function () {

  it("Templates view should render successfully", function () {
    render(<Templates />);
    expect(screen.getByText("Template Name")).toBeDefined();
  });

  it("Template Menu should render successfully", async () => {
    
    const authClient = moq.Mock.ofType<AuthorizationClient>();
    const accessToken = Guid.createValue();
    authClient.setup((x) => x.getAccessToken()).returns(async () => accessToken);
    IModelApp.authorizationClient = authClient.object;

    const returnfn = async () => {};
    render(<TemplateMenu goBack={returnfn}/>);
    expect(screen.getByText("Create template")).toBeInTheDocument();
  });

  it("Clicking create button should open creating template menu", async () => {
    
    const authClient = moq.Mock.ofType<AuthorizationClient>();
    const accessToken = Guid.createValue();
    authClient.setup((x) => x.getAccessToken()).returns(async () => accessToken);
    IModelApp.authorizationClient = authClient.object;
    const user = render(<Templates />);
    const button = screen.getByText("Create Template");
    button.click();
    expect(screen.getByText("Create template")).toBeInTheDocument();
    
  });

  it("Reports dropdown should be populated with data", async () => {
    /*
    const mockedReports: ReportCollection = reportsFactory();

    server.use(
      rest.get(
        `${REPORTS_CONFIG_BASE_URL}/insights/reporting/reports/?projectId=${iTwinId}&deleted=false`,
        async (_req, res, ctx) => {
          return res(ctx.delay(500), ctx.status(200), ctx.json(mockedReports));
        }
      )
    );
    
    const returnfn = async () => {};
  
    render(<TemplateMenu goBack={returnfn} />);

    ///await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    //const dropdown = screen.getByText("Report");
    const dropdown = screen.getByText("Select report");
    //const dropdown = screen.getBy
    //dropdown.ariaExpanded = "true";
    dropdown.click();
    //dropdown.click();
    //user.click
    expect(screen.getByText("Report")).toBeInTheDocument();
    //console.log(screen);
    //const dropdown = screen.getByTestId('reportId');
    //console.log(dropdown);
    //const children = dropdown.children;
    //console.log(children);
    
    //expect(children[0].textContent).toBe(options[0].text);

*/
    //const dropDown = screen.getByRole("listbox");
    //expect(dropDown.childElementCount).toBe(mockedReports.reports?.length);
    //const select = screen.getByTestId("reportId");
    //select.
    //(select ).options
    //const horizontalTiles = screen.getAllByTestId("horizontal-tile");


    //expect(screen.getByText("Create template")).toBeInTheDocument();
  });


});
