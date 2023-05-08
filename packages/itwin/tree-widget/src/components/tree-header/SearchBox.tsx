/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./SearchBox.scss";
import classnames from "classnames";
import * as React from "react";
import { SvgChevronDown, SvgChevronUp, SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../TreeWidget";

import type { CommonProps } from "@itwin/core-react";

export interface SearchBoxProps extends CommonProps {
  /** Specifies whether search bar should be open */
  searchOpen: boolean;
  /** Callback that is invoked when button to open search is clicked */
  onSearchOpen: () => void;
  /** Callback that is invoked when button to close search is clicked */
  onSearchClose: () => void;
  /** Filtering is cleared after everything's loaded */
  onFilterStart: (newFilter: string) => void;
  /** listens for onClick event for Clear (x) icon */
  onFilterClear: () => void;
  /** Total number of results/entries */
  resultCount?: number;
  /** Current selected result index */
  selectedIndex?: number;
  /** Callback to currently selected result/entry change */
  onSelectedChanged: (index: number) => void;
  /** Frequency to poll for changes in value */
  valueChangedDelay?: number;
}

export function SearchBox(props: SearchBoxProps) {
  const { className, valueChangedDelay = 500, style, onFilterStart, selectedIndex, resultCount,
    onSelectedChanged, onFilterClear, searchOpen, onSearchOpen, onSearchClose } = props;
  const [searchText, setSearchText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!searchText) {
      onFilterClear();
      return;
    }

    const timeoutId = setTimeout(() => {
      onFilterStart(searchText);
    }, valueChangedDelay);

    return () => clearTimeout(timeoutId);
  }, [searchText, valueChangedDelay, onFilterClear, onFilterStart]);

  React.useEffect(() => {
    if (searchOpen && inputRef.current ) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const toggleSearch = () => {
    if (!searchOpen) {
      onSearchOpen();
      return;
    }
    setSearchText("");
    onSearchClose();
  };

  const searchClassName = classnames(
    "tree-widget-searchbox",
    className,
    searchOpen && "open",
  );

  return (
    <div className={searchClassName} style={style} role="search" aria-label={TreeWidget.translate("searchBox.tree")}>
      <input
        ref={inputRef}
        value={searchText}
        onChange={(e) => setSearchText(e.currentTarget.value)}
        placeholder={TreeWidget.translate("searchBox.search")}
        type="text"
        role="searchbox"
      />
      <SearchResultStepper selectedIndex={selectedIndex} total={resultCount} onStep={onSelectedChanged} />
      <IconButton
        size="small"
        styleType="borderless"
        onClick={toggleSearch}
        title={!searchOpen ? TreeWidget.translate("searchBox.searchForSomething") : undefined}
        aria-label={searchOpen ? TreeWidget.translate("searchBox.close") : TreeWidget.translate("searchBox.open")}
      >
        {searchOpen ? <SvgCloseSmall /> : <SvgSearch />}
      </IconButton>
    </div>
  );
}

interface SearchResultStepperProps {
  selectedIndex?: number;
  total?: number;
  onStep: (newIndex: number) => void;
}

function SearchResultStepper(props: SearchResultStepperProps) {
  const { selectedIndex, total, onStep } = props;
  if (total === undefined || total === 0)
    return null;

  const currentIndex = selectedIndex ?? 1;
  const handleNextClick = () => {
    const newIndex = currentIndex + 1;
    if (newIndex <= total) {
      onStep(newIndex);
    }
  };

  const handlePrevClick = () => {
    const newIndex = currentIndex - 1;
    if (newIndex >= 1) {
      onStep(newIndex);
    }
  };

  return (
    <div className="searchbox-stepping-container">
      <span className="searchbox-stepping-count">{`${currentIndex}/${total}`}</span>
      <div className="searchbox-separator" />
      <IconButton
        size="small"
        styleType="borderless"
        onClick={handlePrevClick}
        title={TreeWidget.translate("searchBox.previous")}
      >
        <SvgChevronUp />
      </IconButton>
      <IconButton
        size="small"
        styleType="borderless"
        onClick={handleNextClick}
        title={TreeWidget.translate("searchBox.next")}
      >
        <SvgChevronDown />
      </IconButton>
    </div>
  );
}
