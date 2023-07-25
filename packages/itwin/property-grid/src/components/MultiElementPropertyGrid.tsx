/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./MultiElementPropertyGrid.scss";
import classnames from "classnames";
import { useEffect, useState } from "react";
import { SvgArrowDown, SvgArrowUp, SvgPropertiesList } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { Presentation } from "@itwin/presentation-frontend";
import { useInstanceSelection } from "../hooks/UseInstanceSelection";
import { NullValueSettingContext } from "../hooks/UseNullValuesSetting";
import { PropertyGridManager } from "../PropertyGridManager";
import { ElementList as ElementListComponent } from "./ElementList";
import { PropertyGrid as PropertyGridComponent } from "./PropertyGrid";
import { SingleElementPropertyGrid as SingleElementPropertyGridComponent } from "./SingleElementPropertyGrid";

import type { ReactNode } from "react";
import type { PropertyGridProps } from "./PropertyGrid";
import type { SingleElementPropertyGridProps } from "./SingleElementPropertyGrid";
import type { InstanceKey } from "@itwin/presentation-common";

enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

/**
 * Props for `MultiElementPropertyGrid` component.
 * @public
 */
export interface MultiElementPropertyGridProps extends Omit<PropertyGridProps, "headerControls" | "onBackButton"> {
  /** Renders controls for ancestors navigation. If set to `undefined` ancestors navigation is disabled. */
  ancestorsNavigationControls?: (props: AncestorsNavigationControlsProps) => ReactNode;
}

/**
 * Component that renders property grid for instances in `UnifiedSelection`.
 * - If multiple instances are selected list containing select instances can be opened that allows to check properties of specific instance.
 * - If single instance is selected navigation through it's ancestors can be enabled.
 * @public
 */
export function MultiElementPropertyGrid({ ancestorsNavigationControls, ...props }: MultiElementPropertyGridProps) {
  const {
    selectedKeys,
    focusedInstanceKey,
    focusInstance,
    ancestorsNavigationProps,
  } = useInstanceSelection({ imodel: props.imodel });

  const [content, setContent] = useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );

  useEffect(() => {
    // show standard property grid when selection changes
    return Presentation.selection.selectionChange.addListener(() => {
      setContent(MultiElementPropertyContent.PropertyGrid);
    });
  }, []);

  const openElementList = () => {
    setContent(MultiElementPropertyContent.ElementList);
  };

  const moreThanOneElement = selectedKeys.length > 1;
  const items = [
    <PropertyGridComponent
      {...props}
      headerControls={
        <HeaderControls
          multipleElementsSelected={moreThanOneElement}
          onElementListButtonClick={openElementList}
          ancestorsNavigationProps={ancestorsNavigationProps}
          ancestorsNavigationControls={ancestorsNavigationControls}
        />
      }
      className={classnames("property-grid-react-property-grid", props.className)}
      key={"PropertyGrid"}
    />,
    <ElementListComponent
      imodel={props.imodel}
      instanceKeys={selectedKeys}
      onBack={() => {
        setContent(MultiElementPropertyContent.PropertyGrid);
      }}
      onSelect={(instanceKey: InstanceKey) => {
        setContent(MultiElementPropertyContent.SingleElementPropertyGrid);
        focusInstance(instanceKey);
      }}
      className={classnames("property-grid-react-element-list", props.className)}
      key={"ElementList"}
    />,
    <SingleElementGrid
      {...props}
      instanceKey={focusedInstanceKey}
      onBackButton={() => {
        setContent(MultiElementPropertyContent.ElementList);
      }}
      className={classnames("property-grid-react-single-element-property-grid", props.className)}
      key={"SingleElementPropertyGrid"}
    />,
  ];

  return (
    <div className="property-grid-react-transition-container">
      <div className="property-grid-react-transition-container-inner">
        <NullValueSettingContext>
          {items.map((component, idx) => (
            <div key={component.key} className={classnames({
              "property-grid-react-animated-tab": true,
              "property-grid-react-animated-tab-animate-right": idx > content,
              "property-grid-react-animated-tab-animate-left": idx < content,
            })} >
              {component}
            </div>
          ))}
        </NullValueSettingContext>
      </div>
    </div>
  );
}

/**
 * Props for `AncestorsNavigationControls` component.
 * @public
 */
export interface AncestorsNavigationControlsProps {
  /** Navigates up to parent instance. */
  navigateUp: () => void;
  /** Navigates down to child instance from which parent instance was reached. */
  navigateDown: () => void;
  /** Specified whether it is possible to navigate down. */
  canNavigateDown: boolean;
  /** Specified whether it is possible to navigate up. */
  canNavigateUp: boolean;
}

/**
 * Component that renders controls for navigating through ancestors.
 * @public
 */
export function AncestorsNavigationControls({ navigateUp, navigateDown, canNavigateDown, canNavigateUp }: AncestorsNavigationControlsProps) {
  if (!canNavigateDown && !canNavigateUp) {
    return null;
  }

  return <>
    <IconButton
      size="small"
      styleType="borderless"
      title={PropertyGridManager.translate("header.navigateUp")}
      onClick={navigateUp}
      disabled={!canNavigateUp}
    >
      <SvgArrowUp />
    </IconButton>
    <IconButton
      size="small"
      styleType="borderless"
      title={PropertyGridManager.translate("header.navigateDown")}
      onClick={navigateDown}
      disabled={!canNavigateDown}
    >
      <SvgArrowDown />
    </IconButton>
  </>;
}

interface HeaderControlsProps {
  multipleElementsSelected: boolean;
  onElementListButtonClick: () => void;
  ancestorsNavigationProps: AncestorsNavigationControlsProps;
  ancestorsNavigationControls?: (props: AncestorsNavigationControlsProps) => ReactNode;
}

function HeaderControls({
  multipleElementsSelected,
  ancestorsNavigationProps,
  ancestorsNavigationControls,
  onElementListButtonClick,
}: HeaderControlsProps) {
  if (!multipleElementsSelected) {
    return ancestorsNavigationControls ? <>{ancestorsNavigationControls(ancestorsNavigationProps)}</> : null;
  }

  return <IconButton
    className="property-grid-react-multi-select-icon"
    size="small"
    styleType="borderless"
    onClick={onElementListButtonClick}
    title={PropertyGridManager.translate("element-list.title")}
  >
    <SvgPropertiesList />
  </IconButton>;
}

function SingleElementGrid({ instanceKey, ...props }: Omit<SingleElementPropertyGridProps, "instanceKey"> & {instanceKey: InstanceKey | undefined}) {
  if (!instanceKey) {
    return null;
  }

  return <SingleElementPropertyGridComponent {...props} instanceKey={instanceKey} />;
}
