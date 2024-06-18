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
import { getSelectOptions, mockITwinId, renderWithContext, simulateClick, simulateSelect, simulateTextInput } from "./test-utils";
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

  const mockedOdataTables = [
    {
      name: "Roof_RoofGrouping_Mapping_1",
      columns: [
        {
          name: "ECInstanceId",
          type: "Edm.String",
        },
        {
          name: "UserLabel",
          type: "Edm.String",
        },
        {
          name: "area",
          type: "Edm.Double",
        },
        {
          name: "material",
          type: "Edm.String",
        },
      ],
    },
  ];
  const configId = "1234-1234-1234-1234";

  const template: Configuration = {
    id: configId,
    displayName: "TestTemplate",
    description: "",
    labels: [
      {
        elementNameColumn: "UserLabel",
        elementQuantityColumn: "area",
        materials: [{ nameColumn: "material" }],
        name: "TestAssembly",
        reportTable: "Roof_RoofGrouping_Mapping_1",
      },
    ],
    reportId: "0",
  };
  const config: EC3Configuration = {
    id: configId,
    displayName: "mocked_configuration",
    description: "mocked_description",
    labels: template.labels,
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

  const iTwinId = mockITwinId;
  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeEach(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportsClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
    configClient.setup(async (x) => x.getConfiguration(accessToken, configId)).returns(async () => config);
    configClient.setup(async (x) => x.updateConfiguration(accessToken, configId, moq.It.isAny())).returns(async () => config);
    configClient.setup(async (x) => x.createConfiguration(accessToken, moq.It.isAny())).returns(async () => config);
    oDataClient.setup(async (x) => x.getODataReportMetadata(accessToken, moq.It.isAny())).returns(async () => mockedOdataTables);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Template Menu should render successfully for creating template", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
    });
    expect(screen.getByTestId("ec3w-template-creation-stepper")).toBeDefined();
    expect(screen.getByTestId("ec3-report-selection")).toBeDefined();
  });

  it("Template Menu should render successfully for updating template", async () => {
    await renderWithContext({
      component: <TemplateMenu template={template} onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3w-template-creation-stepper")).toBeDefined();
    expect(screen.getByTestId("ec3-report-selection")).toBeDefined();
  });

  it("Mocked reports should appear in comboBox", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3w-template-creation-stepper")).toBeDefined();
    expect(screen.getByTestId("ec3-report-selection")).toBeDefined();

    const items = await getSelectOptions(screen.getByTestId("ec3-report-selection"));
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`report_${index}`);
    });
  });

  it("Creating Assembly should enable save button, saving calls client", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      oDataClient: oDataClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3w-template-creation-stepper")).toBeDefined();
    expect(screen.getByTestId("ec3-report-selection")).toBeDefined();

    const stepOneButton: HTMLInputElement = screen.getByTestId("ec3-step-one-next-button");
    expect(stepOneButton.disabled).toBe(true);
    await simulateSelect(screen.getByTestId("ec3-report-selection"), "report_0");
    expect(stepOneButton.disabled).toBe(true);
    await simulateTextInput(screen.getByTestId("ec3-template-name-input"), "Test Name");
    expect(stepOneButton.disabled).toBe(false);

    await simulateClick(stepOneButton);
    oDataClient.verify(async (x) => x.getODataReportMetadata(accessToken, moq.It.isAny()), moq.Times.atLeastOnce());

    // step-two
    const stepTwoButton: HTMLInputElement = screen.getByTestId("ec3-step-two-next-button");

    expect(screen.getByTestId("ec3-assembly-name-input")).toBeDefined();
    await simulateTextInput(screen.getByTestId("ec3-assembly-name-input"), "TestAssembly");
    expect(stepTwoButton.disabled).toBe(true);
    expect(screen.getByTestId("ec3-report-table-select")).toBeDefined();
    await simulateSelect(screen.getByTestId("ec3-report-table-select"), "Roof_RoofGrouping_Mapping_1");
    expect(stepTwoButton.disabled).toBe(true);
    expect(screen.getByTestId("ec3-element-select")).toBeDefined();
    expect(screen.getByText("UserLabel")).toBeInTheDocument();
    expect(stepTwoButton.disabled).toBe(true);
    expect(screen.getByTestId("ec3-element-quantity-select")).toBeDefined();
    await simulateSelect(screen.getByTestId("ec3-element-quantity-select"), "area");
    expect(stepTwoButton.disabled).toBe(true);
    expect(screen.getByTestId("ec3-material-select")).toBeDefined();
    await simulateSelect(screen.getByTestId("ec3-material-select"), "material");
    expect(stepTwoButton.disabled).toBe(false);
    await simulateClick(stepTwoButton);

    // step-three
    expect(screen.getByTestId("ec3-assembly-name-list")).toBeDefined();
    expect(screen.getByText("TestAssembly")).toBeInTheDocument();
    const stepThreeButton: HTMLInputElement = screen.getByTestId("ec3-save-button");
    expect(stepThreeButton.disabled).toBe(false);
    await simulateClick(stepThreeButton);
    configClient.verify(async (x) => x.createConfiguration(accessToken, moq.It.isAny()), moq.Times.atLeastOnce());
  });

  it("Saving existing template updates it", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} template={template} />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3w-template-creation-stepper")).toBeDefined();
    const stepOneButton: HTMLInputElement = screen.getByTestId("ec3-step-one-next-button");
    expect(stepOneButton.disabled).toBe(false);
    await simulateClick(stepOneButton);

    const stepTwoButton: HTMLInputElement = screen.getByTestId("ec3-step-two-next-button");
    expect(stepTwoButton.disabled).toBe(false);
    await simulateClick(stepTwoButton);

    const stepThreeButton: HTMLInputElement = screen.getByTestId("ec3-save-button");
    expect(stepThreeButton.disabled).toBe(false);
    await simulateClick(stepThreeButton);

    configClient.verify(async (x) => x.updateConfiguration(accessToken, configId, moq.It.isAny()), moq.Times.atLeastOnce());
  });
});
