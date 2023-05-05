/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module SearchBox */

import "./SearchBox.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { SvgChevronDown, SvgChevronUp, SvgCloseSmall, SvgSearch } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../TreeWidget";

/** @internal */
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
  /** placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** frequency to poll for changes in value */
  valueChangedDelay?: number;
  title?: string;
}

/** @internal */
export function SearchBox(props: SearchBoxProps) {
  const { className, valueChangedDelay, style, onFilterStart, selectedIndex, resultCount, title,
    onSelectedChanged, onFilterClear, placeholder, searchOpen, onSearchOpen, onSearchClose } = props;
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
    if (searchOpen) {
      inputRef.current?.focus();
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
    <div className={searchClassName} style={style}>
      <input
        ref={inputRef}
        value={searchText}
        onChange={(e) => setSearchText(e.currentTarget.value)}
        onPaste={(e) => setSearchText(e.currentTarget.value)}
        onCut={(e) => setSearchText(e.currentTarget.value)}
        placeholder={
          placeholder ? placeholder : TreeWidget.translate("searchbox.search")
        }
      />
      <SearchResultStepper selectedIndex={selectedIndex} total={resultCount} onStep={onSelectedChanged} />
      <IconButton
        size="small"
        styleType="borderless"
        onClick={toggleSearch}
        title={!searchOpen ? title : undefined}
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
        title="Previous"
      >
        <SvgChevronUp />
      </IconButton>
      <IconButton
        size="small"
        styleType="borderless"
        onClick={handleNextClick}
        title="Next"
      >
        <SvgChevronDown />
      </IconButton>
    </div>
  );
}
