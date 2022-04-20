/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { IconButton, LabeledInput } from "@itwin/itwinui-react";
import React from "react";
import "./SearchBar.scss";

interface SearchBarProps {
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;

}

export const SearchBar = ({ searchValue, setSearchValue, disabled }: SearchBarProps) =>
  <LabeledInput
    placeholder={IModelApp.localization.getLocalizedString("ReportsConfigWidget:Search")}
    svgIcon={searchValue ?
      <IconButton onClick={() => setSearchValue("")} styleType='borderless'>
        <SvgCloseSmall />
      </IconButton> : <div className="search-icon"><SvgSearch /></div>
    }
    iconDisplayStyle='inline'
    value={searchValue}
    onChange={(e) => setSearchValue(e.target.value)}
    disabled={disabled}
  />;

