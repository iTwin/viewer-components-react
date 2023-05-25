/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyDataChangeEvent } from "@itwin/components-react";
import { render, waitFor } from "@testing-library/react";
import { FilteringPropertyGrid, NonEmptyValuesPropertyDataFilterer, NoopPropertyDataFilterer } from "../../property-grid-react";
import { createPropertyRecord } from "../TestUtils";

import type { IPropertyDataProvider } from "@itwin/components-react";

describe("<FilteringPropertyGrid />", () => {
  const provider = {
    onDataChanged: new PropertyDataChangeEvent(),
    getData: async () => {
      return {
        categories: [{
          expand: true,
          label: "Test Category",
          name: "test-category",
          childCategories: [{
            expand: false,
            label: "Child Category",
            name: "child-category",
          }],
        }],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Non-null Value", displayValue: "Non-null Value" }, { name: "test-prop1", displayLabel: "Non-null Prop" }),
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: undefined, displayValue: undefined }, { name: "test-prop2", displayLabel: "Null Prop" }),
          ],
          ["child-category"]: [
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Child Value", displayValue: "Child Value" }, { name: "child-prop1", displayLabel: "Child Prop" }),
          ],
        },
      };
    },
  } as IPropertyDataProvider;

  it("renders with `NoopPropertyDataFilterer`", async () => {
    const filterer = new NoopPropertyDataFilterer();

    const { getByText, queryByText } = render(
      <FilteringPropertyGrid
        height={100}
        width={100}
        filterer={filterer}
        dataProvider={provider}
      />
    );

    await waitFor(() => getByText("Non-null Prop"));
    expect(queryByText("Null Prop")).to.not.be.null;
  });

  it("auto expands child categories by default", async () => {
    const filterer = new NoopPropertyDataFilterer();

    const { getByText, queryByText } = render(
      <FilteringPropertyGrid
        height={100}
        width={100}
        filterer={filterer}
        dataProvider={provider}
      />
    );

    await waitFor(() => getByText("Non-null Prop"));
    expect(queryByText("Null Prop")).to.not.be.null;
    expect(queryByText("Child Prop")).to.not.be.null;
  });

  it("doesn't auto expands child categories when disabled", async () => {
    const filterer = new NoopPropertyDataFilterer();

    const { getByText, queryByText } = render(
      <FilteringPropertyGrid
        height={100}
        width={100}
        filterer={filterer}
        dataProvider={provider}
        autoExpandChildCategories={false}
      />
    );

    await waitFor(() => getByText("Non-null Prop"));
    expect(queryByText("Null Prop")).to.not.be.null;
    expect(queryByText("Child Prop")).to.be.null;
  });

  describe("with `NonEmptyValuesPropertyDataFilterer` filters out", () => {
    it("null primitive properties", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();

      const { getByText, queryByText } = render(
        <FilteringPropertyGrid
          height={100}
          width={100}
          filterer={filterer}
          dataProvider={provider}
        />
      );

      await waitFor(() => getByText("Non-null Prop"));
      expect(queryByText("Null Prop")).to.be.null;
    });

    it ("empty array properties", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();
      const dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => {
          return {
            categories: [{
              expand: true,
              label: "Test Category",
              name: "test-category",
            }],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Array,
                    itemsTypeName: "string",
                    items: [
                      createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Item 1" }, { name: "item-prop-1", displayLabel: "Item Prop 1" }),
                      createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Item 2" }, { name: "item-prop-2", displayLabel: "Item Prop 2" }),
                    ],
                  },
                  { name: "test-prop1", displayLabel: "Non-null Prop" }
                ),
                createPropertyRecord(
                  { valueFormat: PropertyValueFormat.Array, itemsTypeName: "string", items: [] },
                  { name: "test-prop2", displayLabel: "Empty Prop" }
                ),
              ],
            },
          };
        },
      } as IPropertyDataProvider;

      const { getByText, queryByText } = render(
        <FilteringPropertyGrid
          height={100}
          width={100}
          filterer={filterer}
          dataProvider={dataProvider}
        />
      );

      await waitFor(() => getByText("Non-null Prop"));
      expect(queryByText("Empty Prop")).to.be.null;
    });

    it ("empty struct properties", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();
      const dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => {
          return {
            categories: [{
              expand: true,
              label: "Test Category",
              name: "test-category",
            }],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Struct,
                    members: {
                      member1: createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Item 1" }, { name: "item-prop-1", displayLabel: "Item Prop 1" }),
                      member2: createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value: "Item 2" }, { name: "item-prop-2", displayLabel: "Item Prop 2" }),
                    },
                  },
                  { name: "test-prop1", displayLabel: "Non-null Prop" }
                ),
                createPropertyRecord(
                  { valueFormat: PropertyValueFormat.Struct, members: {} },
                  { name: "test-prop2", displayLabel: "Empty Prop" }
                ),
              ],
            },
          };
        },
      } as IPropertyDataProvider;

      const { getByText, queryByText } = render(
        <FilteringPropertyGrid
          height={100}
          width={100}
          filterer={filterer}
          dataProvider={dataProvider}
        />
      );

      await waitFor(() => getByText("Non-null Prop"));
      expect(queryByText("Empty Prop")).to.be.null;
    });
  });
});
