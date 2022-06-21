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
import type { ClientPrefix } from "./components/context/GroupingApiConfigContext";
import GroupingMapping, { GroupingMappingProps } from "./components/GroupingMapping";
import type { IMappingClient } from "./IMappingClient";

export class GroupingMappingProvider implements UiItemsProvider {
  public readonly id = "GroupingMappingProvider";

  private readonly _getAccessToken?: () => Promise<AccessToken>;
  private readonly _prefix?: ClientPrefix;
  private readonly _client?: IMappingClient;

  constructor({ getAccessToken, prefix, client }: GroupingMappingProps = {}) {
    this._getAccessToken = getAccessToken;
    this._prefix = prefix;
    this._client = client;
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
          return <GroupingMapping getAccessToken={this._getAccessToken} prefix={this._prefix} client={this._client} />;
        },
      };

      widgets.push(GroupingMappingWidget);
    }

    return widgets;
  }
}
