/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGridContent.scss";
import classnames from "classnames";
import { useCallback, useState } from "react";
import { PropertyValueRendererManager } from "@itwin/components-react";
import { ResizableContainerObserver } from "@itwin/core-react";
import { Text } from "@itwin/itwinui-react";
import { useContextMenu } from "../hooks/UseContextMenu";
import { useLoadedInstanceInfo } from "../hooks/UseInstanceInfo";
import { useNullValueSettingContext } from "../hooks/UseNullValuesSetting";
import { FilteringPropertyGrid, NonEmptyValuesPropertyDataFilterer, NoopPropertyDataFilterer } from "./FilteringPropertyGrid";
import { Header } from "./Header";
import { SettingsDropdownMenu } from "./SettingsDropdownMenu";

import type { SettingsDropdownMenuProps, SettingsMenuProps } from "./SettingsDropdownMenu";
import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { FilteringPropertyGridProps } from "./FilteringPropertyGrid";
import type { ContextMenuProps } from "../hooks/UseContextMenu";

/**
 * Base props for rendering `PropertyGridContent` component.
 * @public
 */
export interface PropertyGridContentBaseProps extends Omit<FilteringPropertyGridProps, "dataProvider" | "filterer" | "isPropertyHoverEnabled" | "isPropertySelectionEnabled" | "onPropertyContextMenu" | "width" | "height"> {
  imodel: IModelConnection;
  dataProvider: IPresentationPropertyDataProvider;
  className?: string;
  onBackButton?: () => void;
  headerControls?: ReactNode;
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
  ...props
}: PropertyGridContentProps) {
  const { item } = useLoadedInstanceInfo({ dataProvider });
  const { renderContextMenu, onPropertyContextMenu } = useContextMenu({
    dataProvider,
    imodel,
    contextMenuItems,
  });
  const { showNullValues } = useNullValueSettingContext();
  const filterer = useFilterer({ showNullValues });

  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  const settingsProps: SettingsDropdownMenuProps = {
    settingsMenuItems,
    dataProvider,
  };

  return (
    <div className={classnames("property-grid-widget-container", className)}>
      <PropertyGridHeader controls={headerControls} item={item} onBackButtonClick={onBackButton} settingsProps={settingsProps} />
      <ResizableContainerObserver onResize={handleResize}>
        <FilteringPropertyGrid
          {...props}
          dataProvider={dataProvider}
          filterer={filterer}
          isPropertyHoverEnabled={true}
          isPropertySelectionEnabled={true}
          onPropertyContextMenu={onPropertyContextMenu}
          width={width}
          height={height}
        />
      </ResizableContainerObserver>
      {renderContextMenu()}
    </div>
  );
}

interface PropertyGridHeaderProps {
  controls?: ReactNode;
  item?: { className: string, label: PropertyRecord };
  onBackButtonClick?: () => void;
  settingsProps: SettingsDropdownMenuProps;
}

function PropertyGridHeader({ item, controls, settingsProps, onBackButtonClick }: PropertyGridHeaderProps) {
  if (!item) {
    return null;
  }

  return (
    <Header onBackButtonClick={onBackButtonClick}>
      <div className="property-grid-react-panel-label-and-class">
        <Text variant="leading">
          {PropertyValueRendererManager.defaultManager.render(item.label)}
        </Text>
        <Text>{item.className}</Text>
      </div>
      {controls}
      <SettingsDropdownMenu {...settingsProps}/>
    </Header>
  );
}

interface UseFiltererProps {
  showNullValues: boolean;
}

function useFilterer({ showNullValues }: UseFiltererProps) {
  const [defaultFilterers] = useState(() => ({
    noop: new NoopPropertyDataFilterer(),
    nonEmpty: new NonEmptyValuesPropertyDataFilterer(),
  }));

  if (!showNullValues) {
    return defaultFilterers.nonEmpty;
  }

  return defaultFilterers.noop;
}
