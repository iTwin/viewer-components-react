/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import Templates from "../components/Templates";
import * as moq from "typemoq";
import type { EC3ConfigurationsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { EC3Config } from "../components/EC3/EC3Config";
import type { IModelConnection } from "@itwin/core-frontend";
import { renderWithContext } from "./test-utils";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const ec3ConfigurationsClient = moq.Mock.ofType<EC3ConfigurationsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

describe("Templates view", () => {
  const mockedConfigurations = Array.from(
    { length: faker.datatype.number({ min: 3, max: 5 }) },
    (_, index) => ({
      displayName: `config_${index}`,
      description: `config_decription_${index}`,
      id: index.toString(),
      labels: [],
      createdOn: "",
      createdBy: "",
      modifiedBy: "",
      modifiedOn: "",
      _links: {
        report: {
          href: `base_path/reports/reportId`,
        },
      },
    })
  );

  const iTwinId = faker.datatype.uuid();
  const accessToken = faker.datatype.uuid();
  const config = new EC3Config({ clientId: "", redirectUri: "" });
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    ec3ConfigurationsClient.setup(async (x) => x.getConfigurations(accessToken, iTwinId)).returns(async () => mockedConfigurations);
    ec3ConfigurationsClient.setup(async (x) => x.getConfiguration(accessToken, "0")).returns(async () => mockedConfigurations[0]);
  });

  it("Templates view should render successfully", () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
  });

  it("Templates view should have mocked templates", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Templates view should have mocked templates", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Clicking on template should oper template menu", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    const configuration = screen.getByText(mockedConfigurations[0].displayName);
    configuration.click();
    expect(screen.getByTestId("ec3-templateDetails")).toBeInTheDocument();
  });

  it("Clicking create button should open creating template menu", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    const button = screen.getByText("Create Template");
    button.click();
    expect(screen.getByTestId("ec3-templateDetails")).toBeInTheDocument();
  });

  it("Clicking on tile should select it", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    const configuration = screen.getAllByTestId("horizontal-tile")[0];
    configuration.click();
    expect(configuration.className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");
  });

  it("Clicking again or on other tile should deselect", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    const configurations = screen.getAllByTestId("horizontal-tile");
    configurations[0].click();
    expect(configurations[0].className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    configurations[1].click();
    expect(configurations[0].className).toBe("ec3w-horizontal-tile-container");
    expect(configurations[1].className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    configurations[1].click();
    expect(configurations[1].className).toBe("ec3w-horizontal-tile-container");
  });
});
