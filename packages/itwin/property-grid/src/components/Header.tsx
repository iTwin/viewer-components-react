/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./Header.scss";
import classnames from "classnames";
import { SvgProgressBackwardCircular } from "@itwin/itwinui-icons-react";
import { IconButton, SearchBox  } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager";

import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import type React from "react";

/** @internal */
export interface HeaderProps {
  className?: string;
  onBackButtonClick?: () => void;
  title?: React.ReactNode;
  headerTools?: React.ReactNode;
  onSearchStringChange?: (searchInput: string) => void;
}

export interface DebouncedSearchBoxProps {
  onSearchStringChange: (searchInput: string) => void;
  onClose: () => void;
  onOpen: () => void;
  className: string;
}

export function DebouncedSearchBox({ onSearchStringChange, onClose, onOpen, className }: DebouncedSearchBoxProps){
  const [inputValue, setInputValue] = useState<string>("");
  const onSearchStringChangeRef = useRef(onSearchStringChange);
  onSearchStringChangeRef.current = onSearchStringChange;

  useEffect(() => {
    if (!inputValue) {
      onSearchStringChangeRef.current("");
      return;
    }

    const timeoutId = setTimeout(() => {
      onSearchStringChangeRef.current(inputValue);
    }, 25);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue]);

  return <SearchBox
    expandable
    onCollapse={onClose}
    onExpand={onOpen}
    className={className}
  >
    <SearchBox.CollapsedState>
      <SearchBox.ExpandButton
        title="Expand Searchbar"
      />
    </SearchBox.CollapsedState>
    <SearchBox.ExpandedState >
      <SearchBox.Input
        placeholder={"Search"}
        onChange={(e) => setInputValue(e.currentTarget.value)}
      />
      <SearchBox.CollapseButton
        title="Contract Searchbar"
        onClick={() => {
          setInputValue("");
        }}
      />
    </SearchBox.ExpandedState>
  </SearchBox>;
}

/** @internal */
export function Header({ className, onBackButtonClick, headerTools, title, onSearchStringChange }: PropsWithChildren<HeaderProps>) {
  const [searchBarIsExpanded, setSearchBarIsExpanded] = useState(false);

  return <div className={classnames("property-grid-react-panel-header", searchBarIsExpanded && "search-bar-expanded", className)}>
    <div className="header-title">
      {
        onBackButtonClick
          ? <IconButton
            styleType="borderless"
            onClick={onBackButtonClick}
            title={PropertyGridManager.translate("header.back")}
            className="property-grid-react-header-back-button"
          >
            <SvgProgressBackwardCircular />
          </IconButton>
          : null
      }
      <div className={"header-text"}>
        {title}
      </div>
    </div>
    <div className="header-tools">
      { onSearchStringChange &&
      <DebouncedSearchBox
        onSearchStringChange={onSearchStringChange}
        onClose={() => setSearchBarIsExpanded(false)}
        onOpen={() => setSearchBarIsExpanded(true)}
        className={classnames("expandable-search-bar", !searchBarIsExpanded && "contracted")}
      />}
      {headerTools}
    </div>
  </div>;
}
