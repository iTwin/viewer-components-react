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
import { PropertyGridManager } from "../PropertyGridManager";
import { ElementList as ElementListComponent } from "./ElementList";
import { PropertyGrid as PropertyGridComponent } from "./PropertyGrid";
import { SingleElementPropertyGrid as SingleElementPropertyGridComponent } from "./SingleElementPropertyGrid";

import type { AncestorNavigationProps } from "../hooks/UseInstanceSelection";
import type { PropertyGridProps } from "./PropertyGrid";
import type { SingleElementPropertyGridProps } from "./SingleElementPropertyGrid";
import type { InstanceKey } from "@itwin/presentation-common";

enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

/** Prop for `MultiElementPropertyGrid` component. */
export type MultiElementPropertyGridProps = Omit<PropertyGridProps, "headerContent" | "onBackButton"> & AncestorNavigationProps;

/**
 * Component that renders property grid for instance in `UnifiedSelection`.
 * - If multiple instances are selected list containing select instances can be opened that allows to check properties of specific instance.
 * - If single instance is selected navigation through it's ancestors can be enabled.
 */
export function MultiElementPropertyGrid({ enableAncestorNavigation, ...props }: MultiElementPropertyGridProps) {
  const {
    selectedKeys,
    focusedInstanceKey,
    focusInstance,
    ancestorsNavigationProps,
  } = useInstanceSelection({ imodel: props.imodel, enableAncestorNavigation });

  const [content, setContent] = useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );

  useEffect(() => {
    // show standard property grid when selection changes
    return Presentation.selection.selectionChange.addListener(() => {
      setContent(MultiElementPropertyContent.PropertyGrid);
    });
  }, []);

  const onInfoButton = () => {
    setContent(MultiElementPropertyContent.ElementList);
  };

  const moreThanOneElement = selectedKeys.length > 1;
  const items = [
    <PropertyGridComponent
      {...props}
      headerContent={
        moreThanOneElement
          ?
          <IconButton
            className="property-grid-react-multi-select-icon"
            size="small"
            styleType="borderless"
            onClick={onInfoButton}
            onKeyDown={onInfoButton}
            title={PropertyGridManager.translate("element-list.title")}
          >
            <SvgPropertiesList />
          </IconButton>
          : <AncestryNavigation {...ancestorsNavigationProps} />
      }
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
      rootClassName={props.rootClassName}
      key={"ElementList"}
    />,
    <SingleElementGrid
      {...props}
      instanceKey={focusedInstanceKey}
      onBackButton={() => {
        setContent(MultiElementPropertyContent.ElementList);
      }}
      key={"SingleElementPropertyGrid"}
    />,
  ];

  return (
    <div className="property-grid-react-transition-container">
      <div className="property-grid-react-transition-container-inner">
        {items.map((component, idx) => (
          <div key={component.key} className={classnames({
            "property-grid-react-animated-tab": true,
            "property-grid-react-animated-tab-animate-right": idx > content,
            "property-grid-react-animated-tab-animate-left": idx < content,
          })} >
            {component}
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleElementGrid({ instanceKey, ...props }: Omit<SingleElementPropertyGridProps, "instanceKey"> & {instanceKey: InstanceKey | undefined}) {
  if (!instanceKey) {
    return null;
  }

  return <SingleElementPropertyGridComponent {...props} instanceKey={instanceKey} />;
}

interface AncestorsNavigationProps {
  navigationEnabled: boolean;
  navigateUp: () => void;
  navigateDown: () => void;
  canNavigateDown: boolean;
  canNavigateUp: boolean;
}

function AncestryNavigation({ navigationEnabled, navigateUp, navigateDown, canNavigateDown, canNavigateUp }: AncestorsNavigationProps) {
  if (!navigationEnabled || (!canNavigateDown && !canNavigateUp)) {
    return null;
  }

  return <>
    <IconButton
      size="small"
      styleType="borderless"
      title={PropertyGridManager.translate("tools.navigateUpTooltip")}
      onClick={navigateUp}
      disabled={!canNavigateUp}
    >
      <SvgArrowUp />
    </IconButton>
    <IconButton
      size="small"
      styleType="borderless"
      title={PropertyGridManager.translate("tools.navigateDownTooltip")}
      onClick={navigateDown}
      disabled={!canNavigateDown}
    >
      <SvgArrowDown />
    </IconButton>
  </>;
}
