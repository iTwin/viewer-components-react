/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeHeader.scss";
import classnames from "classnames";
import { Children, useEffect, useRef, useState } from "react";
import { SvgCaretDownSmall, SvgCaretUpSmall, SvgMore } from "@itwin/itwinui-icons-react";
import { ButtonGroup, Divider, DropdownMenu, IconButton, SearchBox } from "@itwin/itwinui-react";
import { TreeWidget } from "../../TreeWidget";

import type { Viewport } from "@itwin/core-frontend";
import type { CommonProps } from "@itwin/core-react";

/** @internal */
export interface TreeHeaderButtonProps {
  viewport: Viewport;
}

/** @internal */
export interface TreeHeaderProps extends CommonProps {
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
  /** Header buttons */
  children?: React.ReactNode;
}

/** @internal */
export function TreeHeader(props: TreeHeaderProps) {
  const { onFilterStart, onFilterClear, resultCount, selectedIndex, onSelectedChanged, children, className } = props;
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  return (
    <div className={classnames("tree-widget-tree-header", className)}>
      <HeaderButtons contracted={isSearchOpen}>{children}</HeaderButtons>
      <DebouncedSearchBox
        isOpened={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onChange={(value) => (value ? onFilterStart(value) : onFilterClear())}
        delay={500}
        selectedResultIndex={selectedIndex}
        resultCount={resultCount}
        onSelectedResultChanged={onSelectedChanged}
      />
    </div>
  );
}

interface DebouncedSearchBoxProps {
  isOpened: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  delay: number;
  selectedResultIndex?: number;
  resultCount?: number;
  onSelectedResultChanged: (index: number) => void;
}

function DebouncedSearchBox({
  isOpened,
  selectedResultIndex,
  resultCount,
  onSelectedResultChanged,
  onChange,
  onOpen,
  onClose,
  delay,
}: DebouncedSearchBoxProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const onChangeRef = useRef(onChange);
  // save latest `onChange` reference into `useRef` to avoid restarting timeout when `onChange` reference changes.
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!inputValue) {
      onChangeRef.current("");
      return;
    }

    const timeoutId = setTimeout(() => {
      onChangeRef.current(inputValue);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputValue, delay]);

  return (
    <SearchBox expandable onExpand={onOpen} onCollapse={onClose} size="small" className={classnames("tree-widget-search-box", !isOpened && "contracted")}>
      <SearchBox.CollapsedState>
        <SearchBox.ExpandButton title={TreeWidget.translate("searchBox.searchForSomething")} aria-label={TreeWidget.translate("searchBox.open")} size="small" />
      </SearchBox.CollapsedState>
      <SearchBox.ExpandedState>
        <SearchBox.Input
          placeholder={TreeWidget.translate("searchBox.search")}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          className="search-input"
        />
        <SearchResultStepper selectedIndex={selectedResultIndex} total={resultCount} onStep={onSelectedResultChanged} />
        <SearchBox.CollapseButton
          onClick={() => {
            setInputValue("");
            onClose();
          }}
          size="small"
          aria-label={TreeWidget.translate("searchBox.close")}
        />
      </SearchBox.ExpandedState>
    </SearchBox>
  );
}

interface HeaderButtonsProps {
  contracted: boolean;
  children?: React.ReactNode;
}

function HeaderButtons(props: HeaderButtonsProps) {
  const className = classnames("button-container", props.contracted && "contracted");

  return (
    <ButtonGroup
      className={className}
      overflowButton={(overflowStart) => (
        <DropdownMenu
          menuItems={() =>
            Children.toArray(props.children)
              .slice(overflowStart - 1)
              .map((btn, index) => (
                <li key={index} className="dropdown-item" role="menuitem">
                  {btn}
                </li>
              ))
          }
          className="tree-header-button-dropdown-container"
        >
          <IconButton styleType="borderless" size="small">
            <SvgMore />
          </IconButton>
        </DropdownMenu>
      )}
    >
      {props.children}
    </ButtonGroup>
  );
}

interface SearchResultStepperProps {
  total?: number;
  onStep: (newIndex: number) => void;
  selectedIndex?: number;
}

function SearchResultStepper(props: SearchResultStepperProps) {
  const { selectedIndex = 1, total, onStep } = props;
  if (!total) {
    return null;
  }

  return (
    <>
      <span className="searchbox-stepping-count">{`${selectedIndex}/${total}`}</span>
      <Divider orientation="vertical" />
      <SearchBox.Button
        title={TreeWidget.translate("searchBox.previous")}
        size="small"
        onClick={() => {
          if (selectedIndex > 1) {
            onStep(selectedIndex - 1);
          }
        }}
      >
        <SvgCaretUpSmall />
      </SearchBox.Button>
      <SearchBox.Button
        title={TreeWidget.translate("searchBox.next")}
        size="small"
        onClick={() => {
          if (selectedIndex < total) {
            onStep(selectedIndex + 1);
          }
        }}
      >
        <SvgCaretDownSmall />
      </SearchBox.Button>
    </>
  );
}
