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
import type { GroupingMappingProps } from "./GroupingMapping";
import GroupingMapping from "./GroupingMapping";

export class GroupingMappingProvider implements UiItemsProvider {
  public readonly id = "GroupingMappingProvider";

  constructor(private readonly _props: GroupingMappingProps = {}) { }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection,
  ): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (location === StagePanelLocation.Left &&
        section === StagePanelSection.Start &&
        stageUsage === StageUsage.General
    ) {
      const GroupingMappingWidget: Widget = {
        id: "GroupingMappingWidget",
        label: "Grouping & Mapping",
        content: <GroupingMapping {...this._props} />,
      };

      widgets.push(GroupingMappingWidget);
    }

    return widgets;
  }
}
