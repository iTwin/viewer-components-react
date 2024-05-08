/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  UiItemsProvider,
  Widget,
} from "@itwin/appui-react";
import {
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
} from "@itwin/appui-react";
import React from "react";
import type { EC3WidgetProps } from "../components/EC3Widget";
import { EC3Widget } from "../components/EC3Widget";

/**
 * EC3 Widget UI Provider
 * @beta
 */
export class EC3Provider implements UiItemsProvider {
  public readonly id = "EC3Provider";

  constructor(private readonly _props: EC3WidgetProps) { }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection
  ): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (
      location === StagePanelLocation.Left &&
      section === StagePanelSection.Start &&
      stageUsage === StageUsage.General
    ) {
      const newEC3Widget: Widget = {
        id: "EC3Widget",
        label: "EC3",
        content: <EC3Widget {...this._props} />,
      };

      widgets.push(newEC3Widget);
    }

    return widgets;
  }
}
