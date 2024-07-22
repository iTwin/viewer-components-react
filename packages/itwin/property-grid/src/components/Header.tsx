/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./Header.scss";
import classnames from "classnames";
import { useEffect, useRef, useState } from "react";
import { SvgProgressBackwardCircular } from "@itwin/itwinui-icons-react";
import { IconButton, SearchBox } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager";

import type { PropsWithChildren, ReactNode } from "react";

/** @internal */
export interface HeaderProps {
  className?: string;
  onBackButtonClick?: () => void;
  title?: ReactNode;
  headerTools?: ReactNode;
  onSearchStringChange?: (searchInput: string) => void;
}

export interface DebouncedSearchBoxProps {
  onSearchStringChange: (searchInput: string) => void;
  onClose: () => void;
  onOpen: () => void;
  className: string;
}

function DebouncedSearchBox({ onSearchStringChange, onClose, onOpen, className }: DebouncedSearchBoxProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const onSearchStringChangeRef = useRef(onSearchStringChange);

  useEffect(() => {
    onSearchStringChangeRef.current = onSearchStringChange;
  }, [onSearchStringChange]);

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

  return (
    <SearchBox expandable onCollapse={onClose} onExpand={onOpen} className={className}>
      <SearchBox.CollapsedState>
        <SearchBox.ExpandButton title={PropertyGridManager.translate("search-bar.open")} styleType="borderless" />
      </SearchBox.CollapsedState>
      <SearchBox.ExpandedState>
        <SearchBox.Input
          className="debounced-search-bar-input"
          placeholder={PropertyGridManager.translate("search-bar.placeholder")}
          onChange={(e) => setInputValue(e.currentTarget.value)}
        />
        <SearchBox.CollapseButton
          title={PropertyGridManager.translate("search-bar.close")}
          onClick={() => {
            setInputValue("");
          }}
        />
      </SearchBox.ExpandedState>
    </SearchBox>
  );
}

/** @internal */
export function Header({ className, onBackButtonClick, headerTools, title, onSearchStringChange }: PropsWithChildren<HeaderProps>) {
  const [searchBarIsExpanded, setSearchBarIsExpanded] = useState(false);

  return (
    <div className={classnames("property-grid-react-panel-header", searchBarIsExpanded && "search-bar-expanded", className)}>
      <div className="header-title">
        {onBackButtonClick ? (
          <IconButton
            styleType="borderless"
            onClick={onBackButtonClick}
            title={PropertyGridManager.translate("header.back")}
            className="property-grid-react-header-back-button"
          >
            <SvgProgressBackwardCircular />
          </IconButton>
        ) : null}
        {title}
      </div>
      <div className="header-tools">
        {onSearchStringChange && (
          <DebouncedSearchBox
            onSearchStringChange={onSearchStringChange}
            onClose={() => setSearchBarIsExpanded(false)}
            onOpen={() => setSearchBarIsExpanded(true)}
            className={classnames("expandable-search-bar", !searchBarIsExpanded && "contracted")}
          />
        )}
        {headerTools}
      </div>
    </div>
  );
}
