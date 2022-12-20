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
import { renderWithContext } from "./test-utils";
import { LabelAction } from "../components/LabelAction";
import { Configuration, Label, Material } from "../components/Template";
import userEvent from "@testing-library/user-event";

const oDataClient = moq.Mock.ofType<IOdataClient>();

describe("LabelAction", () => {
  const reportId = "1111-2222-3333-4444";

  const material: Material = {
    nameColumn: "material_0"
  }

  const label: Label = {
    reportTable: "table_0",
    name: "label",
    elementNameColumn: "string_column_0",
    elementQuantityColumn: "number_column_0",
    materials: [material],
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
      }, {
        name: `material_${index}`,
        type: `Edm.String`,
      }, {
        name: `extra_material_${index}`,
        type: `Edm.String`,
      }]
    })
  );

  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    Element.prototype.scrollIntoView = jest.fn();
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

    const rootElement = screen.getByTestId('ec3-report-table-select') as HTMLDivElement;
    const input = rootElement.querySelector('.iui-input') as HTMLInputElement;
    fireEvent.focus(input);

    const items = document.querySelectorAll('.iui-menu-item');
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`table_${index}`);
    });
  });

  it("Selecting report table should enable other inputs", async () => {
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

    const rootElement = screen.getByTestId("ec3-report-table-select");
    const reportTableInput = rootElement.querySelector(".iui-input") as HTMLInputElement;
    const elementInput = screen.getByTestId("ec3-element-select");
    const elementQuantityInput = screen.getByTestId("ec3-element-quantity-select");
    const dropdownTileInput = screen.getByTestId("ec3-dropdown-tile-select");

    expect(elementInput.querySelector(".iui-disabled")).toBeInTheDocument();
    expect(elementQuantityInput.querySelector(".iui-disabled")).toBeInTheDocument();
    expect(dropdownTileInput.querySelector(".iui-disabled")).toBeInTheDocument();

    fireEvent.focus(reportTableInput);
    const item = screen.getByText('table_0');
    await userEvent.click(item);
    expect(reportTableInput.value).toEqual('table_0');

    expect(elementInput.querySelector(".iui-disabled")).toBeNull();
    expect(elementQuantityInput.querySelector(".iui-disabled")).toBeNull();
    expect(dropdownTileInput.querySelector(".iui-disabled")).toBeNull();
  });

  it("The correct element name and quantity should appear", async () => {
    renderWithContext({
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

    const nameSelect = screen.getByTestId("ec3-element-select")
      .querySelector(".iui-select-button") as HTMLInputElement;
    const quantitySelect = screen.getByTestId("ec3-element-quantity-select")
      .querySelector(".iui-select-button") as HTMLInputElement;

    await userEvent.click(nameSelect);
    let items = document.querySelectorAll(".iui-menu-item");
    expect(items.length).toBe(2);
    expect(items[0]).toHaveTextContent(`extra_material_0`);
    expect(items[1]).toHaveTextContent(`string_column_0`);

    await userEvent.click(quantitySelect);
    items = document.querySelectorAll(".iui-menu-item");
    expect(items.length).toBe(1);
    expect(items[0]).toHaveTextContent(`number_column_0`);
  });

  it("Selected label properties should be displayed correctly", async () => {
    renderWithContext({
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

    const reportTableInput = screen.getByTestId("ec3-report-table-select")
      .querySelector(".iui-input") as HTMLInputElement;
    const elementInput = screen.getByTestId("ec3-element-select")
      .querySelector(".iui-content") as HTMLInputElement;
    const elementQuantityInput = screen.getByTestId("ec3-element-quantity-select")
      .querySelector(".iui-content") as HTMLInputElement;
    const dropdownTileInput = screen.getByTestId("ec3-dropdown-tile-select")
      .querySelector(".iui-content") as HTMLInputElement;

    expect(reportTableInput.value).toEqual(label.reportTable);
    expect(elementInput).toHaveTextContent(label.elementNameColumn);
    expect(elementQuantityInput).toHaveTextContent(label.elementQuantityColumn);
    expect(dropdownTileInput).toHaveTextContent(material.nameColumn!);
  });

  it("Filling out required fields enables add material and save buttons", async () => {
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

    const reportTableInput = screen.getByTestId("ec3-report-table-select")
      .querySelector(".iui-input") as HTMLInputElement;
    const elementInput = screen.getByTestId("ec3-element-select")
      .querySelector(".iui-select-button") as HTMLInputElement;
    const elementQuantityInput = screen.getByTestId("ec3-element-quantity-select")
      .querySelector(".iui-select-button") as HTMLInputElement;
    const dropdownTileInput = screen.getByTestId("ec3-dropdown-tile-select")
      .querySelector(".iui-select-button") as HTMLInputElement;
    const saveButton = screen.getByTestId("ec3-save-button") as HTMLInputElement;
    const addButton = screen.getByTestId("ec3-add-material-button") as HTMLInputElement;

    expect(saveButton.disabled).toBe(true);
    expect(addButton.disabled).toBe(true);

    fireEvent.focus(reportTableInput);
    let item = screen.getByText('table_0');
    await userEvent.click(item);
    expect(reportTableInput.value).toEqual('table_0');

    await userEvent.click(elementInput);
    item = screen.getByText('string_column_0');
    await userEvent.click(item);
    expect(elementInput.querySelector(".iui-content")).toHaveTextContent('string_column_0');

    await userEvent.click(elementQuantityInput);
    item = screen.getByText('number_column_0');
    await userEvent.click(item);
    expect(elementQuantityInput.querySelector(".iui-content")).toHaveTextContent('number_column_0');

    await userEvent.click(dropdownTileInput);
    item = screen.getByText('material_0');
    await userEvent.click(item);
    expect(dropdownTileInput.querySelector(".iui-content")).toHaveTextContent('material_0');

    expect(saveButton.disabled).toBe(false);
    expect(addButton.disabled).toBe(false);
  });

  it("Adding material allows deletion, deletion brings up delete modal", async () => {
    renderWithContext({
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

    const addButton = screen.getByTestId("ec3-add-material-button") as HTMLInputElement;
    await userEvent.click(addButton);

    const dropdowns = screen.getAllByTestId("ec3-dropdown-tile-select");
    expect(dropdowns.length).toBe(label.materials.length + 1);
    const newDropdown = dropdowns[label.materials.length]
      .querySelector(".iui-select-button") as HTMLInputElement;

    await userEvent.click(newDropdown);
    const item = screen.getByText('extra_material_0');
    await userEvent.click(item);
    expect(newDropdown.querySelector(".iui-content")).toHaveTextContent('extra_material_0');

    const buttons = screen.getAllByTestId("ec3-materials-delete-button") as HTMLInputElement[];
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    await userEvent.click(buttons[1]);

    expect(screen.getByTestId("ec3-delete-modal")).toBeInTheDocument();
  });
});
