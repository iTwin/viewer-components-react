/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection, StageUsage, WidgetState } from "@itwin/appui-react";
import { SvgInfoCircular } from "@itwin/itwinui-icons-react";
import { PropertyGridComponent, PropertyGridComponentId } from "./PropertyGridComponent";
import { PropertyGridManager } from "./PropertyGridManager";

import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { PropertyGridComponentProps } from "./PropertyGridComponent";

/**
 * Props for creating `PropertyGridUiItemsProvider`.
 * @public
 */
export interface PropertyGridUiItemsProviderProps {
  /** The stage panel to place the widget in. Defaults to `StagePanelLocation.Right`. */
  defaultPanelLocation?: StagePanelLocation;
  /** The stage panel section to place the widget in. Defaults to `StagePanelSection.End`. */
  defaultPanelSection?: StagePanelSection;
  /** Widget priority in the stage panel. */
  defaultPanelWidgetPriority?: number;
  /** Props for configuring `PropertyGridComponent` shown in the widget. */
  propertyGridProps?: PropertyGridComponentProps;
}

/**
 * A `UiItemsProvider` implementation that provides a `PropertyGridComponent` into a stage panel.
 * @public
 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";

  constructor(private _props: PropertyGridUiItemsProviderProps = {}) { }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const { defaultPanelLocation, defaultPanelSection, defaultPanelWidgetPriority, propertyGridProps } = this._props;

    const preferredLocation = defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = defaultPanelSection ?? StagePanelSection.End;
    if (stageUsage !== StageUsage.General || location !== preferredLocation || section !== preferredPanelSection) {
      return [];
    }

    return [{
      id: PropertyGridComponentId,
      label: PropertyGridManager.translate("widget-label"),
      content: <PropertyGridComponent {...propertyGridProps} />,
      defaultState: WidgetState.Hidden,
      icon: <SvgInfoCircular />,
      priority: defaultPanelWidgetPriority,
    }];
  }
}

