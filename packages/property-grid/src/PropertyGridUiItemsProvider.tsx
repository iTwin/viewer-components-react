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
  WidgetState,
} from "@bentley/ui-abstract";
import * as React from "react";

import { FunctionalMultiElementPropertyGrid } from "./components/functional";
import { PropertyGridManager } from "./PropertyGridManager";
import { PropertyGridWidgetBaseProps } from "./types";

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";

  private _props?: Partial<PropertyGridWidgetBaseProps>;

  constructor(props?: Partial<PropertyGridWidgetBaseProps>) {
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
        id: "vcr:PropertyGrid",
        label: PropertyGridManager.translate("widget-label"),
        getWidgetContent: () => (
          <FunctionalMultiElementPropertyGrid {...this._props} />
        ),
        defaultState: WidgetState.Closed,
      });
    }

    return widgets;
  }
}
