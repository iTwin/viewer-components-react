/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyDataChangeEvent } from "@itwin/components-react";
import { FilteringPropertyGrid, NonEmptyValuesPropertyDataFilterer, NoopPropertyDataFilterer } from "../../components/FilteringPropertyGrid";
import { createPropertyRecord, render, waitFor } from "../TestUtils";

import type { IPropertyDataProvider } from "@itwin/components-react";

describe("<FilteringPropertyGrid />", () => {
  const provider = {
    onDataChanged: new PropertyDataChangeEvent(),
    getData: async () => {
      return {
        categories: [
          {
            expand: true,
            label: "Test Category",
            name: "test-category",
            childCategories: [
              {
                expand: false,
                label: "Child Category",
                name: "child-category",
              },
            ],
          },
        ],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, value: "Non-null Value", displayValue: "Non-null Value" },
              { name: "test-prop1", displayLabel: "Non-null Prop" },
            ),
            createPropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, value: undefined, displayValue: undefined },
              { name: "test-prop2", displayLabel: "Null Prop" },
            ),
          ],
          ["child-category"]: [
            createPropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, value: "Child Value", displayValue: "Child Value" },
              { name: "child-prop1", displayLabel: "Child Prop" },
            ),
          ],
        },
      };
    },
  } as IPropertyDataProvider;

  it("renders with `NoopPropertyDataFilterer`", async () => {
    const filterer = new NoopPropertyDataFilterer();

    const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={provider} />);

    await waitFor(() => getByText("Non-null Prop"));
    expect(queryByText("Null Prop")).to.not.be.null;
  });

  it("auto expands child categories by default", async () => {
    const filterer = new NoopPropertyDataFilterer();

    const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={provider} />);

    await waitFor(() => getByText("Non-null Prop"));
    expect(queryByText("Null Prop")).to.not.be.null;
    expect(queryByText("Child Prop")).to.not.be.null;
  });

  it("doesn't auto expand child categories when disabled", async () => {
    const filterer = new NoopPropertyDataFilterer();

    const { getByText, queryByText } = render(
      <FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={provider} autoExpandChildCategories={false} />,
    );

    await waitFor(() => getByText("Non-null Prop"));
    expect(queryByText("Null Prop")).to.not.be.null;
    expect(queryByText("Child Prop")).to.be.null;
  });

  describe("with `NonEmptyValuesPropertyDataFilterer`", () => {
    it("filters out `null` primitive properties", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();

      const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={provider} />);

      await waitFor(() => getByText("Non-null Prop"));
      expect(queryByText("Null Prop")).to.be.null;
    });

    it("filters out empty array properties", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();
      const dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => {
          return {
            categories: [
              {
                expand: true,
                label: "Test Category",
                name: "test-category",
              },
            ],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Array,
                    itemsTypeName: "string",
                    items: [
                      createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 1", displayValue: "Item 1" },
                        { name: "item-prop-1", displayLabel: "Non-Empty Item 1" },
                      ),
                      createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 2", displayValue: "Item 2" },
                        { name: "item-prop-2", displayLabel: "Non-Empty Item 2" },
                      ),
                    ],
                  },
                  { name: "test-prop1", displayLabel: "Non-Empty Array Prop" },
                ),
                createPropertyRecord(
                  { valueFormat: PropertyValueFormat.Array, itemsTypeName: "string", items: [] },
                  { name: "test-prop2", displayLabel: "Empty Array Prop" },
                ),
              ],
            },
          };
        },
      } as IPropertyDataProvider;

      const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={dataProvider} />);

      await waitFor(() => getByText(/^Non-Empty Array Prop/));
      expect(queryByText(/^Empty Array Prop/)).to.be.null;
    });

    it("filters out array properties with empty items", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();
      const dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => {
          return {
            categories: [
              {
                expand: true,
                label: "Test Category",
                name: "test-category",
              },
            ],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Array,
                    itemsTypeName: "string",
                    items: [
                      createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 1", displayValue: "Item 1" },
                        { name: "item-prop-1", displayLabel: "Non-Empty Item 1" },
                      ),
                      createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 2", displayValue: "Item 2" },
                        { name: "item-prop-2", displayLabel: "Non-Empty Item 2" },
                      ),
                    ],
                  },
                  { name: "test-prop1", displayLabel: "Non-Empty Array Prop" },
                ),
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Array,
                    itemsTypeName: "string",
                    items: [
                      createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "item-prop-1", displayLabel: "Empty Item 1" }),
                      createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "item-prop-2", displayLabel: "Empty Item 2" }),
                    ],
                  },
                  { name: "test-prop2", displayLabel: "Empty Array Prop" },
                ),
              ],
            },
          };
        },
      } as IPropertyDataProvider;

      const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={dataProvider} />);

      await waitFor(() => getByText(/^Non-Empty Array Prop/));
      expect(queryByText(/^Empty Array Prop/)).to.be.null;
    });

    it("filters out empty struct properties", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();
      const dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => {
          return {
            categories: [
              {
                expand: true,
                label: "Test Category",
                name: "test-category",
              },
            ],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Struct,
                    members: {
                      member1: createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 1", displayValue: "Item 1" },
                        { name: "item-prop-1", displayLabel: "Member Prop 1" },
                      ),
                      member2: createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 2", displayValue: "Item 2" },
                        { name: "item-prop-2", displayLabel: "Member Prop 2" },
                      ),
                    },
                  },
                  { name: "test-prop1", displayLabel: "Non-Empty Struct Prop" },
                ),
                createPropertyRecord({ valueFormat: PropertyValueFormat.Struct, members: {} }, { name: "test-prop2", displayLabel: "Empty Struct Prop" }),
              ],
            },
          };
        },
      } as IPropertyDataProvider;

      const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={dataProvider} />);

      await waitFor(() => getByText("Non-Empty Struct Prop"));
      expect(queryByText("Empty Struct Prop")).to.be.null;
    });

    it("filters out struct properties with empty members", async () => {
      const filterer = new NonEmptyValuesPropertyDataFilterer();
      const dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => {
          return {
            categories: [
              {
                expand: true,
                label: "Test Category",
                name: "test-category",
              },
            ],
            label: PropertyRecord.fromString("Test Instance"),
            records: {
              ["test-category"]: [
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Struct,
                    members: {
                      member1: createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 1", displayValue: "Item 1" },
                        { name: "item-prop-1", displayLabel: "Member Prop 1" },
                      ),
                      member2: createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive, value: "Item 2", displayValue: "Item 2" },
                        { name: "item-prop-2", displayLabel: "Member Prop 2" },
                      ),
                    },
                  },
                  { name: "test-prop1", displayLabel: "Non-Empty Struct Prop" },
                ),
                createPropertyRecord(
                  {
                    valueFormat: PropertyValueFormat.Struct,
                    members: {
                      emptyMember1: createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive },
                        { name: "empty-prop-1", displayLabel: "Empty Member 1" },
                      ),
                      emptyMember2: createPropertyRecord(
                        { valueFormat: PropertyValueFormat.Primitive },
                        { name: "empty-prop-2", displayLabel: "Empty Member 2" },
                      ),
                    },
                  },
                  { name: "test-prop2", displayLabel: "Empty Struct Prop" },
                ),
              ],
            },
          };
        },
      } as IPropertyDataProvider;

      const { getByText, queryByText } = render(<FilteringPropertyGrid height={100} width={100} filterer={filterer} dataProvider={dataProvider} />);

      await waitFor(() => getByText("Non-Empty Struct Prop"));
      expect(queryByText("Empty Struct Prop")).to.be.null;
    });
  });
});
