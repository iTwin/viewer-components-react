/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { Templates } from "../components/Templates";
import * as moq from "typemoq";
import type { EC3ConfigurationsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { EC3Config } from "../components/EC3/EC3Config";
import type { IModelConnection } from "@itwin/core-frontend";
import { renderWithContext } from "./test-utils";
import userEvent from "@testing-library/user-event";
import { EC3Token } from "../components/EC3/EC3Token";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const ec3ConfigurationsClient = moq.Mock.ofType<EC3ConfigurationsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

describe("Templates", () => {
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

  it("Clicking on tile should select it and enable export button", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));

    const button = screen.getByTestId("ec3-export-button") as HTMLInputElement;
    expect(button.disabled).toBe(true);

    const configuration = screen.getAllByTestId("ec3-horizontal-tile")[0];
    configuration.click();
    expect(configuration.className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");
    expect(button.disabled).toBe(false);
  });

  it("Clicking again or on other tile should deselect", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    const configurations = screen.getAllByTestId("ec3-horizontal-tile");
    configurations[0].click();
    expect(configurations[0].className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    configurations[1].click();
    expect(configurations[0].className).toBe("ec3w-horizontal-tile-container");
    expect(configurations[1].className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    configurations[1].click();
    expect(configurations[1].className).toBe("ec3w-horizontal-tile-container");
  });

  it("Search option filters out configurations", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));

    const searchBar = screen.getByTestId("ec3-search-bar");
    const button = searchBar.querySelector(".iui-button") as HTMLInputElement;
    button.click();

    const input = searchBar.querySelector(".iui-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'config_0' } });

    const configurations = screen.getAllByTestId("ec3-horizontal-tile");
    expect(configurations.length).toBe(1);
    expect(screen.getByText("config_0")).toBeInTheDocument();
  });

  it("Search bar opens and closes on click", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));
    expect(document.querySelector(".ec3-close-search-bar")).toBe(null);

    const searchBar = screen.getByTestId("ec3-search-bar");
    const button = searchBar.querySelector(".iui-button") as HTMLInputElement;
    button.click();

    const closeButton = screen.getByTestId("ec3-close-search-bar");
    closeButton.click();

    expect(document.querySelector(".ec3-close-search-bar")).toBe(null);
  });

  it("Deleting report brings up delete modal", async () => {
    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));

    const dropdown = screen.getAllByTestId("tile-action-button")[0]
      .querySelector(".iui-button") as HTMLInputElement;
    await userEvent.click(dropdown);
    const button = screen.getByTestId("ec3-templates-delete-button");
    await userEvent.click(button);

    expect(screen.getByTestId("ec3-delete-modal")).toBeInTheDocument();
  });

  it("Exporting and recieving ec3 token opens export modal", async () => {
    const eventListeners: Record<string, Function> = {};
    jest.spyOn(window, 'addEventListener').mockImplementation((event, handle, _?) => {
      // @ts-ignore
      eventListeners[event] = handle;
    });
    const mockOpen = jest.fn();
    global.window.open = mockOpen;

    renderWithContext({
      component: < Templates config={config} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn: getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loading"));

    const configuration = screen.getAllByTestId("ec3-horizontal-tile")[0];
    configuration.click();
    expect(configuration.className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    const button = screen.getByTestId("ec3-export-button") as HTMLInputElement;
    expect(button.disabled).toBe(false);
    await userEvent.click(button);
    expect(mockOpen).toHaveBeenCalled();

    const ec3Token: EC3Token = {
      token: "ec3_token",
      exp: Date.now() + 10000,
      source: "ec3-auth",
    };
    eventListeners['message']({ data: ec3Token });
    expect(screen.getByTestId("ec3-export-modal")).toBeDefined();
    expect(document.querySelectorAll('.iui-dialog-visible')).toBeDefined();
  });
});