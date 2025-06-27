/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./BasemapPanel.scss";
import * as React from "react";
import { BackgroundMapType, BaseLayerSettings, BaseMapLayerSettings, ColorByName, ColorDef, ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { ColorBuilder, ColorInputPanel, ColorPalette, ColorPicker, ColorSwatch, ColorValue, IconButton, Popover, Select } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { useSourceMapContext } from "./MapLayerManager";
import { TransparencyPopupButton } from "./TransparencyPopupButton";

import type {
  MapImagerySettings} from "@itwin/core-common";
import type { Viewport } from "@itwin/core-frontend";
import type { SelectOption } from "@itwin/itwinui-react";
const customBaseMapValue = "customBaseMap";
interface ExtraFormat {
    selectKeyFromSetting: (base: BaseMapLayerSettings) => string;
}

interface BasemapPanelProps {
  disabled?: boolean;
}

/** @internal */
export function BasemapPanel(props: BasemapPanelProps) {
  const [useColorLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.ColorFill"));
  const { activeViewport, bases } = useSourceMapContext();
  const [selectedBaseMap, setSelectedBaseMap] = React.useState<BaseLayerSettings | undefined>(() => {
    return activeViewport?.displayStyle.settings.mapImagery.backgroundBase;
  });

  const [extraFormats] = React.useState<{[formatId: string]:ExtraFormat}>(()=>{
    const extras: {[formatId: string]:ExtraFormat} = {};
    // TODO: Use format string from format class instead of hardcoded string.
    if (IModelApp.mapLayerFormatRegistry.isRegistered("GoogleMaps")) {
      extras.GoogleMaps = {
        selectKeyFromSetting: (base: BaseMapLayerSettings) => {
          let key = base.formatId;
          if (base.properties?.mapType !== undefined) {
            key = `${key}.${base.properties?.mapType.toString()}`;
            if (base.properties?.layerTypes) {
              key = `${key}-${base.properties?.layerTypes.toString()}`;
            }
          }
          return key;
        }
      }
    }
    return extras;
  });

  const getSelectKeyFromProvider = React.useCallback(
    (base: BaseMapLayerSettings) => {
      if (base.provider) {
        return `${base.formatId}.${BackgroundMapType[base.provider.type]}`;
      }
      if (extraFormats[base.formatId]) {
        return extraFormats[base.formatId].selectKeyFromSetting(base);
      }
      return base.name;
    },
    [extraFormats],
  );

  const [baseMapTransparencyValue, setBaseMapTransparencyValue] = React.useState(() => {
    if (activeViewport) {
      const mapImagery = activeViewport.displayStyle.settings.mapImagery;
      if (mapImagery.backgroundBase instanceof ImageMapLayerSettings) {
        return mapImagery.backgroundBase.transparency;
      } else if (mapImagery.backgroundBase instanceof ColorDef) {
        return mapImagery.backgroundBase.getAlpha() / 255;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  });

  const [customBaseMap, setCustomBaseMap] = React.useState<BaseMapLayerSettings | undefined>();
  const [baseMapVisible, setBaseMapVisible] = React.useState(() => {
    if (activeViewport && activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings) {
      return activeViewport.displayStyle.backgroundMapBase.visible;
    }
    return false;
  });

  const getBaseMapOptions = React.useCallback(
    (baseMap: BaseLayerSettings | undefined) => {
      const baseOptions: SelectOption<string>[] = [];

      baseOptions.push({ value: useColorLabel, label: useColorLabel });

      if (bases) {
        baseOptions.push(
          ...bases.map((base) => {
            const value = getSelectKeyFromProvider(base);
            const label = MapLayersUI.translate(`WellKnownBaseMaps.${value}`);
            return { value, label };
          }),
        );
      }

      const baseMapSelectKey = baseMap ? getSelectKeyFromProvider(baseMap as BaseMapLayerSettings) : "";

      // Add new custom base map definition (avoid adding duplicate entry)
      if (baseMap instanceof BaseMapLayerSettings
        && baseOptions.find((opt) => opt.value === baseMapSelectKey) === undefined
        && !extraFormats[baseMap.formatId]) {
        // Add new option for the custom base map
        if (undefined === baseOptions.find((opt) => opt.label === baseMap.name)) {
          setCustomBaseMap(baseMap);
          baseOptions.push({ value: customBaseMapValue, label: baseMap.name });
        }
      } else if (customBaseMap) {
        // Add previously defined custom map definition
        baseOptions.push({ value: customBaseMapValue, label: customBaseMap.name });
      }
      return baseOptions;
    },
    [bases, customBaseMap, extraFormats, getSelectKeyFromProvider, useColorLabel],
  );

  const [baseMapOptions, setBaseMapOptions] = React.useState<SelectOption<string>[]>(() => getBaseMapOptions(selectedBaseMap));

  const updateBaseMapOptions = React.useCallback(
    (baseMap: BaseLayerSettings | undefined) => {
      setBaseMapOptions(getBaseMapOptions(baseMap));
    },
    [getBaseMapOptions],
  );


  const handleMapImageryChanged = React.useCallback(
    (args: Readonly<MapImagerySettings>) => {
      const baseMap = args.backgroundBase;

      // Optimization:  If serialized 'backgroundBase' objects are identical, skip refresh
      if (JSON.stringify(baseMap.toJSON()) === JSON.stringify(selectedBaseMap?.toJSON())) {
        return;
      }

      setSelectedBaseMap(baseMap); // cache current base map objects
      updateBaseMapOptions(baseMap);

      if (baseMap instanceof ImageMapLayerSettings) {
        if (baseMap.transparency !== baseMapTransparencyValue) {
          setBaseMapTransparencyValue(baseMap.transparency);
        }

        if (baseMap.visible !== baseMapVisible) {
          setBaseMapVisible(baseMap.visible);
        }
      } else if (baseMap instanceof ColorDef) {
        if (baseMap.getAlpha() !== baseMapTransparencyValue) {
          setBaseMapTransparencyValue(baseMap.getAlpha() / 255);
        }
      }
    },
    [baseMapTransparencyValue, baseMapVisible, selectedBaseMap, updateBaseMapOptions],
  );

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

  const handleBasemapTransparencyChange = React.useCallback(
    (transparency: number) => {
      if (activeViewport) {
        activeViewport.displayStyle.changeBaseMapTransparency(transparency);
        setBaseMapTransparencyValue(transparency);
      }
    },
    [activeViewport],
  );

  // This effect is only to keep a custom base map option when a 'default' base map is picked.
  React.useEffect(() => {
    if (
      selectedBaseMap instanceof BaseMapLayerSettings
       && undefined === baseMapOptions.find((opt) => opt.label === selectedBaseMap.name)
       && undefined === extraFormats[selectedBaseMap.formatId]
    ) {
      setCustomBaseMap(selectedBaseMap);
    }
  }, [baseMapOptions, extraFormats, selectedBaseMap]);

  const [presetColors] = React.useState([
    ColorValue.fromTbgr(ColorByName.grey),
    ColorValue.fromTbgr(ColorByName.lightGrey),
    ColorValue.fromTbgr(ColorByName.darkGrey),
    ColorValue.fromTbgr(ColorByName.lightBlue),
    ColorValue.fromTbgr(ColorByName.lightGreen),
    ColorValue.fromTbgr(ColorByName.darkGreen),
    ColorValue.fromTbgr(ColorByName.tan),
    ColorValue.fromTbgr(ColorByName.darkBrown),
  ]);

  const baseIsColor = React.useMemo(() => selectedBaseMap instanceof ColorDef, [selectedBaseMap]);
  const baseIsMap = React.useMemo(() => !baseIsColor && selectedBaseMap !== undefined, [baseIsColor, selectedBaseMap]);
  // bgColor is a 32 bit number represented in TBGR format
  const bgColor = React.useMemo(
    () => (baseIsColor ? (selectedBaseMap as ColorDef).toJSON() : presetColors[0].toTbgr()),
    [baseIsColor, selectedBaseMap, presetColors],
  );
  const [selectedBaseMapValue, setSelectedBaseMapValue] = React.useState<SelectOption<string>>({ value: "", label: "" });

  React.useEffect(() => {
    if (baseIsMap) {
      if (selectedBaseMap instanceof BaseMapLayerSettings
        && (selectedBaseMap.provider || extraFormats[selectedBaseMap.formatId])) {
        const mapName = getSelectKeyFromProvider(selectedBaseMap);
        const foundItem = baseMapOptions.find((value) => value.value === mapName);
        if (foundItem) {
          setSelectedBaseMapValue(foundItem);
          return;
        }
      }

      if (selectedBaseMap instanceof BaseMapLayerSettings) {
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
    setSelectedBaseMapValue({ value: "", label: "" });
  }, [baseIsColor, baseIsMap, baseMapOptions, extraFormats, getSelectKeyFromProvider, selectedBaseMap]);

  const handleBackgroundColorDialogOk = React.useCallback(
    (bgColorValue: ColorValue) => {
      if (activeViewport) {
        const bgColorDef = ColorDef.fromTbgr(bgColorValue.toTbgr());
        // change color and make sure previously set transparency is not lost.
        const curTransparency =
          activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
        activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);

        setSelectedBaseMap(bgColorDef);
      }
    },
    [activeViewport],
  );

  const handleBaseMapSelection = React.useCallback(
    (value: string) => {
      if (activeViewport && value) {
        if (value === customBaseMapValue && customBaseMap) {
          activeViewport.displayStyle.backgroundMapBase = customBaseMap;
        } else if (bases) {
          const baseMap = bases.find((provider) => getSelectKeyFromProvider(provider) === value);
          if (baseMap) {
            const baseProps = baseMap.toJSON();
            if (activeViewport.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings) {
              activeViewport.displayStyle.backgroundMapBase = BaseLayerSettings.fromJSON({ ...baseProps, visible: baseMapVisible });
            } else {
              activeViewport.displayStyle.backgroundMapBase = BaseLayerSettings.fromJSON(baseProps)
            }
          } else {
            const bgColorDef = ColorDef.fromJSON(bgColor);
            const curTransparency =
              activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
            activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);
          }
        }
      }
    },
    [activeViewport, customBaseMap, bases, getSelectKeyFromProvider, baseMapVisible, bgColor],
  );

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
      <div className="map-manager-base-item">
        <IconButton
          data-testid="base-map-visibility-icon-button"
          className="map-manager-basemap-visibility"
          styleType="borderless"
           size="small" label={toggleVisibility}
           onClick={handleVisibilityChange}
           disabled={props.disabled || !activeViewport || !(activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings)}>
        {baseMapVisible
          ? <SvgVisibilityShow data-testid="layer-visibility-icon-show" />
          : <SvgVisibilityHide data-testid="layer-visibility-icon-hide" />}
        </IconButton>
        <Select
          data-testid="base-map-select"
          className="map-manager-base-item-select"
          options={baseMapOptions}
          placeholder={selectBaseMapLabel}
          value={selectedBaseMapValue.value}
          onChange={handleBaseMapSelection}
          size="small"
          disabled={props.disabled}
        />
        {baseIsColor && (
          <Popover
            content={
              <ColorPicker
                selectedColor={ColorValue.fromTbgr(bgColor)}
                onChangeComplete={handleBackgroundColorDialogOk}
              >
                <ColorBuilder />
                <ColorInputPanel defaultColorFormat='rgb' />
                <ColorPalette
                  label="Preset Colors"
                  colors={presetColors}
                />
              </ColorPicker>
            }
          >
            <IconButton label='Show color picker' styleType='borderless' className='map-manager-base-item-color components-color-swatch'>
              <ColorSwatch style={{ pointerEvents: 'none' }} color={ColorValue.fromTbgr(bgColor)} />
            </IconButton>
          </Popover>
        )}
        <TransparencyPopupButton disabled={props.disabled} transparency={baseMapTransparencyValue} onTransparencyChange={handleBasemapTransparencyChange} />
      </div>
    </>
  );
}
