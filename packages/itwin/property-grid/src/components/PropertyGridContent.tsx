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
import { useLoadedInstanceInfo } from "../hooks/UseInstanceInfo";
import { useNullValueSetting } from "../hooks/UseNullValuesSetting";
import { PropertyGridManager } from "../PropertyGridManager";
import { FilteringPropertyGrid, NonEmptyValuesPropertyDataFilterer, NoopPropertyDataFilterer } from "./FilteringPropertyGrid";

import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { FilteringPropertyGridProps } from "./FilteringPropertyGrid";
import type { ContextMenuProps } from "../hooks/UseContextMenu";
import type { NullValueSettingProps } from "../hooks/UseNullValuesSetting";

/**
 * Base props for rendering `PropertyGridContent` component.
 * @public
 */
export interface PropertyGridContentBaseProps extends Omit<FilteringPropertyGridProps, "dataProvider" | "filterer" | "isPropertyHoverEnabled" | "isPropertySelectionEnabled" | "onPropertyContextMenu" | "width" | "height"> {
  imodel: IModelConnection;
  dataProvider: IPresentationPropertyDataProvider;
  rootClassName?: string;
  onBackButton?: () => void;
  headerContent?: JSX.Element;
}

/**
 * Props for `PropertyGridContent` component.
 * @public
 */
export type PropertyGridContentProps = PropertyGridContentBaseProps & ContextMenuProps & NullValueSettingProps;

/**
 * Component that renders property grid with header and context menu.
 * @internal
 */
export function PropertyGridContent({
  dataProvider,
  imodel,
  contextMenuItemProviders,
  persistNullValueToggle,
  rootClassName,
  onBackButton,
  headerContent,
  ...props
}: PropertyGridContentProps) {
  const { item } = useLoadedInstanceInfo({ dataProvider });
  const { showNullValues } = useNullValueSetting({ persistNullValueToggle });
  const { renderContextMenu, onPropertyContextMenu } = useContextMenu({
    dataProvider,
    imodel,
    contextMenuItemProviders,
  });
  const filterer = useFilterer({ showNullValues });

  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  return (
    <div className={classnames("property-grid-widget-container", rootClassName)}>
      <Header headerContent={headerContent} item={item} onBackButtonClick={onBackButton} />
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
  headerContent?: ReactNode;
  item?: { className: string, label: PropertyRecord };
  onBackButtonClick?: () => void;
}

function Header({ item, headerContent, onBackButtonClick }: HeaderProps) {
  if (!item) {
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
          title={PropertyGridManager.translate("header.back")}
        >
          <SvgProgressBackwardCircular />
        </IconButton>
      )}
      <div className="property-grid-react-panel-label-and-class">
        <div className="property-grid-react-panel-label">
          {item.label && PropertyValueRendererManager.defaultManager.render(item.label)}
        </div>
        <div className="property-grid-react-panel-class">{item.className}</div>
      </div>
      {headerContent}
    </div>
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

  // TODO: figure out a way to toggle this. https://github.com/iTwin/viewer-components-react/issues/499
  // istanbul ignore if
  if (!showNullValues) {
    return defaultFilterers.nonEmpty;
  }

  return defaultFilterers.noop;
}
