/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./PropertyGridContent.scss";
import classnames from "classnames";
import { useMemo, useState } from "react";
import {
  CompositeFilterType,
  CompositePropertyDataFilterer,
  DisplayValuePropertyDataFilterer,
  FilteredType,
  LabelPropertyDataFilterer,
  PropertyCategoryLabelFilterer,
  PropertyValueRendererManager,
} from "@itwin/components-react";
import { Text } from "@itwin/itwinui-react";
import { useActionButtons } from "../hooks/UseActionButtons";
import { useContextMenu } from "../hooks/UseContextMenu";
import { useLoadedInstanceInfo } from "../hooks/UseInstanceInfo";
import { useLatest } from "../hooks/UseLatest";
import { useNullValueSettingContext } from "../hooks/UseNullValuesSetting";
import { useResizeObserver } from "../hooks/UseResizeObserver";
import { useTelemetryContext } from "../hooks/UseTelemetryContext";
import { FilteringPropertyGrid, NonEmptyValuesPropertyDataFilterer } from "./FilteringPropertyGrid";
import { Header } from "./Header";
import { SettingsDropdownMenu } from "./SettingsDropdownMenu";

import type { PropertyGridActionButtonRenderer } from "../hooks/UseActionButtons";
import type { SettingsDropdownMenuProps, SettingsMenuProps } from "./SettingsDropdownMenu";
import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { PropertyCategory, PropertyUpdatedArgs } from "@itwin/components-react";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { FilteringPropertyGridProps } from "./FilteringPropertyGrid";
import type { ContextMenuProps } from "../hooks/UseContextMenu";

/**
 * Arguments for the `onPropertyUpdated` callback.
 * @public
 */
export interface PropertyGridPropertyUpdatedArgs extends PropertyUpdatedArgs {
  /** Data provider used by property grid. */
  dataProvider: IPresentationPropertyDataProvider;
}

/**
 * Base props for rendering `PropertyGridContent` component.
 * @public
 */
export interface PropertyGridContentBaseProps
  extends Omit<
    FilteringPropertyGridProps,
    | "dataProvider"
    | "filterer"
    | "isPropertyHoverEnabled"
    | "isPropertySelectionEnabled"
    | "onPropertyContextMenu"
    | "width"
    | "height"
    | "onPropertyUpdated"
    | "actionButtonRenderers"
  > {
  imodel: IModelConnection;
  className?: string;
  onBackButton?: () => void;
  headerControls?: ReactNode;
  onPropertyUpdated?: (args: PropertyGridPropertyUpdatedArgs, category: PropertyCategory) => Promise<boolean>;
  dataProvider: IPresentationPropertyDataProvider;
  dataRenderer?: (props: FilteringPropertyGridProps) => ReactNode;
  actionButtonRenderers?: PropertyGridActionButtonRenderer[];
}

/**
 * Props for `PropertyGridContent` component.
 * @public
 */
export type PropertyGridContentProps = PropertyGridContentBaseProps & ContextMenuProps & SettingsMenuProps;

/**
 * Component that renders property grid with header and context menu.
 * @internal
 */
