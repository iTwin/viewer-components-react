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
import { useFocusedInstancesContext } from "../trees/stateless/common/FocusedInstancesContext";

import type { Viewport } from "@itwin/core-frontend";
import type { CommonProps } from "@itwin/core-react";

/** @internal */
export interface TreeHeaderButtonProps {
  viewport: Viewport;
  density?: "default" | "enlarged";
  onFeatureUsed?: (feature: string) => void;
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
  /** Modifies the density of tree header. `enlarged` header contains larger content */
  density?: "default" | "enlarged";
}

/** @internal */
export function TreeHeader(props: TreeHeaderProps) {
  const { onFilterStart, onFilterClear, resultCount, selectedIndex, onSelectedChanged, children, density, className } = props;
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const { enabled: instanceFocusEnabled } = useFocusedInstancesContext();
  const size = density === "enlarged" ? "large" : "small";

  useEffect(() => {
    // istanbul ignore if
    if (instanceFocusEnabled) {
      onFilterClear();
      setIsSearchOpen(false);
    }
  }, [instanceFocusEnabled, onFilterClear]);

  return (
    <div className={classnames("tree-widget-tree-header", className)}>
      <HeaderButtons contracted={isSearchOpen} size={size}>
        {children}
      </HeaderButtons>
      <DebouncedSearchBox
        isOpened={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onChange={(value) => (value ? onFilterStart(value) : onFilterClear())}
        delay={500}
        selectedResultIndex={selectedIndex}
        resultCount={resultCount}
        onSelectedResultChanged={onSelectedChanged}
        size={size}
        isDisabled={instanceFocusEnabled}
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
  size: "large" | "small";
  isDisabled?: boolean;
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
  size,
  isDisabled,
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
    <SearchBox
      expandable
      isExpanded={isOpened}
      onExpand={onOpen}
      onCollapse={onClose}
      size={size}
      className={classnames("tree-widget-search-box", !isOpened && "contracted")}
      isDisabled={isDisabled}
    >
      <SearchBox.CollapsedState>
        <SearchBox.ExpandButton
          title={TreeWidget.translate("searchBox.searchForSomething")}
          aria-label={TreeWidget.translate("searchBox.open")}
          size={size}
          styleType="borderless"
        />
      </SearchBox.CollapsedState>
      <SearchBox.ExpandedState>
        <SearchBox.Input placeholder={TreeWidget.translate("searchBox.search")} onChange={(e) => setInputValue(e.currentTarget.value)} />
        <SearchResultStepper selectedIndex={selectedResultIndex} total={resultCount} onStep={onSelectedResultChanged} size={size} />
        <SearchBox.CollapseButton
          onClick={() => {
            setInputValue("");
            onClose();
          }}
          size={size}
          aria-label={TreeWidget.translate("searchBox.close")}
        />
      </SearchBox.ExpandedState>
    </SearchBox>
  );
}

interface HeaderButtonsProps {
  contracted: boolean;
  children?: React.ReactNode;
  size: "large" | "small";
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
              .slice(overflowStart)
              .map((btn, index) => (
                <li key={index} className="dropdown-item" role="menuitem">
                  {btn}
                </li>
              ))
          }
          className="tree-header-button-dropdown-container"
        >
          <IconButton title={TreeWidget.translate("dropdownMore")} styleType="borderless" size={props.size}>
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
  size: "large" | "small";
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
        size={props.size}
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
        size={props.size}
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
