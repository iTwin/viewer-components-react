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
} from "@itwin/appui-abstract";
import OneClickLCA from "../components/OneClickLCA";

export class OneClickLCAProvider implements UiItemsProvider {
  public readonly id = "OneClickLCAProvider";

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      location === StagePanelLocation.Left &&
      section === StagePanelSection.Start &&
      stageUsage === StageUsage.General
    ) {
      const OneClickLCAWidget: AbstractWidgetProps = {
        id: "OneClickLCAWidget",
        label: "One Click LCA",
        getWidgetContent() {
          return <OneClickLCA />;
        },
      };

      widgets.push(OneClickLCAWidget);
    }

    return widgets;
  }
}
