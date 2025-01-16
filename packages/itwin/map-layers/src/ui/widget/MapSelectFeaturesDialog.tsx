/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import "./MapSelectFeaturesDialog.scss";
import * as React from "react";
import { Dialog } from "@itwin/core-react";
import { SvgStatusWarning } from "@itwin/itwinui-icons-color-react";
import { Button, Icon } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { SubLayersTree } from "./SubLayersTree";

import type { MapLayerSource } from "@itwin/core-frontend";
import type { MapSubLayerProps } from "@itwin/core-common";
export interface MapSelectFeaturesProps {
  source: MapLayerSource;
  subLayers: MapSubLayerProps[];
  handleOk: (subLayers: MapSubLayerProps[]) => void;
  handleCancel: () => void;
}
const minHeight = 250;
const maxSubLayers = 30;

export function MapSelectFeaturesDialog(props: MapSelectFeaturesProps) {
  const [subLayers, setSubLayers] = React.useState(props.subLayers);

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const handleOk = React.useCallback(() => {
    props.handleOk(subLayers);
  }, [props, subLayers]);

  const handleCancel = React.useCallback(() => {
    props.handleCancel();
  }, [props]);

  const hasVisibleLayers = () => subLayers.some((entry) => entry.visible);
  const hasTooManyVisibleLayers = () => subLayers.filter((entry) => entry.visible).length > maxSubLayers;
  const readyToSave = () => hasVisibleLayers();

  function renderWarningMessage(): React.ReactNode {
    let warningMessage: string | undefined;

    // Get the proper warning message
    if (!hasVisibleLayers()) {
      warningMessage = MapLayersUI.translate("CustomAttach.NoLayersSelected");
    } else if (hasTooManyVisibleLayers()) {
      warningMessage = MapLayersUI.translate("CustomAttach.TooManyLayersSelected", { layerCount: subLayers.filter((entry) => entry.visible).length });
    }

    return (
      <div className="map-layer-source-warnMessage">
        {warningMessage !== undefined && (
          <>
            <Icon size="small">
              <SvgStatusWarning></SvgStatusWarning>
            </Icon>
            <span className="map-layer-source-warnMessage-label">{warningMessage}</span>
          </>
        )}
      </div>
    );
  }

  function getFooter() {
    return (
      <div className="map-layer-features-footer">
        <div className="map-layer-features-footer-warnMessage">{renderWarningMessage()}</div>

        <div className="map-layer-features-footer-buttons">
          <Button className="map-layer-features-footer-button" styleType="high-visibility" onClick={handleOk} disabled={!readyToSave()}>
            {MapLayersUI.translate("Dialog.Add")}
          </Button>
          <Button className="map-layer-features-footer-button" styleType="default" onClick={handleCancel}>
            {MapLayersUI.translate("Dialog.Cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={dialogContainer}>
      <Dialog
        className="map-layer-select-features-dialog"
        title={MapLayersUI.translate("CustomAttach.SelectLayersToCreate")}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        footer={getFooter()}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={minHeight}
        maxWidth={600}
        titleStyle={{ paddingLeft: "10px" }}
        footerStyle={{ paddingBottom: "10px", paddingRight: "10px" }}
        trapFocus={false}
      >
        {/* 'onSubLayerStateChange' is used to trigger hook state change only, no need to update subLayer objects */}
        <SubLayersTree expandMode="full" checkboxStyle="standard" subLayers={subLayers} onSubLayerStateChange={() => setSubLayers([...subLayers])} />
      </Dialog>
    </div>
  );
}
