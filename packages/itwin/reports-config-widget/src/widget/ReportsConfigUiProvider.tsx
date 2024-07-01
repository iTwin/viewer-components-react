/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import { StagePanelLocation, StagePanelSection, StageUsage } from "@itwin/appui-react";

import * as React from "react";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import type { ReportsContainerProps } from "./components/ReportsContainer";
import ReportsContainer from "./components/ReportsContainer";

/**
 * @internal
 */
export const REPORTS_CONFIG_BASE_URL = "https://api.bentley.com";

/**
 * Reports Config Widget UI Provider
 * @public
 */
export class ReportsConfigProvider implements UiItemsProvider {
  public readonly id = "ReportsConfigProvider";

  constructor(private _props?: ReportsContainerProps) { }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (location === StagePanelLocation.Left && section === StagePanelSection.Start && stageUsage === StageUsage.General) {
      const ReportsWidget: Widget = {
        id: "reports-config-widget",
        label: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ReportsConfig"),
        content: <ReportsContainer {...this._props} />,
      };

      widgets.push(ReportsWidget);
    }

    return widgets;
  }
}
