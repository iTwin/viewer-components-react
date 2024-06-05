/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import * as moq from "typemoq";
import type { EC3ConfigurationLabel, EC3ConfigurationMaterial, IOdataClient, ODataTable } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { getComboboxOptions, getInputOptions, renderWithContext, simulateClick, simulateCombobox, simulateInput } from "./test-utils";
import { LabelAction } from "../components/LabelAction";
import type { Configuration } from "../components/EC3/Template";

const oDataClient = moq.Mock.ofType<IOdataClient>();

describe("LabelAction", () => {
  const reportId = faker.datatype.uuid();

  const material: EC3ConfigurationMaterial = {
    nameColumn: "material_0",
  };

  const label: EC3ConfigurationLabel = {
    reportTable: "table_0",
    name: "label",
    elementNameColumn: "string_column_0",
    elementQuantityColumn: "number_column_0",
    materials: [material],
  };

  const emptyTemplate: Configuration = {
    displayName: "configuration",
    description: "description",
    reportId,
    labels: [],
  };

  const template: Configuration = {
    displayName: "configuration",
    description: "description",
    reportId,
    labels: [label],
  };

  const mockedOData: ODataTable[] = Array.from({ length: 5 }, (_, index) => ({
    name: `table_${index}`,
    columns: [
      {
        name: `string_column_${index}`,
        type: `Edm.String`,
      },
      {
        name: `number_column_${index}`,
        type: `Edm.Double`,
      },
      {
        name: `material_${index}`,
        type: `Edm.String`,
      },
      {
        name: `extra_material_${index}`,
        type: `Edm.String`,
      },
    ],
  }));

  const accessToken = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    oDataClient.setup(async (x) => x.getODataReportMetadata(accessToken, reportId)).returns(async () => mockedOData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Label Action menu should render successfully", async () => {
    await renderWithContext({
      component: <LabelAction template={emptyTemplate} label={undefined} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();
  });

  it("Mocked report tables should appear in comboBox", async () => {
    await renderWithContext({
      component: <LabelAction template={emptyTemplate} label={undefined} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    const items = await getComboboxOptions(screen.getByTestId("ec3-report-table-select"));
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(`table_${index}`);
    });
  });

  it("Selecting report table should enable other inputs", async () => {
    await renderWithContext({
      component: <LabelAction template={emptyTemplate} label={undefined} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    const elementInput = screen.getByTestId("ec3-element-select");
    const elementQuantityInput = screen.getByTestId("ec3-element-quantity-select");
    const dropdownTileInput = screen.getByTestId("ec3-dropdown-tile-select");

    expect(elementInput.querySelector('[aria-disabled="true"]')).toBeInTheDocument();
    expect(elementQuantityInput.querySelector('[aria-disabled="true"]')).toBeInTheDocument();
    expect(dropdownTileInput.querySelector('[aria-disabled="true"]')).toBeInTheDocument();

    await simulateCombobox(screen.getByTestId("ec3-report-table-select"), "table_0");

    expect(elementInput.querySelector('[aria-disabled="true"]')).toBeNull();
    expect(elementQuantityInput.querySelector('[aria-disabled="true"]')).toBeNull();
    expect(dropdownTileInput.querySelector('[aria-disabled="true"]')).toBeNull();
  });

  it("String colunms appear in the element select, number collumns in the quantity select", async () => {
    await renderWithContext({
      component: <LabelAction template={template} label={label} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    let items = await getInputOptions(screen.getByTestId("ec3-element-select"));
    expect(items.length).toBe(2);
    expect(items[0]).toHaveTextContent(`extra_material_0`);
    expect(items[1]).toHaveTextContent(`string_column_0`);

    items = await getInputOptions(screen.getByTestId("ec3-element-quantity-select"));
    expect(items.length).toBe(1);
    expect(items[0]).toHaveTextContent(`number_column_0`);
  });

  it("Selected label properties should be displayed in the inputs", async () => {
    await renderWithContext({
      component: <LabelAction template={template} label={label} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    const reportTableInput = screen.getByTestId("ec3-report-table-select").querySelector(".iui-input") as HTMLInputElement;
    const elementInput = screen.getByTestId("ec3-element-select").querySelector(".iui-content") as HTMLInputElement;
    const elementQuantityInput = screen.getByTestId("ec3-element-quantity-select").querySelector(".iui-content") as HTMLInputElement;
    const dropdownTileInput = screen.getByTestId("ec3-dropdown-tile-select").querySelector(".iui-content") as HTMLInputElement;

    expect(reportTableInput.value).toEqual(label.reportTable);
    expect(elementInput).toHaveTextContent(label.elementNameColumn);
    expect(elementQuantityInput).toHaveTextContent(label.elementQuantityColumn);
    expect(dropdownTileInput).toHaveTextContent(material.nameColumn);
  });

  it("Filling out required fields enables add material and save buttons", async () => {
    await renderWithContext({
      component: <LabelAction template={emptyTemplate} label={undefined} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    const saveButton: HTMLInputElement = screen.getByTestId("ec3-save-button");
    const addButton: HTMLInputElement = screen.getByTestId("ec3-add-material-button");
    expect(saveButton.disabled).toBe(true);
    expect(addButton.disabled).toBe(true);

    await simulateCombobox(screen.getByTestId("ec3-report-table-select"), "table_0");
    await simulateInput(screen.getByTestId("ec3-element-select"), "string_column_0");
    await simulateInput(screen.getByTestId("ec3-element-quantity-select"), "number_column_0");
    await simulateInput(screen.getByTestId("ec3-dropdown-tile-select"), "material_0");

    expect(saveButton.disabled).toBe(false);
    expect(addButton.disabled).toBe(false);
  });

  it("Adding material allows deletion, deletion brings up delete modal", async () => {
    await renderWithContext({
      component: <LabelAction template={template} label={label} onClose={async () => {}} setTemplate={() => {}} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    const addButton = screen.getByTestId("ec3-add-material-button");
    await simulateClick(addButton);

    const dropdowns = screen.getAllByTestId("ec3-dropdown-tile-select");
    expect(dropdowns.length).toBe(label.materials.length + 1);
    const newDropdown = dropdowns[label.materials.length];
    await simulateInput(newDropdown, "extra_material_0");

    const buttons: HTMLInputElement[] = screen.getAllByTestId("ec3-materials-delete-button");
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[dropdowns.length - 1].disabled).toBe(false);
    await simulateClick(buttons[dropdowns.length - 1]);

    expect(screen.getByTestId("ec3-delete-modal")).toBeInTheDocument();
  });

  it("Saving updates the template state", async () => {
    const setter = jest.fn();
    await renderWithContext({
      component: <LabelAction template={template} label={label} onClose={async () => {}} setTemplate={setter} />,
      oDataClient: oDataClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-label-action")).toBeDefined();

    await simulateCombobox(screen.getByTestId("ec3-report-table-select"), "table_1");
    await simulateInput(screen.getByTestId("ec3-element-select"), "string_column_1");
    await simulateInput(screen.getByTestId("ec3-element-quantity-select"), "number_column_1");
    await simulateInput(screen.getByTestId("ec3-dropdown-tile-select"), "material_1");

    const button = screen.getByTestId("ec3-save-button");
    await simulateClick(button);

    const expectedArg = template;
    template.labels = [
      {
        name: label.name,
        reportTable: "table_1",
        elementNameColumn: "string_column_1",
        elementQuantityColumn: "number_column_1",
        materials: [
          {
            nameColumn: "material_1",
          },
        ],
      },
    ];
    expect(setter).toHaveBeenCalledWith(expectedArg);
  });
});
