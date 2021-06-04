/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConfigurableCreateInfo, WidgetControl, WidgetState } from "@bentley/ui-framework";
import { PropertyRecord, PropertyValueFormat, PropertyDescription, PropertyValue } from "@bentley/ui-abstract";
import { PropertyGrid, SimplePropertyDataProvider } from "@bentley/ui-components";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { Id64String } from "@bentley/bentleyjs-core";
import { Orientation } from "@bentley/ui-core";
import * as React from "react";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasurementWidgetData, AggregatableValue, WidgetValue } from "../api/Measurement";
import "./MeasurementWidget.scss";

export interface MeasurementWidgetOptions {
  iModelConnection?: IModelConnection;

  /** If a measurement has an "aggretable" property, it will show in a total's group at the top, if there are more than one type of property or more than one instance of a single type. */
  showPropertyAggregates?: boolean;
}

/** A widget control for displaying the PropertyGrid React component */
export class MeasurementWidget extends WidgetControl {
  private _dataProvider: SimplePropertyDataProvider;
  private _showPropertyAggregates: boolean;
  private _lastSelectedCount: number;

  constructor(info: ConfigurableCreateInfo, options: MeasurementWidgetOptions) {
    super(info, options);

    this._showPropertyAggregates = true;
    this._dataProvider = new SimplePropertyDataProvider();
    this._lastSelectedCount = MeasurementSelectionSet.global.measurements.length;
    this._onSelectionChanged = this._onSelectionChanged.bind(this);

    if (options.iModelConnection) {
      MeasurementSelectionSet.global.onChanged.addListener(this._onSelectionChanged);
      MeasurementUIEvents.onMeasurementPropertiesChanged.addListener(this._onSelectionChanged);
      this.reactNode = <PropertyGrid dataProvider={this._dataProvider} orientation={Orientation.Vertical} className={"measurement-widget"} />;
      this._getData(this._lastSelectedCount >= 2).catch();
    }

    if (options.showPropertyAggregates)
      this._showPropertyAggregates = true;
  }

  private async _onSelectionChanged(): Promise<void> {
    // If we are selected more than one measurement at once, it does not make much sense to have the first measurement expanded since we don't necessarily have
    // an order (e.g. user selecting each one by one). So try and detect this if there was nothing selected, and then 2 or more when the event is raised.
    const selectCount = MeasurementSelectionSet.global.measurements.length;
    const collapseAll = (this._lastSelectedCount === 0 && selectCount >= 2) ? true : false;
    this._lastSelectedCount = selectCount;
    return this._getData(collapseAll);
  }

  private async _getData(collapseAll: boolean = false): Promise<void> {
    this._dataProvider.categories = [];
    this._dataProvider.records = {};

    let data: MeasurementWidgetData[] = [];
    let transientIds: Id64String[] = [];

    for (const measurement of MeasurementSelectionSet.global) {
      const mData = await measurement.getDataForMeasurementWidget();
      if (mData && 0 < mData.properties.length && undefined !== measurement.transientId) {
        data.push(mData);
        transientIds.push(measurement.transientId);
      }
    }

    // addProperty will raise onDataChanged. If we have no data, raise it ourselves.
    if (0 === data.length) {
      this._dataProvider.onDataChanged.raiseEvent();
      return;
    }

    // Reverse the order. Last selected measurement should display up top.
    data = data.reverse();
    transientIds = transientIds.reverse();

    this._addAggregateProperties(data);

    for (let i = 0; i < data.length; ++i) {
      const isExpanded = (collapseAll) ? false : i === 0;
      const catIndex = this._dataProvider.addCategory({ expand: isExpanded, label: data[i].title, name: transientIds[i] });
      data[i].properties.map((kv) => this._dataProvider.addProperty(this._createPropertyRecord(kv.label, kv.value), catIndex));
    }
  }

  private _addAggregateProperties(data: MeasurementWidgetData[]): boolean {
    if (!this._showPropertyAggregates)
      return false;

    const orderedAggrPropEntries = new Array<{label: string, prop: AggregatableValue}>();
    const aggregateIndices = new Map<string, number>();
    let hasAtLeastTwoInstances = false;

    // Scan through all the measurement data, collect any properties that we can aggregate
    for (const dataEntry of data) {
      for (const prop of dataEntry.properties) {
        if (!prop.aggregatableValue)
          continue;

        const aggrIndex = aggregateIndices.get(prop.name);
        if (aggrIndex === undefined) {
          aggregateIndices.set(prop.name, orderedAggrPropEntries.length);
          orderedAggrPropEntries.push({label: prop.label, prop: {...prop.aggregatableValue}});
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
    if (data.length > 1 && (orderedAggrPropEntries.length >= 2 || (orderedAggrPropEntries.length === 1 && hasAtLeastTwoInstances))) {
      const catIndex = this._dataProvider.addCategory({ expand: true, label: IModelApp.i18n.translate("MeasureTools:Generic.cumulativeTotals"), name: "cumulativeTotals"});
      for (const entry of orderedAggrPropEntries) {
        const label = entry.label;
        const aggrProp = entry.prop;
        const formattedValue = IModelApp.quantityFormatter.formatQuantity(aggrProp.value, aggrProp.formatSpec);
        this._dataProvider.addProperty(this._createPropertyRecord(label, formattedValue), catIndex);
      }

      return true;
    }

    return false;
  }

  private _createPropertyRecord(displayLabel: string, value: string): PropertyRecord {
    const propValue: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, displayValue: value, value };
    const propDescription: PropertyDescription = { displayLabel, name: displayLabel, typename: "string" };

    const record = new PropertyRecord(propValue, propDescription);
    record.isDisabled = false;
    record.isReadonly = true;
    return record;
  }

  /** Determine the Measurement WidgetState based on the presence of Measurements in the SelectionSet */
  public static widgetStateFunc(): WidgetState {
    const measurementCount = MeasurementSelectionSet.global.size;
    if (0 < measurementCount)
      return WidgetState.Open;

    return WidgetState.Hidden;
  }

  /** Generates a function that determines the state of the widget.
   * * Remembers if the widget has been closed by the user and puts it back to 'Closed' state instead of 'Open'
   */
  public static generateWidgetStateFuncWithMemory(): (state: WidgetState) => WidgetState {
    const obj = new WidgetStateThatRemembersClose();
    return (state: WidgetState) => {
      return obj.widgetStateFunc(state);
    };
  }
}

class WidgetStateThatRemembersClose {
  private _wasClosedByUser = false;

  public widgetStateFunc(state: WidgetState): WidgetState {

    // Selection --> No selection. Remember current state, then hide.
    if (0 === MeasurementSelectionSet.global.size) {
      this._wasClosedByUser = (WidgetState.Closed === state);
      return WidgetState.Hidden;
    }

    // No selection --> Selection. Return the remembered state.
    if (WidgetState.Hidden === state) {
      return this._wasClosedByUser ? WidgetState.Closed : WidgetState.Open;
    }

    // Selection --> Selection
    return state;
  }
}
