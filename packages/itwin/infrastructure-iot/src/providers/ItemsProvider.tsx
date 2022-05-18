/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";

import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsProvider } from "@itwin/appui-abstract";

import { DeviceConfigurationWidget } from "../components/widgets/DeviceConfigurationWidget";
import { DeviceDataWidget } from "../components/widgets/DeviceDataWidget";
import { DeviceGraphWidget } from "../components/widgets/DeviceGraphWidget";

export class ItemsProvider implements UiItemsProvider {

  readonly id = "InfrastructureIotUiProvider";

  public provideWidgets(
    stageId: string,
    _stageUsage: string,
    location: StagePanelLocation,
    _section?: StagePanelSection
  ): ReadonlyArray<AbstractWidgetProps> {

    const widgets: AbstractWidgetProps[] = [];

    if (stageId === "DefaultFrontstage" && location === StagePanelLocation.Right) {

      const deviceConfigurationWidget: AbstractWidgetProps = {
        id: "InfrastructureIotDeviceConfigurationWidget",
        label: "IoT Sensors",
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <DeviceConfigurationWidget />;
        },
      };

      const deviceDataWidget: AbstractWidgetProps = {
        id: "InfrastructureIotDeviceDataWidget",
        label: "IoT Sensor Data",
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <DeviceDataWidget />;
        },
      };

      widgets.push(deviceConfigurationWidget, deviceDataWidget);

    } else if (stageId === "DefaultFrontstage" && location === StagePanelLocation.Bottom) {

      const deviceGraphWidget: AbstractWidgetProps = {
        id: "InfrastructureIotDeviceGraphWidget",
        label: "IoT Sensor Data Trend",
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <DeviceGraphWidget />;
        },
      };

      widgets.push(deviceGraphWidget);
    }

    return widgets;

  }

}
