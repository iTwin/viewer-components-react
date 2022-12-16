/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import * as moq from "typemoq";
import type { EC3ConfigurationsClient, Report, ReportsClient } from "@itwin/insights-client";
import { EC3JobsClient, ODataClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { EC3Config } from "../components/EC3/EC3Config";
import type { IModelConnection } from "@itwin/core-frontend";
import { Templates } from "../components/Templates";
import { ApiContext } from "../components/api/APIContext";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportsClient = moq.Mock.ofType<ReportsClient>();
const ec3ConfigurationsClient = moq.Mock.ofType<EC3ConfigurationsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

jest.mock("@itwin/insights-client", () => ({
  ...jest.requireActual("@itwin/insights-client"),
  ReportingClient: jest.fn().mockImplementation(() => reportsClient.object),
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
  const config = new EC3Config({ clientId: "", redirectUri: "" });
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportsClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
    ec3ConfigurationsClient.setup(async (x) => x.getConfigurations(accessToken, iTwinId)).returns(async () => mockedConfigurations);
    ec3ConfigurationsClient.setup(async (x) => x.getConfiguration(accessToken, configId)).returns(async () => mockedConfiguration);
  });

  it("Templates view should render successfully", () => {
    render(
      <ApiContext.Provider value={{
        reportsClient: reportsClient.object,
        oDataClient: new ODataClient(),
        ec3ConfigurationsClient: ec3ConfigurationsClient.object,
        ec3JobsClient: new EC3JobsClient(),
        getAccessTokenFn,
      }}>
        <Templates config={config} />
      </ApiContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
  });

  it("Templates view should have mocked templates", async () => {
    render(
      <ApiContext.Provider value={{
        reportsClient: reportsClient.object,
        oDataClient: new ODataClient(),
        ec3ConfigurationsClient: ec3ConfigurationsClient.object,
        ec3JobsClient: new EC3JobsClient(),
        getAccessTokenFn,
      }}>
        <Templates config={config} />
      </ApiContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Templates view should have mocked templates", async () => {
    render(
      <ApiContext.Provider value={{
        reportsClient: reportsClient.object,
        oDataClient: new ODataClient(),
        ec3ConfigurationsClient: ec3ConfigurationsClient.object,
        ec3JobsClient: new EC3JobsClient(),
        getAccessTokenFn,
      }}>
        <Templates config={config} />
      </ApiContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Clicking on template should oper template menu", async () => {
    render(
      <ApiContext.Provider value={{
        reportsClient: reportsClient.object,
        oDataClient: new ODataClient(),
        ec3ConfigurationsClient: ec3ConfigurationsClient.object,
        ec3JobsClient: new EC3JobsClient(),
        getAccessTokenFn,
      }}>
        <Templates config={config} />
      </ApiContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    const configuration = screen.getByText(mockedConfigurations[0].displayName);
    configuration.click();
    expect(screen.getByTestId("ec3-templateDetails")).toBeInTheDocument();
  });

  it("Clicking create button should open creating template menu", async () => {
    render(
      <ApiContext.Provider value={{
        reportsClient: reportsClient.object,
        oDataClient: new ODataClient(),
        ec3ConfigurationsClient: ec3ConfigurationsClient.object,
        ec3JobsClient: new EC3JobsClient(),
        getAccessTokenFn,
      }}>
        <Templates config={config} />
      </ApiContext.Provider>
    );
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    const button = screen.getByText("Create Template");
    button.click();
    expect(screen.getByTestId("ec3-templateDetails")).toBeInTheDocument();
  });
});
