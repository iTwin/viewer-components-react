/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module SearchBox */

import React, { useEffect, useRef, useState } from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import { IconButton, ProgressRadial } from "@itwin/itwinui-react";
import {
  SvgChevronDown,
  SvgChevronUp,
  SvgClose,
} from "@itwin/itwinui-icons-react";
import { TreeWidget } from "../../TreeWidget";
import "./SearchBox.scss";

export interface SearchBoxProps extends CommonProps {
  /** value to set SearchBox */
  searchText?: string;
  /** placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** frequency to poll for changes in value */
  valueChangedDelay?: number;
  /** listens for <Enter> keypress */
  onEnterPressed?: () => void;
  /** listens for <Esc> keypress */
  onEscPressed?: () => void;
  /** Close (x) icon click */
  onClose?: () => void;
  /** Callback when text has changed */
  onChange: (newFilter: string) => void;
  /** Tells the component if parent component is still handling the filtering */
  isLoading?: boolean;
  /** Total number of results/entries */
  resultCount: number;
  /** Callback to currently selected result/entry change */
  onSelectedChanged: (index: number) => void;
  /** Enable filter navigation (previous/next buttons) */
  enableFiltering?: boolean;
  /** Set focus to the input component */
  setFocus?: boolean;
}

export const SearchBox = (props: SearchBoxProps) => {
  const {
    enableFiltering,
    searchText,
    className,
    style,
    placeholder,
    isLoading,
    onClose,
    onEnterPressed,
    onEscPressed,
    onChange,
    onSelectedChanged,
    resultCount,
    setFocus,
    valueChangedDelay,
  } = props;

  const inputElement = useRef<HTMLInputElement>(null);
  const [timeoutId, setTimeoutId] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [_searchText, setSearchText] = useState(searchText);

  const trackChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setSearchText(value);
    if (valueChangedDelay) {
      if (timeoutId)
        window.clearTimeout(timeoutId);
      const id = window.setTimeout(() => {
        setSelectedIndex(0);
        onSelectedChanged(0);
        onChange(value);
      }, valueChangedDelay);
      setTimeoutId(id);
    } else {
      onChange(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Escape":
        onEscPressed?.();
        break;
      case "Enter":
        onEnterPressed?.();
        break;
    }
  };

  const onPrevClick = () => {
    if (selectedIndex > 1) {
      onSelectedChanged(selectedIndex - 1);
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const onNextClick = () => {
    if (selectedIndex < resultCount) {
      onSelectedChanged(selectedIndex + 1);
      setSelectedIndex(selectedIndex + 1);
    }
  };

  useEffect(() => {
    if (setFocus) {
      inputElement.current?.focus();
    }
  }, [inputElement, setFocus]);

  useEffect(() => {
    setSearchText(searchText);
  }, [searchText]);

  const searchClassName = classnames("tree-widget-searchbox", className);
  const showCount = resultCount > 0;
  const isPrevEnabled = selectedIndex > 1;
  const isNextEnabled = selectedIndex < resultCount;

  return (
    <div className={searchClassName} style={style}>
      <input
        value={_searchText}
        ref={inputElement}
        onChange={trackChange}
        onKeyDown={handleKeyDown}
        placeholder={
          placeholder ? placeholder : TreeWidget.translate("search")
        }
      />
      {isLoading && (
        <ProgressRadial className="searchbox-spinner" indeterminate />
      )}
      {enableFiltering && (
        <>
          {showCount && (
            <span className="searchbox-stepping-count">{`${selectedIndex}/${resultCount}`}</span>
          )}
          <div className="searchbox-separator" />
          <div className="searchbox-icons-container">
            <IconButton
              size="small"
              styleType="borderless"
              disabled={!isPrevEnabled}
              onClick={onPrevClick}
              title={TreeWidget.translate("previous")}
            >
              <SvgChevronUp />
            </IconButton>
            <IconButton
              size="small"
              styleType="borderless"
              disabled={!isNextEnabled}
              onClick={onNextClick}
              title={TreeWidget.translate("next")}
            >
              <SvgChevronDown />
            </IconButton>
          </div>
        </>
      )}
      <IconButton
        size="small"
        styleType="borderless"
        className="searchbox-close-button"
        onClick={onClose}
        onKeyDown={onClose}
        tabIndex={0}
        title={TreeWidget.translate("close")}
      >
        <SvgClose />
      </IconButton>
    </div>
  );
};

