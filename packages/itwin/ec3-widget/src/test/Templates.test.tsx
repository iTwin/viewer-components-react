/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, screen } from "@testing-library/react";
import { Templates } from "../components/Templates";
import * as moq from "typemoq";
import type { EC3ConfigurationsClient, EC3Job, EC3JobsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import type { IModelConnection } from "@itwin/core-frontend";
import { mockITwinId, renderWithContext, simulateClick } from "./test-utils";
import type { EC3Token } from "../components/EC3/EC3Token";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const ec3ConfigurationsClient = moq.Mock.ofType<EC3ConfigurationsClient>();
const ec3JobsClient = moq.Mock.ofType<EC3JobsClient>();

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

  const job: EC3Job = {
    id: faker.datatype.uuid(),
    _links: {
      status: {
        href: "status",
      },
    },
  };

  const iTwinId = mockITwinId;
  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    ec3ConfigurationsClient.setup(async (x) => x.getConfigurations(accessToken, iTwinId)).returns(async () => mockedConfigurations);
    ec3ConfigurationsClient.setup(async (x) => x.getConfiguration(accessToken, "0")).returns(async () => mockedConfigurations[0]);
    ec3JobsClient.setup(async (x) => x.createJob(accessToken, moq.It.isAny())).returns(async () => job);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Templates view should render successfully", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
  });

  it("Templates view should have mocked templates", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Templates view should have mocked templates", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    mockedConfigurations.forEach((c) =>
      expect(screen.getByText(c.displayName)).toBeInTheDocument()
    );
  });

  it("Clicking on template should use callback", async () => {
    const onClickTemplateTitle = jest.fn();
    await renderWithContext({
      component: <Templates onClickTemplateTitle={onClickTemplateTitle} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    const configuration = screen.getByText(mockedConfigurations[0].displayName);
    await simulateClick(configuration);
    const expectedTemplate = {
      displayName: mockedConfigurations[0].displayName,
      description: mockedConfigurations[0].description ?? "",
      id: mockedConfigurations[0].id,
      labels: mockedConfigurations[0].labels,
      reportId: mockedConfigurations[0]._links.report.href.split("/reports/")[1],
    };
    expect(onClickTemplateTitle).toBeCalledWith(expectedTemplate);
  });

  it("Clicking create button should use callback", async () => {
    const onClickCreate = jest.fn();
    await renderWithContext({
      component: <Templates onClickCreate={onClickCreate} />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    const button = screen.getByText("New");
    await simulateClick(button);
    expect(onClickCreate).toBeCalled();
  });

  it("Clicking on tile should select it and enable export button", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();

    const button: HTMLInputElement = screen.getByTestId("ec3-export-button");
    expect(button.disabled).toBe(true);

    const configuration = screen.getAllByTestId("ec3-horizontal-tile")[0];
    await simulateClick(configuration);
    expect(configuration.className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");
    expect(button.disabled).toBe(false);
  });

  it("Clicking again or on other tile should deselect", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    const configurations = screen.getAllByTestId("ec3-horizontal-tile");
    await simulateClick(configurations[0]);
    expect(configurations[0].className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    await simulateClick(configurations[1]);
    expect(configurations[0].className).toBe("ec3w-horizontal-tile-container");
    expect(configurations[1].className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    await simulateClick(configurations[2]);
    expect(configurations[1].className).toBe("ec3w-horizontal-tile-container");
  });

  it("Search option filters out configurations", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();

    const searchBar = screen.getByTestId("ec3-search-bar");
    const button = searchBar.querySelector(".iui-button") as HTMLInputElement;
    await simulateClick(button);

    const input = searchBar.querySelector(".iui-input") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "config_0" } });
    });

    const configurations = screen.getAllByTestId("ec3-horizontal-tile");
    expect(configurations.length).toBe(1);
    expect(screen.getByText("config_0")).toBeInTheDocument();
  });

  it("Search bar opens and closes on click", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();
    expect(document.querySelector(".ec3-close-search-bar")).toBe(null);

    const searchBar = screen.getByTestId("ec3-search-bar");
    const button = searchBar.querySelector(".iui-button") as HTMLInputElement;
    await simulateClick(button);

    const closeButton = screen.getByTestId("ec3-close-search-bar");
    await simulateClick(closeButton);

    expect(document.querySelector(".ec3-close-search-bar")).toBe(null);
  });

  it("Deleting report brings up delete modal", async () => {
    await renderWithContext({
      component: <Templates />,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();

    const dropdown = screen.getAllByTestId("ec3-tile-action-button")[0]
      .querySelector(".iui-button") as HTMLInputElement;
    await simulateClick(dropdown);
    const button = screen.getByTestId("ec3-templates-delete-button");
    await simulateClick(button);

    expect(screen.getByTestId("ec3-delete-modal")).toBeInTheDocument();
  });

  it("Exporting and recieving ec3 token opens export modal", async () => {
    const eventListeners: Record<string, Function> = {};
    jest.spyOn(window, "addEventListener").mockImplementation((event, handle, _?) => {
      eventListeners[event] = handle as Function;
    });
    const mockOpen = jest.fn();
    global.window.open = mockOpen;

    await renderWithContext({
      component: <Templates />,
      ec3JobsClient: ec3JobsClient.object,
      ec3ConfigurationsClient: ec3ConfigurationsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-templates")).toBeDefined();

    const configuration = screen.getAllByTestId("ec3-horizontal-tile")[0];
    await simulateClick(configuration);
    expect(configuration.className).toBe("ec3w-horizontal-tile-container ec3w-horizontal-tile-container-selected");

    const button: HTMLInputElement = screen.getByTestId("ec3-export-button");
    expect(button.disabled).toBe(false);
    await simulateClick(button);
    expect(mockOpen).toHaveBeenCalled();

    const ec3Token: EC3Token = {
      token: "ec3_token",
      exp: Date.now() + 10000,
      source: "ec3-auth",
    };
    await act(async () => {
      eventListeners.message({ data: ec3Token });
    });
    expect(screen.getByTestId("ec3-export-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();
  });
});
