/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
// cSpell:ignore droppable Sublayer Basemap

import "./BasemapPanel.scss";
import * as React from "react";
import { UiFramework } from "@itwin/appui-react";
import {
  BackgroundMapType, BaseLayerSettings, BaseMapLayerSettings, ColorByName, ColorDef, ImageMapLayerSettings, MapImagerySettings, MapLayerProps,
} from "@itwin/core-common";
import { Viewport } from "@itwin/core-frontend";
import { WebFontIcon } from "@itwin/core-react";
import { ColorPickerDialog, ColorSwatch } from "@itwin/imodel-components-react";
import { Button, Select, SelectOption } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { useSourceMapContext } from "./MapLayerManager";
import { TransparencyPopupButton } from "./TransparencyPopupButton";

const customBaseMapValue = "customBaseMap";
const getSelectKeyFromProvider = (base: BaseMapLayerSettings) => `${base.provider ? `${base.provider.name}.${BackgroundMapType[base.provider.type]}` : `${base.name}`}`;

interface BasemapPanelProps {
  disabled?: boolean;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function BasemapPanel(props: BasemapPanelProps) {
  const [useColorLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.ColorFill"));
  const { activeViewport, bases } = useSourceMapContext();
  const [selectedBaseMap, setSelectedBaseMap] = React.useState<BaseLayerSettings | undefined>(()=> {
    return activeViewport?.displayStyle.settings.mapImagery.backgroundBase;
  });
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
  const [customBaseMap, setCustomBaseMap] = React.useState<BaseMapLayerSettings|undefined>();
  const [baseMapVisible, setBaseMapVisible] = React.useState(() => {
    if (activeViewport && activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings) {
      return activeViewport.displayStyle.backgroundMapBase.visible;
    }
    return false;
  });

  const getBaseMapOptions = React.useCallback((baseMap: BaseLayerSettings|undefined) => {
    const baseOptions: SelectOption<string>[] = [];

    baseOptions.push({ value: useColorLabel, label: useColorLabel });

    if (bases) {
      baseOptions.push(...bases.map((bgProvider) => {
        const value = getSelectKeyFromProvider(bgProvider);
        const label = MapLayersUI.translate(`WellKnownBaseMaps.${value}`);
        return { value, label };
      } ));
    }

    // Add new custom base map definition (avoid adding duplicate entry)
    if (baseMap instanceof BaseMapLayerSettings && !baseMap.provider) {
      // Add new option only if not created duplicate (Support of base map definition without provider)
      if (undefined === baseOptions.find((opt)=>opt.label === baseMap.name)) {
        baseOptions.push({value: customBaseMapValue, label: baseMap.name});
      }
    } else if (customBaseMap) {
      // Add previously defined custom map definition
      baseOptions.push({value: customBaseMapValue, label: customBaseMap.name});
    }
    return  baseOptions;

  }, [bases, customBaseMap, useColorLabel]);

  const [baseMapOptions, setBaseMapOptions] = React.useState<SelectOption<string>[]>(()=>getBaseMapOptions(selectedBaseMap));

  const updateBaseMapOptions = React.useCallback((baseMap: BaseLayerSettings|undefined) => {
    setBaseMapOptions(getBaseMapOptions(baseMap));
  }, [getBaseMapOptions]);

  const handleMapImageryChanged = React.useCallback((args: Readonly<MapImagerySettings>) => {

    const baseMap = args.backgroundBase;

    // Optimization:  If serialized 'backgroundBase' objects are identical, skip refresh
    if (JSON.stringify(baseMap.toJSON()) === JSON.stringify(selectedBaseMap?.toJSON()))
      return;

    setSelectedBaseMap(baseMap);  // cache current base map objects
    updateBaseMapOptions(baseMap);

    if (baseMap instanceof ImageMapLayerSettings) {
      if (baseMap.transparency !== baseMapTransparencyValue)
        setBaseMapTransparencyValue(baseMap.transparency);

      if (baseMap.visible !== baseMapVisible)
        setBaseMapVisible(baseMap.visible);

    } else if (baseMap instanceof ColorDef) {
      if (baseMap.getAlpha() !== baseMapTransparencyValue ) {
        setBaseMapTransparencyValue(baseMap.getAlpha()/255);
      }
    }
  }, [baseMapTransparencyValue, baseMapVisible, selectedBaseMap, updateBaseMapOptions]);

  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport) => {
      handleMapImageryChanged(vp.displayStyle.settings.mapImagery);
    };
    return activeViewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [activeViewport, handleMapImageryChanged]);

