/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  AbstractWidgetProps,
  UiItemsProvider} from "@itwin/appui-abstract";
import {
  AbstractZoneLocation,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
} from "@itwin/appui-abstract";

import * as React from "react";
import GroupingMapping from "./components/GroupingMapping";

export class GroupingMappingProvider implements UiItemsProvider {
  public readonly id = "GroupingMappingProvider";

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
        getWidgetContent() {
          return <GroupingMapping />;
        },
      };

      widgets.push(GroupingMappingWidget);
    }

    return widgets;
  }
}
