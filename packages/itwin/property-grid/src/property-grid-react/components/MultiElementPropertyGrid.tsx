/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./MultiElementPropertyGrid.scss";
import classnames from "classnames";
import { useEffect, useState } from "react";
import { SvgArrowDown, SvgArrowUp, SvgPropertiesList } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { useInstanceSelection } from "../hooks/UseInstanceSelection.js";
import { NullValueSettingContext } from "../hooks/UseNullValuesSetting.js";
import { useTelemetryContext } from "../hooks/UseTelemetryContext.js";
import { useSelectionHandler } from "../hooks/UseUnifiedSelectionHandler.js";
import { PropertyGridManager } from "../PropertyGridManager.js";
import { ElementList as ElementListComponent } from "./ElementList.js";
import { PropertyGrid as PropertyGridComponent } from "./PropertyGrid.js";
import { SingleElementPropertyGrid as SingleElementPropertyGridComponent } from "./SingleElementPropertyGrid.js";

import type { SelectionStorage } from "../hooks/UseUnifiedSelectionHandler.js";
import type { ElementListProps } from "./ElementList.js";
import type { ReactNode } from "react";
import type { PropertyGridProps } from "./PropertyGrid.js";
import type { SingleElementPropertyGridProps } from "./SingleElementPropertyGrid.js";
import type { InstanceKey } from "@itwin/presentation-common";
import type { UsageTrackedFeatures } from "../hooks/UseTelemetryContext.js";

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
  /**
   * Unified selection storage to use for listening and getting active selection.
   *
   * When not specified, the deprecated `SelectionManager` from `@itwin/presentation-frontend` package
   * is used.
   */
  selectionStorage?: SelectionStorage;

  /** Renders controls for ancestors navigation. If set to `undefined`, ancestors navigation is disabled. */
  ancestorsNavigationControls?: (props: AncestorsNavigationControlsProps) => ReactNode;

  /**
   * An optional callback to get parent instance key of the given instance. Defaults
   * to using `computeSelection` from `@itwin/unified-selection`.
   */
  getParentInstanceKey?: (key: InstanceKey) => Promise<InstanceKey | undefined>;
}

/**
 * Component that renders property grid for instances in `UnifiedSelection`.
 * - If multiple instances are selected, a list containing the selected instances can be opened that allows to check properties of a specific instance.
 * - If a single instance is selected, navigation through its ancestors can be enabled.
 * @public
 */
export function MultiElementPropertyGrid({ ancestorsNavigationControls, ...props }: MultiElementPropertyGridProps) {
  const { selectionChange } = useSelectionHandler({ selectionStorage: props.selectionStorage });
  const { selectedKeys, focusedInstanceKey, focusInstance, ancestorsNavigationProps } = useInstanceSelection({
    imodel: props.imodel,
    selectionStorage: props.selectionStorage,
    getParentInstanceKey: props.getParentInstanceKey,
  });
  const [content, setContent] = useState<MultiElementPropertyContent>(MultiElementPropertyContent.PropertyGrid);
  const { onFeatureUsed } = useTelemetryContext();

  useEffect(() => {
    const feature = featureFromSelectedCount(selectedKeys.length);
    feature && onFeatureUsed(feature);
  }, [selectedKeys, onFeatureUsed]);

  useEffect(() => {
    // show standard property grid when selection changes
    return selectionChange.addListener(() => {
      setContent(MultiElementPropertyContent.PropertyGrid);
    });
  }, [selectionChange]);

  const openElementList = () => {
    onFeatureUsed("elements-list");
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
    <ElementsList
      imodel={props.imodel}
      instanceKeys={selectedKeys}
      onBack={() => {
        const feature = featureFromSelectedCount(selectedKeys.length);
        feature && onFeatureUsed(feature);
        setContent(MultiElementPropertyContent.PropertyGrid);
      }}
      onSelect={(instanceKey: InstanceKey) => {
        onFeatureUsed("single-element-from-list");
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
        onFeatureUsed("elements-list");
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
            <div
              key={component.key}
              className={classnames({
                "property-grid-react-animated-tab": true,
                "property-grid-react-animated-tab-animate-right": idx > content.valueOf(),
                "property-grid-react-animated-tab-animate-left": idx < content.valueOf(),
              })}
            >
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
  /* c8 ignore next 3 */
  if (!canNavigateDown && !canNavigateUp) {
    return null;
  }

  return (
    <>
      <IconButton styleType="borderless" title={PropertyGridManager.translate("header.navigateUp")} onClick={navigateUp} disabled={!canNavigateUp}>
        <SvgArrowUp />
      </IconButton>
      <IconButton styleType="borderless" title={PropertyGridManager.translate("header.navigateDown")} onClick={navigateDown} disabled={!canNavigateDown}>
        <SvgArrowDown />
      </IconButton>
    </>
  );
}

interface HeaderControlsProps {
  multipleElementsSelected: boolean;
  onElementListButtonClick: () => void;
  ancestorsNavigationProps: AncestorsNavigationControlsProps;
  ancestorsNavigationControls?: (props: AncestorsNavigationControlsProps) => ReactNode;
}

function HeaderControls({ multipleElementsSelected, ancestorsNavigationProps, ancestorsNavigationControls, onElementListButtonClick }: HeaderControlsProps) {
  if (!multipleElementsSelected) {
    return ancestorsNavigationControls ? <>{ancestorsNavigationControls(ancestorsNavigationProps)}</> : null;
  }

  return (
    <IconButton
      className="property-grid-react-multi-select-icon"
      styleType="borderless"
      onClick={onElementListButtonClick}
      title={PropertyGridManager.translate("element-list.title")}
    >
      <SvgPropertiesList />
    </IconButton>
  );
}

function SingleElementGrid({ instanceKey, ...props }: Omit<SingleElementPropertyGridProps, "instanceKey"> & { instanceKey: InstanceKey | undefined }) {
  if (!instanceKey) {
    return null;
  }

  return <SingleElementPropertyGridComponent {...props} instanceKey={instanceKey} />;
}

function ElementsList(props: ElementListProps) {
  if (props.instanceKeys.length < 2) {
    return null;
  }

  return <ElementListComponent {...props} />;
}

function featureFromSelectedCount(count: number): UsageTrackedFeatures | undefined {
  if (count <= 0) {
    return undefined;
  }
  return count === 1 ? "single-element" : "multiple-elements";
}
