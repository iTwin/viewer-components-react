/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import * as moq from "typemoq";
import { EC3Configuration, EC3ConfigurationsClient, ReportsClient } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import type { IModelConnection } from "@itwin/core-frontend";
import { renderWithContext } from "./test-utils";
import TemplateMenu from "../components/TemplateMenu";
import userEvent from '@testing-library/user-event';
import { Configuration, Label } from "../components/Template";

const activeIModelConnection = moq.Mock.ofType<IModelConnection>();
const reportsClient = moq.Mock.ofType<ReportsClient>();
const configClient = moq.Mock.ofType<EC3ConfigurationsClient>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => activeIModelConnection.object,
}));


describe("Templates view", () => {
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

  const iTwinId = faker.datatype.uuid();
  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    activeIModelConnection.setup((x) => x.iTwinId).returns(() => iTwinId);
    reportsClient.setup(async (x) => x.getReports(accessToken, iTwinId)).returns(async () => mockedReports);
    configClient.setup(async (x) => x.getConfiguration(accessToken, configId)).returns(async () => config);
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

  it("Reports should appear in comboBox", async () => {
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

    const rootElement = container.querySelector('.ec3w-report-select-container',) as HTMLDivElement;
    const input = rootElement.querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);

    const items = document.querySelectorAll('.iui-menu-item');
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`report_${index}`);
    });
  });

  it("Selecting name and report should enable save button", async () => {
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

    const button = screen.getByTestId("ec3-save-button") as HTMLInputElement;
    expect(button.disabled).toBe(true);

    Element.prototype.scrollIntoView = jest.fn();
    let rootElement = container.querySelector('.ec3w-report-select-container',) as HTMLDivElement;
    let input = rootElement.querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);
    const item = screen.getByText('report_0');
    await userEvent.click(item);
    expect(input.value).toEqual('report_0');
    expect(button.disabled).toBe(true);

    input = screen.getByTestId('ec3-template-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test Name' } });
    expect(input.value).toEqual('Test Name');
    expect(button.disabled).toBe(false);
  });

  it("Add assembly button opens label action menu", async () => {
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

    const button = screen.getByTestId("ec3-add-assembly-button") as HTMLInputElement;
    expect(button.disabled).toBe(true);

    Element.prototype.scrollIntoView = jest.fn();
    let rootElement = container.querySelector('.ec3w-report-select-container',) as HTMLDivElement;
    let input = rootElement.querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);
    const item = screen.getByText('report_0');
    await userEvent.click(item);
    expect(input.value).toEqual('report_0');
    expect(button.disabled).toBe(false);

    button.click();
    expect(screen.getByTestId("ec3-label-action")).toBeInTheDocument();
  });

  it("Template menu has correct data", async () => {
    const t: Configuration = {
      id: configId,
      displayName: "",
      description: "",
      labels: [],
      reportId: "",
    }
    const { container } = renderWithContext({
      component: < TemplateMenu
        goBack={async () => { }}
        created={true}
        template={t}
      />,
      reportsClient: reportsClient.object,
      getAccessTokenFn: getAccessTokenFn,
    });

    expect(screen.getByTestId("ec3-templateDetails")).toBeDefined();
    expect(screen.getByTestId("ec3-disabled-selection")).toBeDefined();

    let rootElement = container.querySelector('.ec3w-report-select-container',) as HTMLDivElement;
    let input = rootElement.querySelector('.iui-content') as HTMLInputElement;
    expect(input.value).toEqual('report_0');

    input = screen.getByTestId('ec3-template-name-input') as HTMLInputElement;
    expect(input.value).toEqual('mocked_name');

    input = screen.getByTestId('ec3-template-description-input') as HTMLInputElement;
    expect(input.value).toEqual('mocked_description');

    expect(screen.getByText("mocked_label")).toBeInTheDocument();
  });
});
