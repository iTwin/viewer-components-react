/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
// cSpell:ignore droppable Sublayer Basemap

import { UiFramework } from "@itwin/appui-react";
import { BaseLayerProps, BaseLayerSettings, BaseMapLayerSettings, ColorByName, ColorDef, ImageMapLayerSettings, MapImagerySettings, MapLayerProps } from "@itwin/core-common";
import { WebFontIcon } from "@itwin/core-react";
import { ColorPickerDialog, ColorSwatch } from "@itwin/imodel-components-react";
import { Button, Select, SelectOption } from "@itwin/itwinui-react";
import * as React from "react";
import { MapLayersUI } from "../../mapLayers";
import { useSourceMapContext } from "./MapLayerManager";
import { TransparencyPopupButton } from "./TransparencyPopupButton";
import "./BasemapPanel.scss";

function getBaseMapFromStyle(backgroundBase: BaseLayerSettings | undefined) {
  if (!backgroundBase)
    return undefined;

  if (backgroundBase instanceof ImageMapLayerSettings || backgroundBase instanceof ColorDef)
    return backgroundBase.toJSON();

  return undefined;
}

interface BasemapPanelProps {
  disabled?: boolean;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function BasemapPanel(props: BasemapPanelProps) {
  const [useColorLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.ColorFill"));
  const { activeViewport, bases } = useSourceMapContext();
  const [selectedBaseMap, setSelectedBaseMap] = React.useState<BaseLayerProps | undefined>(getBaseMapFromStyle(activeViewport?.displayStyle.settings.mapImagery.backgroundBase));
  const [baseMapTransparencyValue, setBaseMapTransparencyValue] = React.useState(() => {
    if (activeViewport) {
      const mapImagery = activeViewport.displayStyle.settings.mapImagery;
      if (mapImagery.backgroundBase instanceof ImageMapLayerSettings) {
        return mapImagery.backgroundBase.transparency;
      } else if (mapImagery.backgroundBase instanceof ColorDef ) {
        return mapImagery.backgroundBase.getAlpha()/255;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  });

  const [baseMapVisible, setBaseMapVisible] = React.useState(() => {
    if (activeViewport && activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings) {
      return activeViewport.displayStyle.backgroundMapBase.visible;
    }
    return false;
  });

  const handleMapImageryChanged = React.useCallback((args: Readonly<MapImagerySettings>) => {
    // selectedBaseMap
    const baseMap = getBaseMapFromStyle(args.backgroundBase);
    if (JSON.stringify(baseMap) !== JSON.stringify(selectedBaseMap))
      setSelectedBaseMap(baseMap);

    // baseMapTransparencyValue
    if (args.backgroundBase instanceof ImageMapLayerSettings &&  args.backgroundBase.transparency !== baseMapTransparencyValue) {
      setBaseMapTransparencyValue(args.backgroundBase.transparency);
    } else if (args.backgroundBase instanceof ColorDef && args.backgroundBase.getAlpha() !== baseMapTransparencyValue ) {
      setBaseMapTransparencyValue(args.backgroundBase.getAlpha()/255);
    }

    // baseMapVisible
    if (args.backgroundBase instanceof ImageMapLayerSettings &&  args.backgroundBase.visible !== baseMapVisible) {
      setBaseMapVisible(args.backgroundBase.visible);
    }
  }, [baseMapTransparencyValue, baseMapVisible, selectedBaseMap, setBaseMapTransparencyValue, setBaseMapVisible, setSelectedBaseMap]);

  // Monitor display style's onMapImageryChanged event
  React.useEffect(() => {
    return activeViewport?.displayStyle.settings.onMapImageryChanged.addListener(handleMapImageryChanged);
  }, [activeViewport, handleMapImageryChanged]);

  // Monitor viewport updates, and refresh the widget accordingly.
  // Note: This is needed for multiple viewport applications.
  React.useEffect(() => {
    if (activeViewport) {
      handleMapImageryChanged(activeViewport.displayStyle.settings.mapImagery);
    }
  }, [activeViewport, handleMapImageryChanged]);

  const handleBasemapTransparencyChange = React.useCallback((transparency: number) => {
    if (activeViewport) {
      activeViewport.displayStyle.changeBaseMapTransparency(transparency);
      setBaseMapTransparencyValue(transparency);
    }
  }, [activeViewport]);

  const baseMapOptions = React.useMemo<SelectOption<string>[]>(() => {
    const baseOptions: SelectOption<string>[] = [];

    baseOptions.push({ value: useColorLabel, label: useColorLabel });

    if (bases)
      baseOptions.push(...bases.map((value) => ({ value: value.name, label: value.name })));
    return baseOptions;
  }, [bases, useColorLabel]);

  const [presetColors] = React.useState([
    ColorDef.create(ColorByName.grey),
    ColorDef.create(ColorByName.lightGrey),
    ColorDef.create(ColorByName.darkGrey),
    ColorDef.create(ColorByName.lightBlue),
    ColorDef.create(ColorByName.lightGreen),
    ColorDef.create(ColorByName.darkGreen),
    ColorDef.create(ColorByName.tan),
    ColorDef.create(ColorByName.darkBrown),
  ]);

  const baseIsColor = React.useMemo(() => typeof selectedBaseMap === "number", [selectedBaseMap]);
  const baseIsMap = React.useMemo(() => !baseIsColor && (selectedBaseMap !== undefined), [baseIsColor, selectedBaseMap]);
  const bgColor = React.useMemo(() => baseIsColor ? selectedBaseMap as number : presetColors[0].toJSON(), [baseIsColor, selectedBaseMap, presetColors]);
  const [colorDialogTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:ColorDialog.Title"));
  const selectedBaseMapValue = React.useMemo(() => {
    if (baseIsMap) {
      const mapName = (selectedBaseMap! as MapLayerProps).name;
      const foundItem = baseMapOptions.find((value) => value.label === mapName);
      if (foundItem)
        return foundItem;
    }
    return baseMapOptions[0];
  }, [selectedBaseMap, baseMapOptions, baseIsMap]);

  const handleBackgroundColorDialogOk = React.useCallback((bgColorDef: ColorDef) => {
    UiFramework.dialogs.modal.close();
    if (activeViewport) {
      // change color and make sure previously set transparency is not lost.
      const curTransparency = activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
      activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);
      setSelectedBaseMap(bgColorDef.toJSON());
    }
  }, [activeViewport]);

  const handleBackgroundColorDialogCancel = React.useCallback(() => {
    UiFramework.dialogs.modal.close();
  }, []);

  const handleBgColorClick = React.useCallback((newColor: ColorDef, e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();
    UiFramework.dialogs.modal.open(<ColorPickerDialog dialogTitle={colorDialogTitle} color={newColor} colorPresets={presetColors} colorInputType={"rgb"}
      onOkResult={handleBackgroundColorDialogOk} onCancelResult={handleBackgroundColorDialogCancel} />);
  }, [presetColors, handleBackgroundColorDialogOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBaseMapSelection = React.useCallback((value: string) => {
    if (bases && activeViewport && value) {
      const baseMap = bases.find((map) => map.name === value);
      if (baseMap) {
        const baseProps: MapLayerProps = baseMap.toJSON();
        if (activeViewport.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings) {
          activeViewport.displayStyle.backgroundMapBase = activeViewport.displayStyle.backgroundMapBase.clone({...baseProps, visible: baseMapVisible});
        } else {
          activeViewport.displayStyle.backgroundMapBase = BaseMapLayerSettings.fromJSON({...baseProps, visible: baseMapVisible});
        }
        setSelectedBaseMap(baseProps);
      } else {
        const bgColorDef = ColorDef.fromJSON(bgColor);
        const curTransparency = activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
        activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);
        setSelectedBaseMap(bgColorDef.toJSON());
      }
    }
  }, [baseMapVisible, bases, activeViewport, bgColor]);

  const handleVisibilityChange = React.useCallback(() => {
    if (activeViewport) {
      const newState = !baseMapVisible;
      // BaseMap visibility is only support when backgroundBase is an instance of BaseMapLayerSettings (i.e not a color)...
      if (activeViewport.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings) {
        activeViewport.displayStyle.backgroundMapBase = activeViewport.displayStyle.backgroundMapBase.clone({ visible: newState });
      }
      setBaseMapVisible(newState);
    }
  }, [baseMapVisible, activeViewport]);

  const [baseLayerLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.BaseLayer"));
  const [selectBaseMapLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.SelectBaseMap"));
  const [toggleVisibility] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility"));

  return (
    <>
      <div className="map-manager-base-item" >
        <Button className="map-manager-basemap-visibility map-manager-visibility-icon" size="small" styleType="borderless" title={toggleVisibility} onClick={handleVisibilityChange} disabled={props.disabled || !activeViewport || !(activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings)}>
          <WebFontIcon iconName={baseMapVisible ? "icon-visibility" : "icon-visibility-hide-2"} />
        </Button>
        <span className="map-manager-base-label">{baseLayerLabel}</span>
        <Select className="map-manager-base-item-select"
          options={baseMapOptions}
          placeholder={selectBaseMapLabel}
          value={selectedBaseMapValue.value}
          onChange={handleBaseMapSelection} size="small"
          disabled={props.disabled}
        />
        {
          baseIsColor &&
          <ColorSwatch className="map-manager-base-item-color" colorDef={ColorDef.fromJSON(bgColor)} round={false} onColorPick={handleBgColorClick} />
        }
        <TransparencyPopupButton disabled={props.disabled} transparency={baseMapTransparencyValue} onTransparencyChange={handleBasemapTransparencyChange} />
      </div>
    </>
  );
}
