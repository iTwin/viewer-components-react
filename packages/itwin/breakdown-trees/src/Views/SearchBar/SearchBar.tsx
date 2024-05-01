/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import { RelativePosition } from "@itwin/appui-abstract";
import { Popup } from "./Popup";
import { SearchBox } from "./SearchBox";
import { IconButton } from "../IconButton";
import "./SearchBar.scss";

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
  onFilterCancel?: () => void;
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
export class SearchBar extends React.PureComponent<SearchBarProps, SearchBarState> {
  private _target: HTMLElement | null = null;
  private _searchBox = React.createRef<SearchBox>();

  public static defaultProps: Partial<SearchBarProps> = {
    alignment: Alignment.Left,
    enableGrouping: true,
  };

  constructor(props: any) {
    super(props);

    this.state = { showSearch: props.showSearch, showDropdown: false };
  }

  private _onToggleSearch = (_event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    const showSearch = !this.state.showSearch;
    this.setState({ showSearch }, () => {
      if (showSearch && this._searchBox.current)
        setTimeout(() => {
          if (this._searchBox.current)
            this._searchBox.current.focus();
        }, 100); // timeout allows the search bar animation to complete!
    });
  };

  private _onCloseDropdown = () => {
    this.setState({ showDropdown: false });
  };

  private _onToggleDropdown = () => {
    this.setState((prevState) => ({ showDropdown: !prevState.showDropdown }));
  };

  public render() {
    const { value, alignment, valueChangedDelay, placeholder, enableGrouping, title } = this.props;
    const { showSearch, showDropdown } = this.state;

    const classes = classnames("search-bar", this.props.className);
    const searchBoxClassName = classnames("search-bar-search-box", showSearch && "show");
    const groupButtonClassName = classnames("search-bar-group-button2", (showSearch && enableGrouping) && "show");
    const contentClassName = classnames("search-bar-button-container", showSearch && "hide", alignment === Alignment.Right && "right");

    return (
      <div className={classes}>
        <div className={groupButtonClassName} ref={(element) => { this._target = element; }} >
          <IconButton icon="icon-more-2" onClick={this._onToggleDropdown} />
        </div>
        <div className={contentClassName}>
          {this.props.children}
        </div>
        <div className="search-bar-search-container">
          <SearchBox
            ref={this._searchBox}
            className={searchBoxClassName}
            searchText={value}
            valueChangedDelay={valueChangedDelay}
            placeholder={placeholder}
            onClear={this.props.onFilterClear}
            onFilterCancel={this.props.onFilterCancel}
            onFilterClear={this.props.onFilterClear}
            onFilterStart={this.props.onFilterStart}
            resultCount={this.props.resultCount}
            onSelectedChanged={this.props.onSelectedChanged} />
        </div>
        <IconButton className="search-bar-search-icons show" icon="icon-search" onClick={this._onToggleSearch} title={title} />
        {showSearch &&
          <Popup isShown={showDropdown} position={RelativePosition.BottomLeft} onClose={this._onCloseDropdown} context={this._target}>
            <div className="search-bar-dropdown-container">
              {this.props.children}
            </div>
          </Popup>
        }
      </div>
    );
  }
}
