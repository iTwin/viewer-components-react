/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GeoAddressSearch.scss";
import * as React from "react";
import { useActiveViewport } from "@itwin/appui-react";
import { BaseMapLayerSettings } from "@itwin/core-common";
import { SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { ComboBox, IconButton } from "@itwin/itwinui-react";
import { BingAddressProvider } from "../BingAddressProvider";
import { GeoTools } from "../GeoTools";
import { GoogleAddressProvider } from "../GoogleAddressProvider";
import { IModelGeoView } from "../IModelGeoView";

import type { Viewport } from "@itwin/core-frontend";
import type { SelectOption } from "@itwin/itwinui-react";
import type { AddressData, AddressProvider } from "../AddressProvider";
/**
 * Properties for the <GeoAddressSearch> component.
 */
export interface GeoAddressSearchProps {
  /** Address provider object */
  provider?: AddressProvider;
  /** Indicates whether to set focus to the input element (default to true)*/
  setFocus?: boolean;
}

const isGoogleBaseMap = (vp?: Viewport): boolean => {
      return (
          vp?.viewFlags.backgroundMap === true
          && vp?.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings
          && vp.displayStyle.backgroundMapBase.formatId === "GoogleMaps"
      );
};
const isValidBaseMap = (provider: AddressProvider, vp?: Viewport) => {
  const isGoogleAddressProvider = provider instanceof GoogleAddressProvider;
  return !isGoogleAddressProvider || (isGoogleAddressProvider && isGoogleBaseMap(vp));
}

/**
 * <GeoAddressSearch> react component
 */
export function GeoAddressSearch(props: GeoAddressSearchProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [options, setOptions] = React.useState<SelectOption<string>[]>([]);
  const [addressCache, setAddressCache] = React.useState<AddressData[]>([]);
  const activeViewport = useActiveViewport(); // Hook to ensure the component re-renders when the active viewport changes
  const [disabled, setDisabled] = React.useState<boolean>(() => isGoogleBaseMap(activeViewport));

  // `React.useMemo' is used avoid creating new object on each render cycle
  // Default is Bing provider, but we might want to default to Google in the future
  const addressProvider = React.useMemo(() => props.provider ?? new BingAddressProvider(), [props.provider]);

  React.useEffect(() => {
    setDisabled(!isValidBaseMap(addressProvider, activeViewport));
    return activeViewport?.onDisplayStyleChanged.addListener(
      (vp)=>{setDisabled(!isValidBaseMap(addressProvider, vp));}
    );
  }, [activeViewport]);

  const onAddressSelected = async (selected: string) => {
    setInputValue(selected);
    let locatedByPosition = false
    if (addressProvider.supportsAddressLocation()) {
      const address = addressCache.find((addr) => addr.formattedAddress === selected);
        if (address !== undefined) {
          try {
            const location = await addressProvider.getLocation(address);
            if (location) {
              locatedByPosition = await IModelGeoView.locatePosition(location);
            }
          } catch (error) {
        }
      }
    }
    if (!locatedByPosition) {
      await IModelGeoView.locateAddress(selected);
    }
  };

  const getAddressesFunc = async (value: string): Promise<AddressData[]> => {
    const viewBBox = IModelGeoView.getFrustumLonLatBBox();
    if (viewBBox && value) {
      const addr = await addressProvider.getSuggestions(value, viewBBox);
      setAddressCache(addr);
      return addr;
    }
    return [];
  };


  const clearValue = () => {
    setInputValue("");
    setOptions([]);
  };

  return (
    <div className="geotools-geoaddresssearch__container">
      <div className="geotools-geoaddresssearch__combobox">
        <ComboBox

          options={options}
          filterFunction={(options)=>options} // disable filtering as it can interfere with the address provider
          emptyStateMessage={GeoTools.translate("geoAddressSearch.noResults")}
          onHide={()=>clearValue()}
          inputProps={{
            disabled,
            placeholder: disabled ? GeoTools.translate("geoAddressSearch.invalidBaseMap") : GeoTools.translate("geoAddressSearch.inputPlaceHolder"),
            onChange: async (event: React.ChangeEvent<HTMLInputElement>) => {

              const items = await getAddressesFunc(inputValue);
              setAddressCache(items);
              const options = items.map((value) => ({ label: value.formattedAddress ?? "", value: value.formattedAddress ?? "" }))
              setOptions(options);

              setInputValue(event.target.value);
            },
          }}
          onChange={(value: any) => {
            onAddressSelected(value);

          }}
          value={inputValue}
          enableVirtualization
        />
      </div>

      <IconButton
        disabled={disabled}
        className="geotools-geoaddresssearch__button"
        onClick={clearValue}
        label={!inputValue ? "" : GeoTools.translate("geoAddressSearch.clearTooltip")} >
          {!inputValue ? <SvgSearch style={{ opacity: 0.5 }} /> : <SvgCloseSmall />}
      </IconButton>
  </div>
  );
}
