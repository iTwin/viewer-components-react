/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { RelativePosition } from "@itwin/appui-abstract";
import { OutsideClickEvent, Popup, useOnOutsideClick, WebFontIcon } from "@itwin/core-react";
import { SubLayersPanel, SubLayersPanelProps } from "./SubLayersTree";
import { MapLayersUI } from "../../mapLayers";
import { Button } from "@itwin/itwinui-react";

// cSpell:ignore droppable Sublayer

/** @internal */

export type SubLayersPopupButtonProps = SubLayersPanelProps;

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function SubLayersPopupButton(props: SubLayersPopupButtonProps) {

  const [showSubLayersLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.Show"));
  const [hideSubLayersLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.Hide"));
  const [popupOpen, setPopupOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    setPopupOpen(!popupOpen);
  }, [popupOpen]);

  const onOutsideClick = React.useCallback(() => {
    setPopupOpen(false);
  }, []);

  const isOutsideEvent = React.useCallback((e: OutsideClickEvent) => {
    // if clicking on button that open panel - don't trigger outside click processing
    return !!buttonRef.current && (e.target instanceof Node) && !buttonRef.current.contains(e.target);
  }, []);

  const panelRef = useOnOutsideClick<HTMLDivElement>(onOutsideClick, isOutsideEvent);

  return (
    <>
      <Button size="small" styleType="borderless" ref={buttonRef} className="map-manager-item-sub-layer-button" title={popupOpen ? hideSubLayersLabel : showSubLayersLabel}
        onClick={togglePopup}>
        <WebFontIcon iconName="icon-layers" />
      </Button>
      <Popup
        isOpen={popupOpen}
        position={RelativePosition.BottomRight}
        onClose={onOutsideClick}
        target={buttonRef.current}
      >
        <div className="map-transparency-popup-panel">
          <div ref={panelRef} className="map-manager-sublayer-panel">
            <SubLayersPanel {...props} width={390} height={350}/>
          </div>
        </div>
      </Popup >
    </>
  );
}
