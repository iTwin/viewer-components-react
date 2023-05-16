/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection, StageUsage, WidgetState } from "@itwin/appui-react";
import { PropertyGridComponent, PropertyGridComponentId } from "./PropertyGridComponent";
import { PropertyGridManager } from "./PropertyGridManager";

import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { PropertyGridComponentProps } from "./PropertyGridComponent";

export interface PropertyGridUiItemsProviderProps {
  defaultPanelLocation?: StagePanelLocation;
  defaultPanelSection?: StagePanelSection;
  defaultPanelWidgetPriority?: number;
  propertyGridProps?: PropertyGridComponentProps;
}

/** Provides the property grid widget to zone 9 */
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
      icon: "icon-info",
      priority: defaultPanelWidgetPriority,
    }];
  }
}

