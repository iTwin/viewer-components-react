/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  AbstractWidgetProps,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import {
  AbstractZoneLocation,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
} from "@itwin/appui-abstract";
import type { AccessToken } from "@itwin/core-bentley";
import React from "react";
import GroupingMapping from "./components/GroupingMapping";

export class GroupingMappingProvider implements UiItemsProvider {
  public readonly id = "GroupingMappingProvider";

  private readonly _accessToken?: AccessToken;
  private readonly _prefix?: "" | "dev" | "qa";

  constructor(accessToken?: AccessToken, prefix?: "" | "dev" | "qa") {
    this._accessToken = accessToken;
    this._prefix = prefix;
  }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection,
    zonelocation?: AbstractZoneLocation
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      (location === StagePanelLocation.Left &&
        section === StagePanelSection.Start &&
        stageUsage === StageUsage.General) ||
      zonelocation === AbstractZoneLocation.CenterLeft
    ) {
      const GroupingMappingWidget: AbstractWidgetProps = {
        id: "GroupingMappingWidget",
        label: "Grouping & Mapping",
        getWidgetContent: () => {
          return <GroupingMapping accessToken={this._accessToken} prefix={this._prefix} />;
        },
      };

      widgets.push(GroupingMappingWidget);
    }

    return widgets;
  }
}