  // Monitor display style's onMapImageryChanged event
  React.useEffect(() => {
    return activeViewport?.displayStyle.settings.onMapImageryChanged.addListener(handleMapImageryChanged);
  }, [activeViewport, handleMapImageryChanged]);

  // Monitor viewport updates, and refresh the widget accordingly .
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

  // This effect is only to keep a custom base map option when a 'default' base map is picked.
  React.useEffect(() => {
    if (selectedBaseMap instanceof BaseMapLayerSettings
       && !selectedBaseMap.provider
       && undefined === baseMapOptions.find((opt)=>opt.label === selectedBaseMap.name)) {
      setCustomBaseMap(selectedBaseMap);
    }
  }, [baseMapOptions, selectedBaseMap]);

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

  const baseIsColor = React.useMemo(() => selectedBaseMap instanceof ColorDef, [selectedBaseMap]);
  const baseIsMap = React.useMemo(() => !baseIsColor && (selectedBaseMap !== undefined), [baseIsColor, selectedBaseMap]);
  const bgColor = React.useMemo(() => baseIsColor ? (selectedBaseMap as ColorDef).toJSON(): presetColors[0].toJSON(),
    [baseIsColor, selectedBaseMap, presetColors]);
  const [colorDialogTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:ColorDialog.Title"));
  const [selectedBaseMapValue, setSelectedBaseMapValue] = React.useState<SelectOption<string>>({value: "", label: ""});

  React.useEffect(() => {
    if (baseIsMap) {
      if (selectedBaseMap instanceof BaseMapLayerSettings && selectedBaseMap.provider) {
        const mapName = getSelectKeyFromProvider(selectedBaseMap);
        const foundItem = baseMapOptions.find((value) => value.value === mapName);
        if (foundItem) {
          setSelectedBaseMapValue(foundItem);
          return;
        }
      } else if (selectedBaseMap instanceof BaseMapLayerSettings) {
        // We got a custom base map

        // First check if the name matches a label of existing base map.
        // If it matches, we assume it's a legacy base map definition missing the provider information.
        let foundItem = baseMapOptions.find((opt) => opt.value !== customBaseMapValue && opt.label === selectedBaseMap.name);
        if (foundItem) {
          setSelectedBaseMapValue(foundItem);
          return;
        }

        // Use custom base map entry
        foundItem = baseMapOptions.find((opt) => opt.value === customBaseMapValue);
        if (foundItem) {
          setSelectedBaseMapValue(foundItem);
          return;
        }

      }
    } else if (baseIsColor) {
      setSelectedBaseMapValue(baseMapOptions[0]);
      return;
    }
    setSelectedBaseMapValue({value: "", label: ""});
  }, [baseIsColor, baseIsMap, baseMapOptions, selectedBaseMap]);

  const handleBackgroundColorDialogOk = React.useCallback((bgColorDef: ColorDef) => {
    UiFramework.dialogs.modal.close();
    if (activeViewport) {
      // change color and make sure previously set transparency is not lost.
      const curTransparency = activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
      activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);

      setSelectedBaseMap(bgColorDef);
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
    if (activeViewport && value) {
      if (value === customBaseMapValue && customBaseMap) {
        activeViewport.displayStyle.backgroundMapBase = customBaseMap;
      } else if (bases) {
        const baseMap = bases.find((provider) => getSelectKeyFromProvider(provider) === value);
        if (baseMap) {
          const baseProps: MapLayerProps = baseMap.toJSON();
          if (activeViewport.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings) {
            activeViewport.displayStyle.backgroundMapBase = activeViewport.displayStyle.backgroundMapBase.clone({...baseProps, visible: baseMapVisible});
          } else {
            activeViewport.displayStyle.backgroundMapBase = BaseMapLayerSettings.fromJSON({...baseProps, visible: baseMapVisible});
          }
        } else {
          const bgColorDef = ColorDef.fromJSON(bgColor);
          const curTransparency = activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
          activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);
        }
      }
    }
  }, [activeViewport, customBaseMap, bases, baseMapVisible, bgColor]);

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
      <span className="map-manager-base-label">{baseLayerLabel}</span>
      <div className="map-manager-base-item" >
        <Button className="map-manager-basemap-visibility map-manager-visibility-icon" size="small" styleType="borderless" title={toggleVisibility} onClick={handleVisibilityChange} disabled={props.disabled || !activeViewport || !(activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings)}>
          <WebFontIcon iconName={baseMapVisible ? "icon-visibility" : "icon-visibility-hide-2"} />
        </Button>
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
