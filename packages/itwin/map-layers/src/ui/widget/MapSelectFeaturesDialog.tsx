/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import { Dialog } from "@itwin/core-react";
import * as React from "react";
import "./MapUrlDialog.scss";

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

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapSelectFeaturesDialog(props: MapSelectFeaturesProps) {
  const [subLayers] = React.useState(props.subLayers);

  const handleOk = React.useCallback(() => {
    props.handleOk(subLayers);
  }, [props, subLayers]);

  const handleCancel = React.useCallback(() => {
    props.handleCancel();
  }, [props]);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk},
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [handleCancel, handleOk]);

  const dialogContainer = React.useRef<HTMLDivElement>(null);
  const [dialogTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.SelectLayersToCreate"));
  return (
    <div ref={dialogContainer}>
      <Dialog
        className="map-layer-url-dialog"
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={120}
        maxWidth={600}
        titleStyle={{ paddingLeft: "10px" }}
        footerStyle={{ paddingBottom: "10px", paddingRight: "10px" }}
        trapFocus={false}
      >
        <div className="map-layer-source-url-subLayers"><SubLayersTree checkboxStyle="standard" subLayers={subLayers} /></div>
      </Dialog>
    </div >
  );
}
