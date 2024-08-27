/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./MeasurementPropertyWidget.scss";
import * as React from "react";
import type { Id64String } from "@itwin/core-bentley";
import { IModelApp, SelectionSetEventType } from "@itwin/core-frontend";
import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { useActiveFrontstageDef, useActiveIModelConnection, WidgetState } from "@itwin/appui-react";
import { SimplePropertyDataProvider, VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { Orientation, ResizableContainerObserver } from "@itwin/core-react";
import type { AggregatableValue, Measurement, MeasurementWidgetData } from "../api/Measurement";
import type { MeasurementSelectionSetEvent } from "../api/MeasurementSelectionSet";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasureTools } from "../MeasureTools";
import { useCallback, useState } from "react";
import type { ActionButtonRendererProps } from "@itwin/components-react";
import { SvgCopy } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import type { PrimitiveValue } from "@itwin/appui-abstract";

/**
 * Props for `MeasureTools`
 * @public
 */
export interface MeasureToolsProps {
  onFeatureUsed?: (feature: string) => void;
}

export function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

export const MeasurementPropertyWidgetId = "measure-tools-property-widget";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MeasurementPropertyWidget = (props: MeasureToolsProps) => {
  const activeIModelConnection = useActiveIModelConnection();
  const [dataProvider] = React.useState(new SimplePropertyDataProvider());
  const [lastSelectedCount, setLastSelectedCount] = React.useState(MeasurementSelectionSet.global.measurements.length);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });

  const createPropertyRecord = (displayLabel: string, value: string): PropertyRecord => {
    const propValue: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, displayValue: value, value };
    const propDescription: PropertyDescription = { displayLabel, name: displayLabel, typename: "string" };

    const record = new PropertyRecord(propValue, propDescription);
    record.isDisabled = false;
    record.isReadonly = true;
    return record;
  };

  const addAggregateProperties = (data: MeasurementWidgetData[]): boolean => {
    const orderedAggrPropEntries = new Array<{ label: string, prop: AggregatableValue }>();
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
        label: MeasureTools.localization.getLocalizedString("MeasureTools:Generic.cumulativeTotals"),
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
      props.onFeatureUsed?.("feature-property-widget-event-no-data");
      dataProvider.onDataChanged.raiseEvent();
      return;
    }
    props.onFeatureUsed?.("feature-property-widget-event-update");
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

  const onSelectionChanged = async (args: MeasurementSelectionSetEvent | Measurement[]) => {
    props.onFeatureUsed?.("feature-selection-set-event-change");
    // Only collapse if we are adding/removing more than one at once
    let collapseAll: boolean;
    if (Array.isArray(args)) {
      // Property value update only
      collapseAll = false;
    } else {
      // Selection event
      switch (args.type) {
        case SelectionSetEventType.Add:
        case SelectionSetEventType.Replace:
          collapseAll = args.added.length !== 1;
          break;
        case SelectionSetEventType.Remove:
          collapseAll = args.removed.length !== 1;
          break;
        default:
          collapseAll = true;
      }
    }

    const selectCount = MeasurementSelectionSet.global.measurements.length;
    setLastSelectedCount(selectCount);
    await getData(collapseAll);
  };

  React.useEffect(() => {
    const remover1 = MeasurementSelectionSet.global.onChanged.addListener(onSelectionChanged);
    const remover2 = MeasurementUIEvents.onMeasurementPropertiesChanged.addListener(onSelectionChanged);

    getData(lastSelectedCount >= 2).catch(() => {
      /* no op */
    });

    return () => {
      remover1();
      remover2();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!activeIModelConnection)
      return;

    return activeIModelConnection.onGlobalOriginChanged.addListener(async () => {
      await getData(false);
    });
  }, [activeIModelConnection]); // eslint-disable-line react-hooks/exhaustive-deps

  const widgetDef = useSpecificWidgetDef(MeasurementPropertyWidgetId);

  React.useEffect(() => {
    if (lastSelectedCount) {
      widgetDef?.setWidgetState(WidgetState.Open);
    } else {
      widgetDef?.setWidgetState(WidgetState.Hidden);
    }
  }, [widgetDef, lastSelectedCount]);

  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  const copyButton = React.useCallback(
    (props: ActionButtonRendererProps) =>
      props.isPropertyHovered && (
        <IconButton
          styleType="borderless"
          onClick={() => {
            const value = props.property.value;
            if (value !== undefined && value.hasOwnProperty("displayValue"))
              navigator.clipboard.writeText((value as PrimitiveValue).displayValue ?? "").catch((_) => {});
          }}
        >
          <SvgCopy />
        </IconButton>
      ),
    [],
  );

  return (
    <div className={"measure-tools-property-widget-container"}>
      <ResizableContainerObserver onResize={handleResize}>
        <VirtualizedPropertyGridWithDataProvider
          dataProvider={dataProvider}
          orientation={Orientation.Vertical}
          height={height}
          width={width}
          isPropertyHoverEnabled
          actionButtonRenderers={[copyButton]}
        />
      </ResizableContainerObserver>
    </div>
  );
};
