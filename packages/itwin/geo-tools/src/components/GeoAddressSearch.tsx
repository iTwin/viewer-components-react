/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GeoAddressSearch.scss";
import * as React from "react";
import { useActiveViewport } from "@itwin/appui-react";
import { SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { ComboBox, IconButton } from "@itwin/itwinui-react";
import { GeoTools } from "../GeoTools";
import { IModelGeoView } from "../IModelGeoView";

import type { Viewport } from "@itwin/core-frontend";
import type { SelectOption } from "@itwin/itwinui-react";
import type { AddressData, AddressProvider } from "../AddressProvider";
/**
 * Properties for the <GeoAddressSearch> component.
 */
export interface GeoAddressSearchProps {
  /** Address provider object */
  provider: AddressProvider;

  /** Indicates whether to set focus to the input element (default to true)*/
  setFocus?: boolean;
}
/**
 */
export function GeoAddressSearch(props: GeoAddressSearchProps) {
  const {provider} = props;

  const [inputValue, setInputValue] = React.useState("");
  const [options, setOptions] = React.useState<SelectOption<string>[]>([]);
  const [addressCache, setAddressCache] = React.useState<AddressData[]>([]);
  const activeViewport = useActiveViewport(); // Hook to ensure the component re-renders when the active viewport changes
  const [disabled, setDisabled] = React.useState<boolean>(() => provider.isDisabled({ viewport: activeViewport }) );

  React.useEffect(() => {

    return activeViewport?.onDisplayStyleChanged.addListener(
      (vp)=>{setDisabled(provider?.isDisabled({ viewport: vp }) );}
    );
  }, [activeViewport]);

  const onAddressSelected = async (selected: string) => {
    setInputValue(selected);
    let locatedByPosition = false
    if (provider.supportsAddressLocation()) {
      const address = addressCache.find((addr) => addr.formattedAddress === selected);
        if (address !== undefined) {
          try {
            const location = await provider.getLocation(address);
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
      const addr = await provider.getSuggestions(value, viewBBox);
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
