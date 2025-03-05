/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { ComboBox, IconButton, SelectOption } from "@itwin/itwinui-react";

import type { AddressData, AddressProvider } from "../AddressProvider";
import { BingAddressProvider } from "../AddressProvider";
import { IModelGeoView } from "../IModelGeoView";
import { GeoTools } from "../GeoTools";
import "./GeoAddressSearch.scss";

export interface GeoAddressSearchProps {
  /** Address provider object */
  provider?: AddressProvider;
  /** Indicates whether to set focus to the input element (default to true)*/
  setFocus?: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GeoAddressSearch(props: GeoAddressSearchProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [options, setOptions] = React.useState<SelectOption<string>[]>([]);

  // `React.useMemo' is used avoid creating new object on each render cycle
  const addressProvider = React.useMemo(() => props.provider ?? new BingAddressProvider(), [props.provider]);

  const onAddressSelected = (selected: string) => {
    setInputValue(selected);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    IModelGeoView.locateAddress(selected);
  };

  const getAddressesFunc = async (value: string): Promise<AddressData[]> => {
    const viewBBox = IModelGeoView.getFrustumLonLatBBox();
    if (viewBBox && value) {
      return await addressProvider.getAddresses(value, viewBBox);
    }
    return [];
  };

  void React.useEffect(() => {
    void (async () => {
      const items = await getAddressesFunc(inputValue);
      setOptions(items.map((value) => ({ label: value.formattedAddress, value: value.formattedAddress })));
    })();
  }, [inputValue]);

  const clearValue = () => {
    setInputValue("");
  };

  return (
    <div className="geotools-geoaddresssearch__container">
      <div className="geotools-geoaddresssearch__combobox">
        <ComboBox
          options={options}
          inputProps={{
            placeholder: GeoTools.translate("geoAddressSearch.inputPlaceHolder"),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
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
        className="geotools-geoaddresssearch__button"
        onClick={clearValue}
        label={!inputValue ? "" : GeoTools.translate("geoAddressSearch.clearTooltip")}
      >
        {!inputValue ? <SvgSearch style={{ opacity: 0.5 }} /> : <SvgCloseSmall />}
      </IconButton>
    </div>
  );
}
