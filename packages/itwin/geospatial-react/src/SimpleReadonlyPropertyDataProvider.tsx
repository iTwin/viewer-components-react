/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { StructValue } from "@itwin/appui-abstract";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { SimplePropertyDataProvider } from "@itwin/components-react";

type SimpleValuePrimitive = string | number | undefined | SimpleStructValue;
type SimpleStructValue = { [s: string]: SimpleValuePrimitive };

export class SimpleReadonlyPropertyDataProvider extends SimplePropertyDataProvider {
  undefinedValue = "N/A";

  addPropertyRecords(valueMap: SimpleStructValue, category: string) {
    const index = this.getOrAddCategory(category);
    for (const [key, value] of Object.entries(valueMap)) {
      let record: PropertyRecord | undefined;
      const valType = typeof value;
      if (valType === "object") {
        record = this.createStructPropertyRecord(key, value as SimpleStructValue);
      } else if (valType !== "function" && valType !== "symbol") {
        record = this.createPropertyRecord(key, value?.toString() ?? this.undefinedValue);
      }
      if (record) {
        this.addProperty(record, index);
      }
    }
  }

  getOrAddCategory(label: string) {
    const index = this.categories.findIndex((currCategory) => currCategory.label === label);
    if (index >= 0) {
      return index;
    }
    return this.addCategory({ expand: true, label, name: label });
  }

  createPropertyRecord(displayLabel: string, value: string): PropertyRecord {
    const record = new PropertyRecord(
      {
        valueFormat: PropertyValueFormat.Primitive,
        displayValue: value,
        value,
      },
      {
        displayLabel,
        name: displayLabel,
        typename: "string",
      }
    );
    record.isDisabled = false;
    record.isReadonly = true;
    return record;
  }

  createStructPropertyRecord(displayLabel: string, objectValue: SimpleStructValue) {
    const record = new PropertyRecord(this.getStructValue(objectValue), {
      displayLabel,
      name: displayLabel,
      typename: "struct",
    });
    record.isDisabled = false;
    record.isReadonly = true;
    return record;
  }

  getStructValue(objectValue: SimpleStructValue): StructValue {
    const members: {
      [name: string]: PropertyRecord;
    } = {};

    for (const [key, value] of Object.entries(objectValue)) {
      const valType = typeof value;
      if (valType === "object") {
        members[key] = this.createStructPropertyRecord(key, value as SimpleStructValue);
      } else if (valType !== "function" && valType !== "symbol") {
        members[key] = this.createPropertyRecord(key, value?.toString() ?? this.undefinedValue);
      }
    }
    return {
      valueFormat: PropertyValueFormat.Struct,
      members,
    };
  }
}
