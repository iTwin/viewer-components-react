/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./MapLayerSettingsPopupButton.scss";
import * as React from "react";
import { SvgSettings } from "@itwin/itwinui-icons-react";
import { IconButton, Popover } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { MapManagerSettings } from "./MapManagerSettings";

export interface MapLayerSettingsPopupButtonProps {
  disabled?: boolean;
}

/** @alpha */
export function MapLayerSettingsPopupButton(props: MapLayerSettingsPopupButtonProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [buttonTooltip] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.SettingsButtonTooltip"));
  const [handleOutsideClick, setHandleOutsideClick] = React.useState(true);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const togglePopupDisplay = React.useCallback(
    () => {
      setIsSettingsOpen(!isSettingsOpen);
    },
    [isSettingsOpen],
  );

  const isInsideCoreDialog = React.useCallback((element: HTMLElement) => {
    if (element.nodeName === "DIV") {
      if (element.classList && element.classList.contains("core-dialog")) {
        return true;
      }
      if (element.parentElement && isInsideCoreDialog(element.parentElement)) {
        return true;
      }
    } else {
      // istanbul ignore else
      if (element.parentElement && isInsideCoreDialog(element.parentElement)) {
        return true;
      }
    }
    return false;
  }, []);


  return (
    <>
      <Popover
        className="maplayers-settings-popup"
        content={
          <div ref={panelRef} className="maplayers-settings-popup-panel">
            <MapManagerSettings onHandleOutsideClick={setHandleOutsideClick}/>
          </div>
        }
        visible={isSettingsOpen}
        onVisibleChange={setIsSettingsOpen}
        placement="bottom-end"
        closeOnOutsideClick={handleOutsideClick}
        applyBackground
      >
        <IconButton
          disabled={props.disabled}
          styleType="borderless"
          label={buttonTooltip}
          className="maplayers-settings-popup-button"
          onClick={togglePopupDisplay}
          ref={buttonRef}
        >
          <SvgSettings />
        </IconButton>
      </Popover>
    </>
  );
}
