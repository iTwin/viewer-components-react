/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import * as moq from "typemoq";
import type { EC3ConfigurationsClient, IOdataClient, ODataTable } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { EC3Config } from "../components/EC3/EC3Config";
import type { IModelConnection } from "@itwin/core-frontend";
import { renderWithContext } from "./test-utils";
import LabelAction from "../components/LabelAction";
import { Configuration, Label } from "../components/Template";
import userEvent from "@testing-library/user-event";

const oDataClient = moq.Mock.ofType<IOdataClient>();

describe("LabelAction", () => {
  const reportId = "1111-2222-3333-4444";

  const label: Label = {
    reportTable: "table_0",
    name: "label",
    elementNameColumn: "string_column_0",
    elementQuantityColumn: "number_column_0",
    materials: [],
  }

  const emptyTemplate: Configuration = {
    displayName: "configuration",
    description: "description",
    reportId,
    labels: [],
  }

  const template: Configuration = {
    displayName: "configuration",
    description: "description",
    reportId,
    labels: [label],
  }

  const mockedOData: ODataTable[] = Array.from(
    { length: 5 },
    (_, index) => ({
      name: `table_${index}`,
      columns: [{
        name: `string_column_${index}`,
        type: `Edm.String`,
      }, {
        name: `number_column_${index}`,
        type: `Edm.Double`,
      }]
    })
  );

  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    oDataClient.setup(async (x) => x.getODataReportMetadata(accessToken, reportId)).returns(async () => mockedOData);
  });

  it("Label Action menu should render successfully", () => {
    renderWithContext({
      component: <LabelAction
        template={emptyTemplate}
        label={undefined}
        goBack={async () => { }}
        setTemplate={() => { }}
      />,
      oDataClient: oDataClient.object,
      getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();
  });

  it("Mocked report tables should appear in dropdown", async () => {
    renderWithContext({
      component: <LabelAction
        template={emptyTemplate}
        label={undefined}
        goBack={async () => { }}
        setTemplate={() => { }}
      />,
      oDataClient: oDataClient.object,
      getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const rootElement = screen.getByTestId('ec3-report-table-selector') as HTMLDivElement;
    const input = rootElement.querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);

    const items = document.querySelectorAll('.iui-menu-item');
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`table_${index}`);
    });
  });

  it("Selecting report table should enable other inputs", async () => {
    const { container } = renderWithContext({
      component: <LabelAction
        template={emptyTemplate}
        label={undefined}
        goBack={async () => { }}
        setTemplate={() => { }}
      />,
      oDataClient: oDataClient.object,
      getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const inputs = container.querySelectorAll(".iui-input-container");
    expect(inputs[2].querySelector(".iui-disabled")).toBeInTheDocument();
    expect(inputs[3].querySelector(".iui-disabled")).toBeInTheDocument();
    expect(inputs[4].querySelector(".iui-disabled")).toBeInTheDocument();

    Element.prototype.scrollIntoView = jest.fn();
    let input = inputs[0].querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);
    const item = screen.getByText('table_0');
    await userEvent.click(item);
    expect(input.value).toEqual('table_0');

    expect(inputs[2].querySelector(".iui-disabled")).toBeNull();
    expect(inputs[3].querySelector(".iui-disabled")).toBeNull();
    expect(inputs[4].querySelector(".iui-disabled")).toBeNull();
  });

  it("The correct element name and quantity should appear", async () => {
    const { container } = renderWithContext({
      component: <LabelAction
        template={template}
        label={label}
        goBack={async () => { }}
        setTemplate={() => { }}
      />,
      oDataClient: oDataClient.object,
      getAccessTokenFn
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.getByTestId("ec3-loadingSpinner"));

    const inputs = container.querySelectorAll('.iui-input-with-icon');
    const nameSelect = inputs[1].querySelector(".iui-select-button") as HTMLInputElement;
    const quantitySelect = inputs[2].querySelector(".iui-select-button") as HTMLInputElement;

    await userEvent.click(nameSelect);
    let items = document.querySelectorAll(".iui-menu-item");
    expect(items.length).toBe(1);
    expect(items[0]).toHaveTextContent(`string_column_0`);

    await userEvent.click(quantitySelect);
    items = document.querySelectorAll(".iui-menu-item");
    expect(items.length).toBe(1);
    expect(items[0]).toHaveTextContent(`number_column_0`);
  });
});
