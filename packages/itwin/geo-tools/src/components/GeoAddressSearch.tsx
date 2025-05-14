/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GeoAddressSearch.scss";
import * as React from "react";
import { ComboBox } from "@itwin/itwinui-react";
import { GeoTools } from "../GeoTools";
import { GoogleAddressProvider } from "../GoogleAddressProvider";
import { IModelGeoView } from "../IModelGeoView";

import type { SelectOption } from "@itwin/itwinui-react";
import type { AddressData, AddressProvider } from "../AddressProvider";
export interface GeoAddressSearchProps {
  /** Address provider object */
  provider?: AddressProvider;
  /** Indicates whether to set focus to the input element (default to true)*/
  setFocus?: boolean;
}

export function GeoAddressSearch(props: GeoAddressSearchProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [options, setOptions] = React.useState<SelectOption<string>[]>([]);
  const [addressCache, setAddressCache] = React.useState<AddressData[]>([]);

  // `React.useMemo' is used avoid creating new object on each render cycle
  const addressProvider = React.useMemo(() => props.provider ?? new GoogleAddressProvider(), [props.provider]);
  // const addressProvider = React.useMemo(() => props.provider ?? new BingAddressProvider(), [props.provider]);

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

  // React.useEffect(() => {
  //   void (async () => {
  //     const items = await getAddressesFunc(inputValue);
  //     setOptions(items.map((value) => ({ label: value.formattedAddress ?? "", value: value.formattedAddress ?? "" })));
  //     console.log("setOptions: ", items);
  //   })();
  // }, [inputValue]);

  const clearValue = () => {
    setInputValue("");
    console.log("clearValue");
  };

  return (
    // <div className="geotools-geoaddresssearch__container">
    //   <div className="geotools-geoaddresssearch__combobox">
        <ComboBox
          options={options}
          filterFunction={(options)=>options}
          onHide={()=>clearValue()}
          inputProps={{
            placeholder: GeoTools.translate("geoAddressSearch.inputPlaceHolder"),
            onChange: async (event: React.ChangeEvent<HTMLInputElement>) => {

              const items = await getAddressesFunc(inputValue);
              setAddressCache(items);
              const options = items.map((value) => ({ label: value.formattedAddress ?? "", value: value.formattedAddress ?? "" }))
              console.log("setOptions: ", options);
              setOptions(options);

              setInputValue(event.target.value);
              console.log("onChange: ", event.target.value);

            },
          }}
          onChange={(value: any) => {
            onAddressSelected(value);
          }}
          value={inputValue}
          enableVirtualization
        />
    //   </div>
    //   <IconButton
    //     className="geotools-geoaddresssearch__button"
    //     onClick={clearValue}
    //     label={!inputValue ? "" : GeoTools.translate("geoAddressSearch.clearTooltip")}
    //   >
    //     {!inputValue ? <SvgSearch style={{ opacity: 0.5 }} /> : <SvgCloseSmall />}
    //   </IconButton>
    // </div>
  );
}