export function PropertyGridContent({
  dataProvider,
  imodel,
  contextMenuItems,
  className,
  onBackButton,
  headerControls,
  settingsMenuItems,
  dataRenderer,
  onPropertyUpdated,
  actionButtonRenderers,
  ...props
}: PropertyGridContentProps) {
  const { item } = useLoadedInstanceInfo({ dataProvider });
  const actionButtonRenderersWithExtendedProps = useActionButtons({ dataProvider, actionButtonRenderers });
  const { renderContextMenu, onPropertyContextMenu } = useContextMenu({
    dataProvider,
    imodel,
    contextMenuItems,
  });

  const [filterText, setFilterText] = useState<string>("");
  const { showNullValues } = useNullValueSettingContext();
  const { onFeatureUsed } = useTelemetryContext();
  const filterer = useFilterer({ showNullValues, filterText });
  const { ref, height, width } = useResizeObserver();

  const reportThrottledFiltering = useThrottled(() => onFeatureUsed("filter-properties"), 1000);

  const settingsProps: SettingsDropdownMenuProps = {
    settingsMenuItems,
    dataProvider,
  };

  const dataRendererProps: FilteringPropertyGridProps = {
    ...props,
    actionButtonRenderers: actionButtonRenderersWithExtendedProps,
    dataProvider,
    filterer,
    highlight: filterText ? { highlightedText: filterText, filteredTypes: [FilteredType.Category, FilteredType.Label, FilteredType.Value] } : undefined,
    isPropertyHoverEnabled: true,
    isPropertySelectionEnabled: true,
    onPropertyContextMenu,
    width,
    height,
    onPropertyUpdated: onPropertyUpdated ? async (args, category) => onPropertyUpdated({ ...args, dataProvider }, category) : undefined,
  };

  return (
    <div className={classnames("property-grid-react-container", className)}>
      <PropertyGridHeader
        controls={headerControls}
        item={item}
        onBackButtonClick={onBackButton}
        settingsProps={settingsProps}
        onSearchTextChange={(searchText: string) => {
          if (searchText.length > 0) {
            reportThrottledFiltering();
          }
          setFilterText(searchText);
        }}
      />
      <div ref={ref} className="property-grid-react-data">
        {dataRenderer ? dataRenderer(dataRendererProps) : <FilteringPropertyGrid {...dataRendererProps} />}
      </div>
      {renderContextMenu()}
    </div>
  );
}

interface PropertyGridHeaderProps {
  controls?: ReactNode;
  item?: { className: string; label: PropertyRecord };
  onBackButtonClick?: () => void;
  settingsProps: SettingsDropdownMenuProps;
  onSearchTextChange: (searchText: string) => void;
}

function PropertyGridHeader({ item, controls, settingsProps, onBackButtonClick, onSearchTextChange }: PropertyGridHeaderProps) {
  if (!item) {
    return null;
  }

  const headerTools = (
    <>
      {controls}
      {<SettingsDropdownMenu {...settingsProps} />}
    </>
  );

  const title = (
    <div className="property-grid-header-title">
      <Text variant="leading" className="property-grid-header-title-text">
        {PropertyValueRendererManager.defaultManager.render(item.label)}
      </Text>
      <Text className="property-grid-header-title-text">{item.className}</Text>
    </div>
  );

  return <Header onBackButtonClick={onBackButtonClick} onSearchStringChange={onSearchTextChange} title={title} headerTools={headerTools} />;
}

interface UseFiltererProps {
  showNullValues: boolean;
  filterText: string;
}

function useFilterer({ showNullValues, filterText }: UseFiltererProps) {
  const [defaultFilterers] = useState(() => ({
    nonEmpty: new NonEmptyValuesPropertyDataFilterer(),
  }));

  const compositeFilterer = useMemo(() => {
    const valueFilterer = new DisplayValuePropertyDataFilterer(filterText);
    const labelFilterer = new LabelPropertyDataFilterer(filterText);
    const categoryFilterer = new PropertyCategoryLabelFilterer(filterText);
    const valueAndRecordFilterer = new CompositePropertyDataFilterer(valueFilterer, CompositeFilterType.Or, labelFilterer);
    const textFilterer = new CompositePropertyDataFilterer(valueAndRecordFilterer, CompositeFilterType.Or, categoryFilterer);

    if (!showNullValues) {
      return new CompositePropertyDataFilterer(textFilterer, CompositeFilterType.And, defaultFilterers.nonEmpty);
    }

    return textFilterer;
  }, [defaultFilterers.nonEmpty, filterText, showNullValues]);

  return compositeFilterer;
}

function useThrottled(func: () => void, timeout: number) {
  const isThrottledRef = useLatest(false);

  return () => {
    if (isThrottledRef.current) {
      return;
    }
    isThrottledRef.current = true;
    func();
    setTimeout(() => {
      isThrottledRef.current = false;
    }, timeout);
  };
}
