/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GeoAddressSearch.scss";
import * as React from "react";
import { WebFontIcon } from "@itwin/core-react";
import { ComboBox } from "@itwin/itwinui-react";
import { BingAddressProvider } from "../AddressProvider";
import { GeoTools } from "../GeoTools";
import { IModelGeoView } from "../IModelGeoView";

import type { CommonProps } from "@itwin/core-react";
import type { SelectOption } from "@itwin/itwinui-react";
import type { AddressProvider } from "../AddressProvider";

export interface GeoAddressSearchProps extends CommonProps {
  /** Address provider object */
  provider?: AddressProvider;
  /** Indicates whether to set focus to the input element (default to true)*/
  setFocus?: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function GeoAddressSearch(props: GeoAddressSearchProps) {
  const [selectedOption, setSelectedOption] = React.useState("");
  const [options, setOptions] = React.useState<SelectOption<string>[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [isComboBoxMenuOpen, setIsComboBoxMenuOpen] = React.useState(false);

  // `React.useMemo' is used avoid creating new object on each render cycle
  const addressProvider = React.useMemo(() => (props.provider ?? new BingAddressProvider()), [props.provider]);

  const onSuggestionSelected = (value: string): void => {
    setInputValue(value);
    setSelectedOption(value);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    IModelGeoView.locateAddress(value);
  };

  /* The bing address provider sometimes returns multiple suggestions with the same formatted address.
  We make the key unique by appending a number to the key if it already exists in the list of options to
  make sure the comboBox can differentiate between the options. */
  const makeUniqueKey = (allOptions: SelectOption<string>[], newOptionKey: string): string => {
    let key = newOptionKey;
    let i = 1;
    while (allOptions.find((option) => option.key === key)) {
      key = `${newOptionKey}-${i}`;
      i++;
    }

    return key;
  };

  const getOptionsForInputValue = React.useCallback(async (newInputValue: string): Promise<SelectOption<string>[]> => {
    const data: SelectOption<string>[] = [];
    const viewBBox = IModelGeoView.getFrustumLonLatBBox();
    if (viewBBox && newInputValue !== "") {
      const addresses = await addressProvider.getAddresses(newInputValue, viewBBox);

      addresses.forEach((addr) => {
        const key = addr.addressLine ?? addr.formattedAddress;
        const label = addr.formattedAddress;

        if (key) {
          const uniqueKey = makeUniqueKey(data, key);
          data.push({
            id: uniqueKey,
            value: label,
            label,
            key: uniqueKey,
          });
        }
      });
    }

    return data;
  }, [addressProvider]);

  const clearValue = () => {
    setSelectedOption("");
    setOptions([]);
    setInputValue("");
  };

  /** Handler for Enter key. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    // If the Enter key pressed and there are options populated for the combobox, the combobox onChange event would get triggered
    // and we handle the logic to browse to the selected address from the onChange handler. If there are no options populated, and then we
    // handle the logic to browse to the address from the onKeyDown handler since for some user input the address provider may not return any
    // suggestions, for example if the user enters lat long coordinates, but we still want to allow them to browse to the entered coordinates.
    if (event.key === "Enter" && event.currentTarget.value !== "" && !isComboBoxMenuOpen) {
      onSuggestionSelected(event.currentTarget.value);

      event.stopPropagation();
    }

    if (event.key === "Escape") {
      clearValue();
    }
  };

  const onInputValueChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const newInputValue = event.target.value;
    setInputValue(newInputValue);
    const newOptions = await getOptionsForInputValue(newInputValue);
    setOptions(newOptions);
  }, [getOptionsForInputValue]);

  /* We don't want to use the default filtering logic of the ComboBox since we suggest new select options from the Address Provider
  as the user types the input, so we return the options as is */
  const filterFunction = React.useCallback((optionsToFilter: SelectOption<string>[], newInputValue: string) => {
    if (newInputValue === "")
      return [];

    return optionsToFilter;
  }, []);

  return (

    <div className="geotools-geoaddresssearch__container">
      <div className="geotools-geoaddresssearch__autosuggest">
        <ComboBox
          inputProps={{
            id: "geoAddressSearch-input", // passing id to inputProps so it can be used in Label htmlFor
            placeholder: GeoTools.translate("geoAddressSearch.inputPlaceHolder"),
            onChange: onInputValueChange,
            value: inputValue,
            onKeyDown,
            autoFocus: props.setFocus ?? false,
          }}
          dropdownMenuProps={{
            key: options.length > 0 ? options[0].id : "geoAddressSearch-dropdown",
          }}
          endIconProps={{
            disabled: true,
          }}
          onShow={() => setIsComboBoxMenuOpen(true)}
          onHide={() => setIsComboBoxMenuOpen(false)}
          value={selectedOption}
          options={options}
          onChange={onSuggestionSelected}
          multiple={false}
          filterFunction={filterFunction}
          emptyStateMessage={<></>} // We don't want to show the empty state message
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
