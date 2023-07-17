/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import { StagePanelLocation, StagePanelSection, StageUsage, useActiveIModelConnection } from "@itwin/appui-react";
import type { AccessToken } from "@itwin/core-bentley";
import { toggleProjectExtents } from "@itwin/frontend-devtools";
import { SvgNetwork, SvgPerspective } from "@itwin/itwinui-icons-react";
import { Button, Tab, Tabs, ToggleSwitch } from "@itwin/itwinui-react";
import type { RealityDataAccessClient } from "@itwin/reality-data-client";
import React, { useState } from "react";

import "./GeospatialProvider.scss";
import { IModelGCS } from "./IModelGCS";
import { RealityDataWidget } from "./RealityData";

const Feedback = () => {
  return (
    <div className="feedback">
      {"Your feedback is always helpful!"}
      <Button
        styleType="high-visibility"
        onClick={() => {
          window.open("https://forms.office.com/r/SpB3Tugt0Y", "_blank");
        }}
      >
        Leave Feedback
      </Button>
    </div>
  );
};

const GeospatialWidget = ({
  getAccessToken,
  rdClient,
}: {
  getAccessToken: () => AccessToken;
  rdClient: RealityDataAccessClient;
}) => {
  const iModelConnection = useActiveIModelConnection();

  const [index, setIndex] = useState(0);
  const getContent = () => {
    switch (index) {
      case 0:
        return <IModelGCS />;
      case 1:
        return <RealityDataWidget accessToken={getAccessToken()} rdClient={rdClient} />;
      default:
        return "UH OH";
    }
  };
  return (
    <div className="geospatial-widget">
      {iModelConnection && (
        <div className="toggle-switch">
          <ToggleSwitch
            label={"Show iTwin Extents"}
            icon={<SvgPerspective />}
            onChange={(e) => {
              toggleProjectExtents(iModelConnection, e.target.checked);
            }}
          />
        </div>
      )}
      <div className="grid-holding-tab">
        <Tabs
          labels={[<Tab key={1} label="iModel" />, <Tab key={2} label="Reality Data" />]}
          onTabSelected={setIndex}
          wrapperClassName="geospatial-widget-property-grid"
          type="pill"
        >
          {getContent()}
        </Tabs>
      </div>
      <div>
        <Feedback />
      </div>
    </div>
  );
};

export class GeospatialProvider implements UiItemsProvider {
  public readonly id = "GeospatialProvider";
  private static widgetId = "GeospatialProvider:Widget";

  constructor(private getAccessToken: () => AccessToken, private rdClient: RealityDataAccessClient) {}

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection
  ): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];

    if (
      stageUsage === StageUsage.General &&
      location === StagePanelLocation.Right &&
      section === StagePanelSection.Start
    ) {
      widgets.push({
        id: GeospatialProvider.widgetId,
        label: "Geospatial Metadata",
        content: <GeospatialWidget getAccessToken={this.getAccessToken} rdClient={this.rdClient} />,
        icon: <SvgNetwork />,
        allowedPanels: [StagePanelLocation.Right, StagePanelLocation.Left],
      });
    }
    return widgets;
  }
}
