/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@bentley/ui-abstract";
import { PropertyGrid, SimplePropertyDataProvider } from "@bentley/ui-components";
import { Orientation } from "@bentley/ui-core";
import * as React from "react";
import { AggregatableValue, MeasurementWidgetData } from "../api/Measurement";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";

// tslint:disable-next-line:variable-name
export const MeasurementPropertyWidget = () => {
  const [dataProvider] = React.useState(new SimplePropertyDataProvider());
  const [lastSelectedCount, setLastSelectedCount] = React.useState(MeasurementSelectionSet.global.measurements.length);

  const createPropertyRecord = (displayLabel: string, value: string): PropertyRecord => {
    const propValue: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, displayValue: value, value };
    const propDescription: PropertyDescription = { displayLabel, name: displayLabel, typename: "string" };

    const record = new PropertyRecord(propValue, propDescription);
    record.isDisabled = false;
    record.isReadonly = true;
    return record;
  };

  const addAggregateProperties = (data: MeasurementWidgetData[]): boolean => {
    const orderedAggrPropEntries = new Array<{ label: string; prop: AggregatableValue }>();
    const aggregateIndices = new Map<string, number>();
    let hasAtLeastTwoInstances = false;

    // Scan through all the measurement data, collect any properties that we can aggregate
    for (const dataEntry of data) {
      for (const prop of dataEntry.properties) {
        if (!prop.aggregatableValue) {
          continue;
        }

        const aggrIndex = aggregateIndices.get(prop.name);
        if (aggrIndex === undefined) {
          aggregateIndices.set(prop.name, orderedAggrPropEntries.length);
          orderedAggrPropEntries.push({ label: prop.label, prop: { ...prop.aggregatableValue } });
        } else {
          const aggrProp = orderedAggrPropEntries[aggrIndex];
          if (aggrProp.prop.formatSpec === prop.aggregatableValue.formatSpec) {
            aggrProp.prop.value += prop.aggregatableValue.value;
            hasAtLeastTwoInstances = true;
          }
        }
      }
    }

    // Want to show if either: two types or one type with at least two instances
    if (
      data.length > 1 &&
      (orderedAggrPropEntries.length >= 2 || (orderedAggrPropEntries.length === 1 && hasAtLeastTwoInstances))
    ) {
      const catIndex = dataProvider.addCategory({
        expand: true,
        label: IModelApp.i18n.translate("MeasureTools:Generic.cumulativeTotals"),
        name: "cumulativeTotals",
      });
      for (const entry of orderedAggrPropEntries) {
        const label = entry.label;
        const aggrProp = entry.prop;
        const formattedValue = IModelApp.quantityFormatter.formatQuantity(aggrProp.value, aggrProp.formatSpec);
        dataProvider.addProperty(createPropertyRecord(label, formattedValue), catIndex);
      }

      return true;
    }

    return false;
  };

  const getData = async (collapseAll = false) => {
    dataProvider.categories = [];
    dataProvider.records = {};

    let data: MeasurementWidgetData[] = [];
    let transientIds: Id64String[] = [];

    for (const measurement of MeasurementSelectionSet.global) {
      const mData = await measurement.getDataForMeasurementWidget();
      if (mData?.properties.length && measurement.transientId) {
        data.push(mData);
        transientIds.push(measurement.transientId);
      }
    }

    // addProperty will raise onDataChanged. If we have no data, raise it ourselves.
    if (!data.length) {
      dataProvider.onDataChanged.raiseEvent();
      return;
    }

    // Reverse the order. Last selected measurement should display up top.
    data = data.reverse();
    transientIds = transientIds.reverse();

    addAggregateProperties(data);

    for (let i = 0; i < data.length; ++i) {
      const isExpanded = collapseAll ? false : i === 0;
      const catIndex = dataProvider.addCategory({ expand: isExpanded, label: data[i].title, name: transientIds[i] });
      data[i].properties.map((kv) => dataProvider.addProperty(createPropertyRecord(kv.label, kv.value), catIndex));
    }
  };

  const onSelectionChanged = async () => {
    // If we are selected more than one measurement at once, it does not make much sense to have the first measurement expanded since we don't necessarily have
    // an order (e.g. user selecting each one by one). So try and detect this if there was nothing selected, and then 2 or more when the event is raised.
    const selectCount = MeasurementSelectionSet.global.measurements.length;
    const collapseAll = !lastSelectedCount && selectCount >= 2;
    setLastSelectedCount(selectCount);
    await getData(collapseAll);
  };

  React.useEffect(() => {
    MeasurementSelectionSet.global.onChanged.addListener(onSelectionChanged);
    MeasurementUIEvents.onMeasurementPropertiesChanged.addListener(onSelectionChanged);
    getData(lastSelectedCount >= 2).catch(() => {
      /* no op */
    });
  }, []);

  return <PropertyGrid dataProvider={dataProvider} orientation={Orientation.Vertical} />;
};
