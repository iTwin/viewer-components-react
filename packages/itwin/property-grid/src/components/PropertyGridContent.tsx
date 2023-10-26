/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGridContent.scss";
import classnames from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompositeFilterType, CompositePropertyDataFilterer, DisplayValuePropertyDataFilterer, FilteredType, LabelPropertyDataFilterer, PropertyCategoryLabelFilterer, PropertyValueRendererManager } from "@itwin/components-react";
import { ResizableContainerObserver } from "@itwin/core-react";
import { SearchBox, Text } from "@itwin/itwinui-react";
import { useContextMenu } from "../hooks/UseContextMenu";
import { useLoadedInstanceInfo } from "../hooks/UseInstanceInfo";
import { useNullValueSettingContext } from "../hooks/UseNullValuesSetting";
import { FilteringPropertyGrid, NonEmptyValuesPropertyDataFilterer } from "./FilteringPropertyGrid";
import { Header } from "./Header";
import { SettingsDropdownMenu } from "./SettingsDropdownMenu";

import type { SettingsDropdownMenuProps, SettingsMenuProps } from "./SettingsDropdownMenu";
import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { PropertyCategory , PropertyUpdatedArgs } from "@itwin/components-react";
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
export interface PropertyGridContentBaseProps extends Omit<FilteringPropertyGridProps, "dataProvider" | "filterer" | "isPropertyHoverEnabled" | "isPropertySelectionEnabled" | "onPropertyContextMenu" | "width" | "height" | "onPropertyUpdated"> {
  imodel: IModelConnection;
  className?: string;
  onBackButton?: () => void;
  headerControls?: ReactNode;
  onPropertyUpdated?: (args: PropertyGridPropertyUpdatedArgs, category: PropertyCategory) => Promise<boolean>;
  /** @internal */
  dataProvider: IPresentationPropertyDataProvider;
  /** @internal */
  dataRenderer?: (props: FilteringPropertyGridProps) => ReactNode;
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
  ...props
}: PropertyGridContentProps) {
  const { item } = useLoadedInstanceInfo({ dataProvider });
  const { renderContextMenu, onPropertyContextMenu } = useContextMenu({
    dataProvider,
    imodel,
    contextMenuItems,
  });

  const [filterText, setFilterText] = useState<string>("");
  const { showNullValues } = useNullValueSettingContext();
  const filterer = useFilterer({ showNullValues, filterText });

  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  const settingsProps: SettingsDropdownMenuProps = {
    settingsMenuItems,
    dataProvider,
  };

  const dataRendererProps: FilteringPropertyGridProps = {
    ...props,
    dataProvider,
    filterer,
    highlight: filterText && filterText.length !== 0 ? { highlightedText: filterText, filteredTypes: [FilteredType.Category, FilteredType.Label, FilteredType.Value] } : undefined,
    isPropertyHoverEnabled: true,
    isPropertySelectionEnabled: true,
    onPropertyContextMenu,
    width,
    height,
    onPropertyUpdated: onPropertyUpdated
      ? async (args, category) => onPropertyUpdated({ ...args, dataProvider }, category)
      : undefined,
  };

  // const contentSize = useEffect(async () => {

  //   async function getContentSetSize() {
  //     const contentSetSize = await dataProvider.getContentSetSize();
  //     return contentSetSize;
  //   }

  //   const bruh = await getContentSetSize();
  // }, [dataProvider]);

  const onFilterStart = (searchText: string) => {
    setFilterText(searchText);
  };

  const onFilterClear = () => {
    setFilterText("");
  };

  return (
    <div className={classnames("property-grid-react-container", className)}>
      <PropertyGridHeader controls={headerControls} item={item} onBackButtonClick={onBackButton} settingsProps={settingsProps} onFilterStart={onFilterStart} onFilterClear={onFilterClear} />
      <div className="property-grid-react-data">
        <ResizableContainerObserver onResize={handleResize}>
          {
            dataRenderer
              ? dataRenderer(dataRendererProps)
              : <FilteringPropertyGrid {...dataRendererProps} />
          }
        </ResizableContainerObserver>
      </div>
      {renderContextMenu()}
    </div>
  );
}

interface PropertyGridHeaderProps {
  controls?: ReactNode;
  item?: { className: string, label: PropertyRecord };
  onBackButtonClick?: () => void;
  settingsProps: SettingsDropdownMenuProps;
  onFilterStart: (searchText: string) => void;
  onFilterClear: () => void;
}

function PropertyGridHeader({ item, controls, settingsProps, onBackButtonClick, onFilterStart, onFilterClear }: PropertyGridHeaderProps) {
  const [searchBarIsExpanded, setSearchBarIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState<string>("");
  const onFilterStartRef = useRef(onFilterStart);
  // save latest `onFiltertStart` reference into `useRef` to avoid restarting timeout when `onFiltertStart` reference changes.
  onFilterStartRef.current = onFilterStart;

  useEffect(() => {
    if (!inputValue) {
      onFilterStartRef.current("");
      return;
    }

    const timeoutId = setTimeout(() => {
      onFilterStartRef.current(inputValue);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue]);

  if (!item) {
    return null;
  }

  return (
    <Header onBackButtonClick={onBackButtonClick} className={classnames("property-grid-react-panel-header", searchBarIsExpanded && "search-bar-expanded")}>
      <div className="header-title">
        <Text variant="leading">
          {PropertyValueRendererManager.defaultManager.render(item.label)}
        </Text>
        <Text>
          {item.className}
        </Text>
      </div>
      <div className={classnames("header-tools")}>
        <SearchBox
          expandable
          onCollapse={() => setSearchBarIsExpanded(false)}
          onExpand={() => setSearchBarIsExpanded(true)}
          className={classnames("expandable-search-bar", !searchBarIsExpanded && "contracted")}
        >
          <SearchBox.CollapsedState>
            <SearchBox.ExpandButton
              size="small"
              title="Expand Searchbar"
            />
          </SearchBox.CollapsedState>
          <SearchBox.ExpandedState >
            <SearchBox.Input
              placeholder={"Search"}
              onChange={(e) => setInputValue(e.currentTarget.value)}
            />
            <SearchBox.CollapseButton
              title="Contract Searchbar"
              onClick={() => {
                onFilterClear();
              }}
            />
          </SearchBox.ExpandedState>
        </SearchBox>
        {controls}
        <SettingsDropdownMenu {...settingsProps}/>
      </div>
    </Header>
  );
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

    if(!showNullValues){
      return new CompositePropertyDataFilterer(textFilterer, CompositeFilterType.And, defaultFilterers.nonEmpty);
    }

    return textFilterer;
  }, [defaultFilterers.nonEmpty, filterText, showNullValues]);

  return compositeFilterer;
}
