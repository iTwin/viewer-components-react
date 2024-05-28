/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { IconButton, LabeledInput } from "@itwin/itwinui-react";
import React, { useState } from "react";
import "./SearchBar.scss";

interface SearchBarProps {
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
}

export const SearchBar = ({ searchValue, setSearchValue, disabled }: SearchBarProps) => {
  const [searchBarOpen, setSearchBarOpened] = useState<boolean>(false);
  const [searchBarClosing, setSearchBarClosing] = useState<boolean>(false);

  return searchBarOpen || searchValue ? (
    <div
      className="ec3w-search-button"
      style={{
        animation: searchBarClosing ? "ec3w-shrink .5s" : "ec3w-expand .5s",
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
        placeholder="Search templates"
        svgIcon={
          <IconButton data-testid="ec3-close-search-bar" onClick={() => setSearchBarClosing(true)} styleType="borderless" title="Clear Search">
            <SvgCloseSmall />
          </IconButton>
        }
        iconDisplayStyle="inline"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        disabled={disabled}
      />{" "}
    </div>
  ) : (
    <IconButton styleType="borderless" title="Search" onClick={() => setSearchBarOpened(true)}>
      <SvgSearch />
    </IconButton>
  );
};
