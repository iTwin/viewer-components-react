/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { IconButton, LabeledInput } from "@itwin/itwinui-react";
import React, { useState } from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import "./SearchBar.scss";

interface SearchBarProps {
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
}

export const SearchBar = ({
  searchValue,
  setSearchValue,
  disabled,
}: SearchBarProps) => {
  const [searchBarOpen, setSearchBarOpened] = useState<boolean>(false);
  const [searchBarClosing, setSearchBarClosing] = useState<boolean>(false);

  return searchBarOpen || searchValue ? (
    <div className="rcw-search-button"
      style={{
        animation: searchBarClosing ? "rcw-shrink .5s" : "rcw-expand .5s",
      }}
      onAnimationEnd={() => {
        if (searchBarClosing) {
          setSearchBarClosing(false);
          setSearchBarOpened(false);
          setSearchValue("");
        }
      }}
    >
      <LabeledInput
        aria-label="search-textbox"
        placeholder={ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:Search"
        )}
        svgIcon={
          <IconButton
            onClick={() => setSearchBarClosing(true)}
            styleType="borderless"
            title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ClearSearch")}
          >
            <SvgCloseSmall />
          </IconButton>
        }
        iconDisplayStyle="inline"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        disabled={disabled}
      />
    </div>
  ) : (
    <IconButton
      styleType="borderless"
      data-testid="rcw-search-button"
      title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:SearchReport")}
      onClick={() => setSearchBarOpened(true)}>
      <SvgSearch />
    </IconButton>
  );
};
