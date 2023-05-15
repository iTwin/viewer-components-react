/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGridContent.scss";
import classnames from "classnames";
import { useCallback, useState } from "react";
import { PropertyValueRendererManager } from "@itwin/components-react";
import { ResizableContainerObserver } from "@itwin/core-react";
import { SvgProgressBackwardCircular } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { useContextMenu } from "../hooks/UseContextMenu";
import { useNullValueSetting } from "../hooks/UseNullValuesSetting";
import { usePropertyGridData } from "../hooks/UsePropertyGridData";
import { useSelectedItemsNum } from "../hooks/UseSelectedItemsCount";
import { PropertyGridManager } from "../PropertyGridManager";
import { FilteringPropertyGrid } from "./FilteringPropertyGrid";

import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { FilteringPropertyGridProps } from "./FilteringPropertyGrid";
import type { ContextMenuProps } from "../hooks/UseContextMenu";
import type { NullValueSettingProps } from "../hooks/UseNullValuesSetting";
import type { PropertyGridDataProps } from "../hooks/UsePropertyGridData";

/** Base props for rendering `PropertyGridContent` component. */
export interface BasePropertyGridContentProps extends Omit<FilteringPropertyGridProps, "dataProvider" | "filterer" | "isPropertyHoverEnabled" | "isPropertySelectionEnabled" | "onPropertyContextMenu" | "width" | "height"> {
  imodel: IModelConnection;
  dataProvider: PresentationPropertyDataProvider;
  rootClassName?: string;
  onBackButton?: () => void;
  headerContent?: JSX.Element;
}

/** Props for `PropertyGridContent` component. */
export type PropertyGridContentProps = BasePropertyGridContentProps & ContextMenuProps & NullValueSettingProps & PropertyGridDataProps;

/** Component that renders property grid with header and context menu. */
export function PropertyGridContent({
  dataProvider,
  imodel,
  enableFavoriteProperties,
  favoritePropertiesScope,
  enableCopyingPropertyText,
  enableNullValueToggle,
  persistNullValueToggle,
  additionalContextMenuOptions,
  defaultContextMenuOptions,
  customOnDataChanged,
  rootClassName,
  onBackButton,
  headerContent,
  ...props
}: PropertyGridContentProps) {
  const { item } = usePropertyGridData({ dataProvider, customOnDataChanged });
  const { showNullValues, setShowNullValues, filterer } = useNullValueSetting({ persistNullValueToggle });
  const { renderContextMenu, onPropertyContextMenu } = useContextMenu({
    dataProvider,
    imodel,
    setShowNullValues,
    showNullValues,
    additionalContextMenuOptions,
    defaultContextMenuOptions,
    enableCopyingPropertyText,
    enableFavoriteProperties,
    enableNullValueToggle,
    favoritePropertiesScope,
  });

  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  return (
    <div className={classnames("property-grid-widget-container", rootClassName)}>
      <Header imodel={imodel} headerContent={headerContent} item={item} onBackButtonClick={onBackButton} />
      <div className={"property-grid-container"}>
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
      </div>
      {renderContextMenu()}
    </div>
  );
}

interface HeaderProps {
  imodel: IModelConnection;
  headerContent?: ReactNode;
  item?: { className: string, label: PropertyRecord };
  onBackButtonClick?: () => void;
}

function Header({ imodel, item, headerContent, onBackButtonClick }: HeaderProps) {
  const numItemsSelected = useSelectedItemsNum(imodel);
  if (numItemsSelected === undefined || numItemsSelected === 0) {
    return null;
  }

  return (
    <div className="property-grid-react-panel-header">
      {onBackButtonClick !== undefined && (
        <IconButton
          id="property-grid-react-element-list-back-btn"
          styleType="borderless"
          onClick={onBackButtonClick}
          onKeyDown={onBackButtonClick}
          tabIndex={0}
          title={PropertyGridManager.translate("tools.backTooltip")}
        >
          <SvgProgressBackwardCircular />
        </IconButton>
      )}
      <div className="property-grid-react-panel-label-and-class">
        <div className="property-grid-react-panel-label">
          {item?.label && PropertyValueRendererManager.defaultManager.render(item?.label)}
        </div>
        <div className="property-grid-react-panel-class">{item?.className}</div>
      </div>
      {headerContent}
    </div>
  );
}
