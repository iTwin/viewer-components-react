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
      // eslint-disable-next-line no-console
      expect(item).toHaveTextContent(`report_${index}`);
    });
  });

  it("Selecting name and report should enable save button, saving calls client", async () => {
    await renderWithContext({
      component: <TemplateMenu onSaveSuccess={jest.fn} onClickCancel={async () => {}} />,
      reportsClient: reportsClient.object,
      oDataClient: oDataClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3w-template-creation-stepper")).toBeDefined();
    expect(screen.getByTestId("ec3-report-selection")).toBeDefined();

    const button: HTMLInputElement = screen.getByTestId("ec3-next-button");
    expect(button.disabled).toBe(true);
    await simulateSelect(screen.getByTestId("ec3-report-selection"), "report_0");
    expect(button.disabled).toBe(true);
    await simulateTextInput(screen.getByTestId("ec3-template-name-input"), "Test Name");
    expect(button.disabled).toBe(false);

    await simulateClick(button);
    oDataClient.verify(async (x) => x.getODataReportMetadata(accessToken, moq.It.isAny()), moq.Times.atLeastOnce());
  });
});
