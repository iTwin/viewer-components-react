/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  AbstractWidgetProps,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import {
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
} from "@itwin/appui-abstract";
import EC3 from "../components/EC3";
import React from "react";
import type { EC3ConfigProps } from "../components/EC3/EC3Config";
import { EC3Config } from "../components/EC3/EC3Config";

export class EC3Provider implements UiItemsProvider {
  public readonly id = "EC3Provider";
  public config: EC3Config;

  constructor(props: EC3ConfigProps) {
    this.config = new EC3Config(props);
  }

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
      const EC3Widget: AbstractWidgetProps = {
        id: "EC3Widget",
        label: "EC3",
        getWidgetContent: () => {
          return <EC3
            config={this.config} />;
        },
      };

      widgets.push(EC3Widget);
    }

    return widgets;
  }
}
