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
import type { AccessToken } from "@itwin/core-bentley";

import * as React from "react";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
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
  private readonly _getAccessToken?: () => Promise<AccessToken>;
  private readonly _baseUrl: string;

  constructor(
    getAccessToken?: () => Promise<AccessToken>,
    baseUrl: string = REPORTS_CONFIG_BASE_URL
  ) {
    this._getAccessToken = getAccessToken;
    this._baseUrl = baseUrl;
  }

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
      const ReportsWidget: Widget = {
        id: "reports-config-widget",
        label: ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:ReportsConfig"
        ),
        content: <ReportsContainer getAccessToken={this._getAccessToken} baseUrl={this._baseUrl} />,
      };

      widgets.push(ReportsWidget);
    }

    return widgets;
  }
}
