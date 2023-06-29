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
import React from "react";
import type { EC3WidgetProps } from "../components/EC3Widget";
import { EC3Widget } from "../components/EC3Widget";

/* eslint-disable deprecation/deprecation */
export class EC3Provider implements UiItemsProvider {
  public readonly id = "EC3Provider";

  constructor(private readonly _props: EC3WidgetProps) { }

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
      const newEC3Widget: AbstractWidgetProps = {
        id: "EC3Widget",
        label: "EC3",
        getWidgetContent: () => {
          return <EC3Widget {...this._props} />;
        },
      };

      widgets.push(newEC3Widget);
    }

    return widgets;
  }
}
