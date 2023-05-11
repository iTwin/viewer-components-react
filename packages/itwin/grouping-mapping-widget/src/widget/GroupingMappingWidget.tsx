/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  CommonWidgetProps,
  UiItemsProvider,
} from "@itwin/appui-react";
import {
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
} from "@itwin/appui-react";
import React from "react";
import type { GroupingMappingProps } from "./components/GroupingMapping";
import GroupingMapping from "./components/GroupingMapping";

export class GroupingMappingProvider implements UiItemsProvider {
  public readonly id = "GroupingMappingProvider";

  constructor(private readonly _props: GroupingMappingProps = {}) { }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection,
  ): ReadonlyArray<CommonWidgetProps> {
    const widgets: CommonWidgetProps[] = [];
    if (location === StagePanelLocation.Left &&
        section === StagePanelSection.Start &&
        stageUsage === StageUsage.General
    ) {
      const GroupingMappingWidget: CommonWidgetProps = {
        id: "GroupingMappingWidget",
        label: "Grouping & Mapping",
        getWidgetContent: () => {
          return <GroupingMapping {...this._props} />;
        },
      };

      widgets.push(GroupingMappingWidget);
    }

    return widgets;
  }
}
