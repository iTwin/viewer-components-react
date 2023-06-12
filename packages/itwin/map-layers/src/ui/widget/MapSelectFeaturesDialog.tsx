/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import { Dialog, Icon } from "@itwin/core-react";
import * as React from "react";
import "./MapSelectFeaturesDialog.scss";

import { DialogButtonType } from "@itwin/appui-abstract";
import { MapLayersUI } from "../../mapLayers";
import { MapLayerSource } from "@itwin/core-frontend";
import { MapSubLayerProps } from "@itwin/core-common";
import { SubLayersTree } from "./SubLayersTree";

export interface MapSelectFeaturesProps {
  source: MapLayerSource;
  subLayers: MapSubLayerProps[];
  handleOk: (subLayers: MapSubLayerProps[]) => void;
  handleCancel: () => void;
}
const minHeight = 250;
const maxSubLayers = 30;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapSelectFeaturesDialog(props: MapSelectFeaturesProps) {
  const [subLayers, setSubLayers] = React.useState(props.subLayers);
  const [NoLayersSelectedMsg] = React.useState(()=>MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.NoLayersSelected"));
  const [dialogTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.SelectLayersToCreate"));

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const handleOk = React.useCallback(() => {
    props.handleOk(subLayers);
  }, [props, subLayers]);

  const handleCancel = React.useCallback(() => {
    props.handleCancel();
  }, [props]);

  const hasVisibleLayers = () => subLayers.some((entry)=>entry.visible);
  const hasTooManyVisibleLayers = () => subLayers.filter((entry)=>entry.visible).length > maxSubLayers;
  const readyToSave = () => hasVisibleLayers();
  const buttonCluster = [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !readyToSave() },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ];

  function renderWarningMessage(): React.ReactNode {
    let warningMessage: string | undefined;

    // Get the proper warning message
    if (!hasVisibleLayers()) {
      warningMessage = NoLayersSelectedMsg;
    } else if (hasTooManyVisibleLayers()) {
      warningMessage = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.TooManyLayersSelected", { layerCount: subLayers.filter((entry)=>entry.visible).length});
    }

    if (warningMessage !== undefined) {
      return (
        <div className="map-layer-source-warnMessage">
          <Icon className="map-layer-source-warnMessage-icon" iconSpec="icon-status-warning" />
          <span className="map-layer-source-warnMessage-label">{warningMessage}</span >
        </div>);
    }
    return <></>;
  }

  return (
    <div ref={dialogContainer}>
      <Dialog
        className="map-layer-select-features-dialog"
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={minHeight}
        maxWidth={600}
        titleStyle={{ paddingLeft: "10px" }}
        footerStyle={{ paddingBottom: "10px", paddingRight: "10px" }}
        trapFocus={false}
      >
        <SubLayersTree expandMode="full" checkboxStyle="standard" subLayers={subLayers} onSubLayerStateChange={() => setSubLayers([...subLayers])}/>

        {/* Warning message */}
        {renderWarningMessage()}
      </Dialog>


    </div >
  );
}
