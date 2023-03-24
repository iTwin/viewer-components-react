/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import { SearchBox } from "./SearchBox";
import "./SearchBar.scss";
import {
  ButtonGroup,
  DropdownMenu,
  IconButton,
  MenuItem,
} from "@itwin/itwinui-react";
import { SvgMore, SvgSearch } from "@itwin/itwinui-icons-react";

export enum Alignment {
  Left = 0,
  Right = 1,
}

export interface SearchBarProps extends CommonProps {
  /** value to set SearchBox */
  value?: string;
  /** Enable or disable dropdown functionality. If disabled, searchbox simply expands without displaying the group button */
  enableGrouping: boolean;
  /** show the search box in the open (expanded) state */
  showSearch?: boolean;
  /** alignment content to the left or right of the search bar */
  alignment?: Alignment;
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
  onFilterClear?: () => void;
  /** Total number of results/entries */
  resultCount: number;
  /** Callback to currently selected result/entry change */
  onSelectedChanged: (index: number) => void;
}

interface SearchBarState {
  showSearch: boolean;
  showDropdown: boolean;
}

/** SearchBox with expanding search box capability */
export class SearchBar extends React.PureComponent<
SearchBarProps,
SearchBarState
> {
  private _searchBox = React.createRef<SearchBox>();

  public static defaultProps: Partial<SearchBarProps> = {
    alignment: Alignment.Right,
    enableGrouping: true,
  };

  constructor(props: any) {
    super(props);

    this.state = { showSearch: props.showSearch, showDropdown: false };
  }

  public async componentDidUpdate(prevProps: SearchBarProps) {
    if (prevProps.value !== this.props.value) {
    }
  }

  private _onToggleSearch = (
    _event?: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    const showSearch = !this.state.showSearch;
    this.setState({ showSearch }, () => {
      if (showSearch && this._searchBox.current)
        setTimeout(() => {
          if (this._searchBox.current) this._searchBox.current.focus();
        }, 100); // timeout allows the search bar animation to complete!
    });
  };

  public render() {
    const {
      value,
      alignment,
      valueChangedDelay,
      placeholder,
      enableGrouping,
      title,
    } = this.props;
    const { showSearch } = this.state;

    const classes = classnames("tree-widget-search-bar", this.props.className);
    const searchBoxClassName = classnames(
      "search-bar-search-box",
      showSearch && "show"
    );
    const searchIconClassName = classnames(
      "search-bar-search-icon",
      showSearch ? "hide" : "show"
    );
    const contentClassName = classnames(
      "search-bar-button-container",
      showSearch && "contracted",
      alignment === Alignment.Right && "right"
    );

    return (
      <div className={classes}>
        {enableGrouping && <div className={contentClassName}>
          <ButtonGroup
            overflowButton={(overflowStart) => (
              <DropdownMenu
                menuItems={() =>
                  React.Children.toArray(this.props.children)
                    .slice(overflowStart === 0 ? 0 : overflowStart - 1)
                    .map((btn, index) => <MenuItem key={index}>{btn}</MenuItem>)
                }
                className="search-bar-dropdown-container"
              >
                <IconButton styleType="borderless" size="small">
                  <SvgMore />
                </IconButton>
              </DropdownMenu>
            )}
          >
            {this.props.children}
          </ButtonGroup>
        </div>}
        {showSearch ? (
          <div className="search-bar-search-container">
            <SearchBox
              ref={this._searchBox}
              className={searchBoxClassName}
              searchText={value}
              valueChangedDelay={valueChangedDelay}
              placeholder={placeholder}
              onClear={this.props.onFilterClear}
              onFilterStart={this.props.onFilterStart}
              resultCount={this.props.resultCount}
              onIconClick={this._onToggleSearch}
              onSelectedChanged={this.props.onSelectedChanged}
            />
          </div>
        ) : (
          <IconButton
            className={searchIconClassName}
            onClick={this._onToggleSearch}
            title={title}
            styleType="borderless"
            size="small"
          >
            <SvgSearch />
          </IconButton>
        )}
      </div>
    );
  }
}
