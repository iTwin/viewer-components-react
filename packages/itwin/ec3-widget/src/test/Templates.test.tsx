/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import Templates from "../components/Templates";
import * as moq from "typemoq";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { AuthorizationClient } from "@itwin/core-common";
import type { EC3ConfigurationsClient, Report, ReportsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { setupServer } from "msw/node";
import { EC3Config } from "../components/EC3/EC3Config";
import { EC3ConfigurationsClientContext } from "../components/api/context/EC3ConfigurationsClientContext";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportingClient = moq.Mock.ofType<ReportsClient>();
const ec3ConfigurationsClient = moq.Mock.ofType<EC3ConfigurationsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportingClient: jest.fn().mockImplementation(() => reportingClient.object),
}));

describe("Templates view", () => {
  const mockedReports: Report[] = Array.from(
    { length: faker.datatype.number({ min: 3, max: 5 }) },
    (_, index) => ({
      id: `${faker.datatype.uuid()}`,
      displayName: `mOcKRePoRT${index}`,
      description: `mOcKRePoRTDeScRiPtIoN${index}`,
      deleted: false,
      _links: {
        report: {
          href: "",
        },
        project: {
          href: "",
        },
      },
    })
  );

  const configId = faker.datatype.uuid();
  const reportId = mockedReports[0].id;

  const mockedConfigurations = Array.from(
    { length: faker.datatype.number({ min: 3, max: 5 }) },
    (_, index) => ({
      displayName: `config_${index}`,
      description: `config_decription_${index}`,
      id: configId,
      labels: [],
      createdOn: "",
      createdBy: "",
      modifiedBy: "",
      modifiedOn: "",
      _links: {
        report: {
          href: `base_path/reports/${reportId}`,
        },
      },
    })
  );

  const mockedConfiguration = {
    displayName: `config`,
    description: `config_decription`,
    id: configId,
    labels: [],
    createdOn: "",
    createdBy: "",
    modifiedBy: "",
    modifiedOn: "",
    _links: {
      report: {
        href: `base_path/reports/${reportId}`,
      },
    },
  };

  const iTwinId = faker.datatype.uuid();
  const accessToken = faker.datatype.uuid();
  const authClient = moq.Mock.ofType<AuthorizationClient>();
  const server = setupServer();
  const config = new EC3Config({ clientId: "", redirectUri: "" });

  beforeAll(async () => {
    authClient.setup(async (x) => x.getAccessToken()).returns(async () => accessToken);
    IModelApp.authorizationClient = authClient.object;
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportingClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
    ec3ConfigurationsClient.setup(async (x) => x.getConfigurations(accessToken, iTwinId)).returns(async () => mockedConfigurations);
    ec3ConfigurationsClient.setup(async (x) => x.getConfiguration(accessToken, configId)).returns(async () => mockedConfiguration);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("Templates view should render successfully", () => {
    render(
      <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient.object}>
        <Templates config={config} />
      </EC3ConfigurationsClientContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
  });

  it("Templates view should have mocked templates", async () => {
    render(
      <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient.object}>
        <Templates config={config} />
      </EC3ConfigurationsClientContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Templates view should have mocked templates", async () => {
    render(
      <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient.object}>
        <Templates config={config} />
      </EC3ConfigurationsClientContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Clicking on template should oper template menu", async () => {
    render(
      <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient.object}>
        <Templates config={config} />
      </EC3ConfigurationsClientContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    const configuration = screen.getByText(mockedConfigurations[0].displayName);
    configuration.click();
    expect(screen.getByTestId("ec3-templateDetails")).toBeInTheDocument();
  });

  it("Clicking create button should open creating template menu", async () => {
    render(
      <EC3ConfigurationsClientContext.Provider value={ec3ConfigurationsClient.object}>
        <Templates config={config} />
      </EC3ConfigurationsClientContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    const button = screen.getByText("Create Template");
    button.click();
    expect(screen.getByTestId("ec3-templateDetails")).toBeInTheDocument();
  });
});
