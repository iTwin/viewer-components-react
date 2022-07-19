/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useRef, useState } from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import { SearchBox } from "./SearchBox";
import {
  SvgMore,
  SvgSearch,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  ButtonGroup,
  DropdownMenu,
  IconButton,
  MenuDivider,
  MenuItem,
} from "@itwin/itwinui-react";
import "./SearchBar.scss";

export interface ButtonInfo {
  /** Optional icon (recommended) */
  icon?: JSX.Element;
  /** Optional label (placed before the icon) */
  label?: string;
  /** Optional tooltip (also shown in the overflow dropdown) */
  tooltip?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional display the tool as a separator */
  isSeparator?: boolean;
}

export interface SearchBarProps extends CommonProps {
  /** value to set SearchBox */
  value?: string;
  /** show the search box in the open (expanded) state */
  showSearch?: boolean;
  /** searchbox frequency to poll for changes in value (milliseconds) */
  valueChangedDelay?: number;
  /** searchbox placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** title (tooltip) */
  title?: string;
  /** Tells the component if parent component is still handling the filtering */
  filteringInProgress?: boolean;
  /** Filtering is cleared after everything's loaded */
  onFilterStart: (newFilter: string) => void;
  /** Filtering is cleared after everything's loaded */
  onFilterCancel?: () => void;
  /** Filtering is cleared after everything's loaded */
  onFilterClear?: () => void;
  /** Total number of results/entries */
  resultCount: number;
  /** Callback to currently selected result/entry change */
  onSelectedChanged: (index: number) => void;
  /** Enable filter navigation (previous/next buttons) */
  enableFiltering?: boolean;
  /** Toolbar buttons */
  buttons: ButtonInfo[];
}

/** SearchBox with expanding search box capability */
export const SearchBar = (props: SearchBarProps) => {
  const {
    className,
    enableFiltering,
    value,
    valueChangedDelay,
    placeholder,
    title,
    buttons,
    onFilterStart,
    onSelectedChanged,
    onFilterCancel,
    onFilterClear,
    resultCount,
  } = props;

  const searchBox = useRef<SearchBox>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(props.showSearch);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        if (searchBox.current) searchBox.current.focus();
      }, 250); // timeout allows the search bar animation to complete!
    }
  }, [isSearchOpen]);

  const onToggleSearch = (
    _event?: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    setIsSearchOpen(!isSearchOpen);
  };

  const renderButton = (button: ButtonInfo, index: number) => {
    if (button.isSeparator) {
      return (
        <div className="search-bar-separator" />
      );
    }

    if (button.label) {
      return (
        <Button
          key={index}
          size="small"
          styleType="borderless"
          endIcon={button.icon}
          title={button.tooltip}
          onClick={button.onClick}
        >
          {button.label}
        </Button>
      );
    }

    return (
      <IconButton
        key={index}
        size="small"
        styleType="borderless"
        title={button.tooltip}
        onClick={button.onClick}
      >
        {button.icon}
      </IconButton>
    );
  };

  const renderDropdown = (overflowStart: number) => {
    return (
      <DropdownMenu
        menuItems={(close: () => void) =>
          Array(buttons.length - overflowStart + 1)
            .fill(null)
            .map((_, _index) => {
              const index = overflowStart + _index - 1;

              // currently a bug in ButtonGroup, index
              // should never be -1
              if (index === -1)
                return (
                  <MenuDivider key={index} />
                );

              const tool = buttons[index];
              if (tool.isSeparator)
                return (
                  <MenuDivider key={index} />
                );
              else {
                return (
                  <MenuItem
                    key={index}
                    onClick={() => {
                      close();
                      tool.onClick?.();
                    }}
                    icon={tool.icon}
                  >
                    {tool.tooltip}
                  </MenuItem>
                );
              }
            })
        }
      >
        <IconButton
          size="small"
          styleType="borderless"
          onClick={() => { }}
        >
          <SvgMore />
        </IconButton>
      </DropdownMenu>
    );
  };

  const searchBoxClassName = classnames(
    "search-bar-search-box",
    isSearchOpen && "show"
  );

  const searchIconClassName = classnames(
    "search-bar-search-icon",
    !isSearchOpen && "show"
  );
  const contentClassName = classnames(
    "search-bar-button-group",
    isSearchOpen && "hide",
  );

  return (
    <div className={classnames("filtering-search-bar", className)}>
      <ButtonGroup
        className={contentClassName}
        orientation="horizontal"
        overflowPlacement="end"
        overflowButton={(overflowStart: number) => (
          renderDropdown(overflowStart)
        )}
      >
        {buttons.map((tool: ButtonInfo, index: number) => {
          return (
            renderButton(tool, index)
          );
        })}
      </ButtonGroup>
      <div className="search-bar-search-container">
        <SearchBox
          ref={searchBox}
          className={searchBoxClassName}
          searchText={value}
          valueChangedDelay={valueChangedDelay}
          placeholder={placeholder}
          onFilterCancel={onFilterCancel}
          onFilterClear={onFilterClear}
          onFilterStart={onFilterStart}
          resultCount={resultCount}
          onIconClick={onToggleSearch}
          onSelectedChanged={onSelectedChanged}
          enableFiltering={enableFiltering}
        />
      </div>
      <IconButton
        size="small"
        styleType="borderless"
        className={searchIconClassName}
        onClick={onToggleSearch}
        title={title}
      >
        <SvgSearch />
      </IconButton>
    </div>
  );
};
