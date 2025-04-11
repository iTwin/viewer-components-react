/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SvgLayers } from "@itwin/itwinui-icons-react";
import { IconButton, Popover } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { SubLayersPanel } from "./SubLayersTree";

import type { SubLayersPanelProps } from "./SubLayersTree";
// cSpell:ignore droppable Sublayer

/** @internal */

export type SubLayersPopupButtonProps = SubLayersPanelProps;

/** @internal */
export function SubLayersPopupButton(props: SubLayersPopupButtonProps) {
  const [showSubLayersLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.Show"));
  const [hideSubLayersLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.Hide"));
  const [popupOpen, setPopupOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    setPopupOpen(!popupOpen);
  }, [popupOpen]);

  return (
    <>
      <Popover
        content={
          <div className="map-transparency-popup-panel">
            <div className="map-manager-sublayer-panel">
              <SubLayersPanel {...props} width={390} height={350} />
            </div>
          </div>
        }
        visible={popupOpen}
        onVisibleChange={setPopupOpen}
        placement="bottom-end"
        applyBackground
        positionReference={buttonRef.current ?? undefined}
      >
        <IconButton
          size="small"
          styleType="borderless"
          ref={buttonRef}
          className="map-manager-item-sub-layer-button"
          label={popupOpen ? hideSubLayersLabel : showSubLayersLabel}
          onClick={togglePopup}
        >
          <SvgLayers />
        </IconButton>
      </Popover>
    </>
  );
}
