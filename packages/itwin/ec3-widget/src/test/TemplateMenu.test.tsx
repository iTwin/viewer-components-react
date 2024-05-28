/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import * as moq from "typemoq";
import type { EC3Configuration, EC3ConfigurationsClient, ODataClient, ReportsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import type { IModelConnection } from "@itwin/core-frontend";
import { getComboboxOptions, mockITwinId, renderWithContext, simulateClick, simulateCombobox, simulateTextInput } from "./test-utils";
import { TemplateMenu } from "../components/TemplateMenu";
import type { Configuration } from "../components/EC3/Template";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportsClient = moq.Mock.ofType<ReportsClient>();
const configClient = moq.Mock.ofType<EC3ConfigurationsClient>();
const oDataClient = moq.Mock.ofType<ODataClient>();

jest.mock("@itwin/itwinui-react", () => ({
  ...jest.requireActual("@itwin/itwinui-react"),
  toaster: {
    positive: (_: string) => {},
    negative: (_: string) => {},
  },
}));

describe("TemplateMenu", () => {
  const mockedReports = Array.from({ length: 5 }, (_, index) => ({
    id: index.toString(),
    displayName: `report_${index}`,
    description: "desc",
    deleted: false,
    _links: {
      project: {
        href: "reportLink",
      },
    },
  }));

  const configId = "1234-1234-1234-1234";
  const config: EC3Configuration = {
    id: configId,
    displayName: "mocked_configuration",
    description: "mocked_description",
    labels: [
      {
        name: "mocked_label",
        reportTable: "",
        elementNameColumn: "",
        elementQuantityColumn: "",
        materials: [],
      },
    ],
    createdBy: "",
    modifiedBy: "",
    createdOn: "",
    modifiedOn: "",
    _links: {
      report: {
        href: "link/reports/0",
      },
    },
  };

  const template: Configuration = {
    id: configId,
    displayName: "",
    description: "",
    labels: [],
    reportId: "",
  };

  const iTwinId = mockITwinId;
  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportsClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
    configClient.setup(async (x) => x.getConfiguration(accessToken, configId)).returns(async () => config);
    configClient.setup(async (x) => x.updateConfiguration(accessToken, configId, moq.It.isAny())).returns(async () => config);
    configClient.setup(async (x) => x.createConfiguration(accessToken, moq.It.isAny())).returns(async () => config);
    oDataClient.setup(async (x) => x.getODataReportMetadata(accessToken, moq.It.isAny())).returns(async () => []);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Template Menu should render successfully for creating template", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
    });
    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();
  });

  it("Template Menu should render successfully for updating template", async () => {
    await renderWithContext({
      component: <TemplateMenu template={template} onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();
  });

  it("Mocked reports should appear in comboBox", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();

    const items = await getComboboxOptions(screen.getByTestId("ec3-enabled-selection"));
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`report_${index}`);
    });
  });

  it("Selecting name and report should enable save button, saving calls client", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();

    const button: HTMLInputElement = screen.getByTestId("ec3-save-button");
    expect(button.disabled).toBe(true);
    await simulateCombobox(screen.getByTestId("ec3-enabled-selection"), "report_0");
    expect(button.disabled).toBe(true);
    await simulateTextInput(screen.getByTestId("ec3-template-name-input"), "Test Name");
    expect(button.disabled).toBe(false);

    await simulateClick(button);
    configClient.verify(async (x) => x.createConfiguration(accessToken, moq.It.isAny()), moq.Times.atLeastOnce());
  });

  it("Add assembly button in enabled after selecting report and it opens label action menu", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();

    const button: HTMLInputElement = screen.getByTestId("ec3-add-assembly-button");
    expect(button.disabled).toBe(true);

    await simulateCombobox(screen.getByTestId("ec3-enabled-selection"), "report_0");
    expect(button.disabled).toBe(false);

    await simulateClick(button);
    expect(screen.getByTestId("ec3-label-action")).toBeInTheDocument();
  });

  it("Template menu displays the data of the selected template", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} template={template} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();

    expect(screen.getByText("report_0")).toBeInTheDocument();

    let input: HTMLInputElement = screen.getByTestId("ec3-template-name-input");
    expect(input.value).toEqual("mocked_configuration");
    input = screen.getByTestId("ec3-template-description-input");
    expect(input.value).toEqual("mocked_description");

    expect(screen.getByText("mocked_label")).toBeInTheDocument();
  });

  it("Clicking on label opens label action menu", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} template={template} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();

    const configuration = screen.getByText(config.labels[0].name);
    await simulateClick(configuration);
    expect(screen.getByTestId("ec3-label-action")).toBeInTheDocument();
  });

  it("Deleting label opens delete modal", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} template={template} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();

    const button = screen.getAllByTestId("ec3-labels-delete-button")[0];
    await simulateClick(button);

    expect(screen.getByTestId("ec3-delete-modal")).toBeInTheDocument();
  });

  it("Saving existing template updates it", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} template={template} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-template-details")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();

    const button = screen.getByTestId("ec3-save-button");
    await simulateClick(button);

    configClient.verify(async (x) => x.updateConfiguration(accessToken, configId, moq.It.isAny()), moq.Times.atLeastOnce());
  });
});
