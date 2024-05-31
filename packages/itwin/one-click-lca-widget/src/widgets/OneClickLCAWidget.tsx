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
import OneClickLCA from "../components/OneClickLCA";
import type { ReportProps } from "../components/Reports";
import React from "react";

export class OneClickLCAProvider implements UiItemsProvider {
  public readonly id = "OneClickLCAProvider";

  constructor(private readonly _props: ReportProps) {}

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
      const OneClickLCAWidget: Widget = {
        id: "OneClickLCAWidget",
        label: "One Click LCA",
        content: <OneClickLCA {...this._props} />,
      };

      widgets.push(OneClickLCAWidget);
    }

    return widgets;
  }
}
