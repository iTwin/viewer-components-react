/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import * as moq from "typemoq";
import { EC3Configuration, EC3ConfigurationsClient, EC3ConfigurationUpdate, ReportsClient, ReportUpdate } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import type { IModelConnection } from "@itwin/core-frontend";
import { getComboboxOptions, renderWithContext, simulateCombobox, simulateInput, simulateTextInput } from "./test-utils";
import { TemplateMenu } from "../components/TemplateMenu";
import userEvent from '@testing-library/user-event';
import { Configuration, convertConfigurationUpdate, Label } from "../components/Template";
import { Templates } from "../components/Templates";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportsClient = moq.Mock.ofType<ReportsClient>();
const configClient = moq.Mock.ofType<EC3ConfigurationsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));

jest.mock("@itwin/itwinui-react", () => ({
  ...jest.requireActual("@itwin/itwinui-react"),
  toaster: {
    positive: (_: string) => { },
    negative: (_: string) => { },
  },
}));

describe("TemplatesMenu", () => {
  const mockedReports = Array.from(
    { length: 5 },
    (_, index) => ({
      id: index.toString(),
      displayName: "report_" + index,
      description: "desc",
      deleted: false,
      _links: {
        project: {
          href: "reportLink"
        }
      }
    })
  );

  const configId = "1234-1234-1234-1234";
  const config: EC3Configuration = {
    id: configId,
    displayName: "mocked_configuration",
    description: "mocked_description",
    labels: [{
      name: "mocked_label",
      reportTable: "",
      elementNameColumn: "",
      elementQuantityColumn: "",
      materials: []
    }],
    createdBy: "",
    modifiedBy: "",
    createdOn: "",
    modifiedOn: "",
    _links: {
      report: {
        href: "link/reports/0",
      },
    },
  }

  const template: Configuration = {
    id: configId,
    displayName: "",
    description: "",
    labels: [],
    reportId: "",
  }

  const iTwinId = faker.datatype.uuid();
  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    Element.prototype.scrollIntoView = jest.fn();
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportsClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
    configClient.setup(async (x) => x.getConfiguration(accessToken, configId)).returns(async () => config);
    configClient.setup(x => x.updateConfiguration(accessToken, configId, moq.It.isAny())).returns(async () => config);
    configClient.setup(x => x.createConfiguration(accessToken, moq.It.isAny())).returns(async () => config);
  });

  it("Template Menu should render successfully for creating template", async () => {
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={false}
      />
    });
    expect(container.querySelector("ec3-templateDetails")).toBeDefined();
    expect(container.querySelector(".ec3-enabled-selection")).toBeDefined();
  });

  it("Template Menu should render successfully for updating template", async () => {
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
      />
    });
    expect(container.querySelector(".ec3-templateDetails")).toBeDefined();
    expect(container.querySelector(".ec3-disabled-selection")).toBeDefined();
  });

  it("Mocked reports should appear in comboBox", async () => {
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={false}
      />,
      reportsClient: reportsClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const items = getComboboxOptions(screen.getByTestId("ec3-enabled-selection"));
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`report_${index}`);
    });
  });

  it("Selecting name and report should enable save button, saving calls client", async () => {
    renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={false}
      />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const button = screen.getByTestId("ec3-save-button") as HTMLInputElement;
    expect(button.disabled).toBe(true);
    await simulateCombobox(screen.getByTestId("ec3-enabled-selection"), "report_0");
    expect(button.disabled).toBe(true);
    await simulateTextInput(screen.getByTestId('ec3-template-name-input'), "Test Name");
    expect(button.disabled).toBe(false);

    await userEvent.click(button);
    configClient.verify(x => x.createConfiguration(accessToken, moq.It.isAny()), moq.Times.atLeastOnce());
  });

  it("Add assembly button opens label action menu", async () => {
    renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={false}
      />,
      reportsClient: reportsClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-enabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const button = screen.getByTestId("ec3-add-assembly-button") as HTMLInputElement;
    expect(button.disabled).toBe(true);

    await simulateCombobox(screen.getByTestId("ec3-enabled-selection"), "report_0");
    expect(button.disabled).toBe(false);

    button.click();
    expect(screen.getByTestId("ec3-label-action")).toBeInTheDocument();
  });

  it("Template menu has correct data", async () => {
    renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
        template={template}
      />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    expect(screen.getByText("report_0")).toBeInTheDocument();

    let input = screen.getByTestId('ec3-template-name-input') as HTMLInputElement;
    expect(input.value).toEqual('mocked_configuration');
    input = screen.getByTestId('ec3-template-description-input') as HTMLInputElement;
    expect(input.value).toEqual('mocked_description');

    expect(screen.getByText("mocked_label")).toBeInTheDocument();
  });

  it("Clicking on label opens label action menu", async () => {
    renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
        template={template}
      />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const configuration = screen.getByText(config.labels[0].name);
    configuration.click();
    expect(screen.getByTestId("ec3-label-action")).toBeInTheDocument();
  });

  it("Deleting label opens delete modal", async () => {
    renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
        template={template}
      />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const button = screen.getAllByTestId("ec3-labels-delete-button")[0];
    await userEvent.click(button);

    expect(screen.getByTestId("ec3-delete-modal")).toBeInTheDocument();
  });

  it("Saving existing template updates it", async () => {
    renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
        template={template}
      />,
      reportsClient: reportsClient.object,
      ec3ConfigurationsClient: configClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const button = screen.getByTestId("ec3-save-button");
    await userEvent.click(button);

    configClient.verify(x => x.updateConfiguration(accessToken, configId, moq.It.isAny()), moq.Times.atLeastOnce());
  });
});
