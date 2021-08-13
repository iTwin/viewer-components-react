/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import {
  AbstractWidgetProps,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  UiItemsProvider,
} from "@bentley/ui-abstract";
import { PropertyGridProps } from "./PropertyGrid";
import * as React from "react";
import { FunctionalPropertyGridWidget } from "./FunctionalPropertyGridWidget";

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";

  private _props?: Partial<PropertyGridProps>;

  constructor(props?: Partial<PropertyGridProps>) {
    this._props = props;
  }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection | undefined
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      stageUsage === StageUsage.General &&
      location === StagePanelLocation.Right &&
      section === StagePanelSection.End
    ) {
      widgets.push({
        id: "propertyGrid",
        label: "Properties",
        getWidgetContent: () => (
          <FunctionalPropertyGridWidget {...this._props} />
        ),
      });
    }

    return widgets;
  }
}
