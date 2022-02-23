/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GeoAddressSearch.scss";

import type { AutoSuggestData, CommonProps} from "@itwin/core-react";
import { AutoSuggest, WebFontIcon } from "@itwin/core-react";
import type { AddressProvider} from "../AddressProvider";
import { BingAddressProvider } from "../AddressProvider";
import * as React from "react";
import type * as ReactAutosuggest from "react-autosuggest";
import { IModelGeoView } from "../IModelGeoView";
import { GeoTools } from "../GeoTools";

export interface GeoAddressSearchProps extends CommonProps {
  /** Address provider object */
  provider?: AddressProvider;
  /** Indicates whether to set focus to the input element (default to true)*/
  setFocus?: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GeoAddressSearch(props: GeoAddressSearchProps) {
  const [inputValue, setInputValue] = React.useState("");

  // `React.useMemo' is used avoid creating new object on each render cycle
  const addressProvider = React.useMemo(() => (props.provider ?? new BingAddressProvider()), [props.provider]);

  const onSuggestionSelected = (selected: AutoSuggestData) => {
    setInputValue(selected.label);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    IModelGeoView.locateAddress(selected.label);
  };

  const getAutoSuggestDataFunc = async (value: string) => {

    const data: AutoSuggestData[] = [];
    const viewBBox = IModelGeoView.getFrustumLonLatBBox();
    if (viewBBox) {
      const addresses = await addressProvider.getAddresses(value, viewBBox);

      addresses.forEach((addr) => { data.push({ value: addr.addressLine, label: addr.formattedAddress }); });
    }
    return Promise.resolve(data);
  };

  const clearValue = () => {
    setInputValue("");
  };

  /** Handler for Enter key. */
  const onPressEnter = (_e: React.KeyboardEvent<HTMLInputElement>) => {
    if (inputValue)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IModelGeoView.locateAddress(inputValue);
  };

  /** Handler for Escape key. */
  const onPressEscape = (_e: React.KeyboardEvent<HTMLInputElement>) => {
    clearValue();
  };

  const getLabel = (value: string | undefined) => {
    if (value)
      return value;
    else
      return "";
  };

  /** We implement a custom render mainly to hook on the onChange callback, which is not exposed
   * by AutoSuggest.
   */
  const renderInput = React.useCallback(((inputProps: ReactAutosuggest.InputProps<AutoSuggestData>): React.ReactNode => {
    const { onChange, ...otherProps } = inputProps;
    return (
      <input type="text"
        onChange={(event) => {
          onChange(event, { newValue: event.target.value, method: "type" });
          setInputValue(event.target.value);
        }}
        {...otherProps}
      />
    );
  }), []);

  return (

    <div className="geotools-geoaddresssearch__container">
      <div className="geotools-geoaddresssearch__autosuggest">
        <AutoSuggest
          value={inputValue}
          getLabel={getLabel}
          placeholder={GeoTools.translate("geoAddressSearch.inputPlaceHolder")}
          onSuggestionSelected={onSuggestionSelected}
          getSuggestions={getAutoSuggestDataFunc}
          onPressEnter={onPressEnter}
          onPressEscape={onPressEscape}
          renderInputComponent={renderInput}
          setFocus={props.setFocus ?? true}
        />
      </div>

      <button className="geotools-geoaddresssearch__button" onClick={clearValue}>
        {(!inputValue || inputValue === "") ?
          <WebFontIcon iconName="icon-search" iconSize="small" style={{ opacity: 0.5 }} />
          : <WebFontIcon iconName="icon-close" iconSize="small" />
        }
      </button>
    </div>
  );
}