/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module SearchBox */

import * as React from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import { UiCore } from "@itwin/core-react";
import { IconButton } from "../IconButton";
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
  /** listens for onClick event for Clear (x) icon */
  onClear?: () => void;
  /** Search or clear icon click */
  onIconClick?: () => void;
  /** Filtering is cleared after everything's loaded */
  onFilterStart: (newFilter: string) => void;
  /** Filtering is cleared after everything's loaded */
  onFilterClear?: () => void;
  /** Filtering is cleared after everything's loaded */
  onFilterCancel?: () => void;
  /** Tells the component if parent component is still handling the filtering */
  filteringInProgress?: boolean;
  /** Total number of results/entries */
  resultCount: number;
  /** Callback to currently selected result/entry change */
  onSelectedChanged: (index: number) => void;
  /** Specify that the <input> element should automatically get focus */
  autoFocus?: boolean;
}

/**
 * Enumeration of possible component contexts
 * @internal
 */
export enum InputContext {
  /** Component is ready to filter */
  ReadyToFilter,
  /** Component's parent is currently filtering */
  FilteringInProgress,
  /** Component's parent has finished filtering */
  FilteringFinished,
  /** Component's parent has finished filtering, but ResultSelector(stepping through results) is not enabled */
  FilteringFinishedWithNoStepping,
}

interface SearchBoxState {
  searchText?: string;
  /** @internal */
  context: InputContext;
  /** Currently selected index */
  selectedIndex: number;
}

export class SearchBox extends React.PureComponent<SearchBoxProps, SearchBoxState> {
  private _inputElement: HTMLInputElement | null = null;
  private _timeoutId: number = 0;

  constructor(props: SearchBoxProps) {
    super(props);

    this.state = ({ searchText: this.props.searchText, context: InputContext.ReadyToFilter, selectedIndex: 0 });
  }

  public focus() {
    // istanbul ignore else
    if (this._inputElement) {
      this._inputElement.focus();
    }
  }

  private _trackChange = (_event?: any): void => {
    let searchText = "";

    // istanbul ignore else
    if (this._inputElement)
      searchText = this._inputElement.value;

    this.setState((_prevState) => {
      return { searchText };
    }, () => {
      if (this.props.valueChangedDelay) {
        this._unsetTimeout();
        this._timeoutId = window.setTimeout(() => {
          this.setState({ context: InputContext.ReadyToFilter, selectedIndex: 0 });
          this.props.onSelectedChanged(0);
          this.props.onFilterStart(this.state.searchText!);
        }, this.props.valueChangedDelay);
      } else {
        this.setState({ context: InputContext.ReadyToFilter });
        this.props.onFilterStart(this.state.searchText!);
      }
    });
  };

  private _handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        // istanbul ignore else
        if (this.props.onEscPressed)
          this.props.onEscPressed();
        break;
      case "Enter":
        // istanbul ignore else
        if (this.props.onEnterPressed)
          this.props.onEnterPressed();
        break;
    }
  };

  private _handleIconClick = (): void => {
    // istanbul ignore else
    if (this._inputElement) {
      const clear = this.state.searchText !== "";
      this._inputElement.value = "";
      // istanbul ignore else
      if (clear && this.props.onClear)
        this.props.onClear();
      this._inputElement.focus();
    }
    this._trackChange();
    if (this.props.onIconClick)
      this.props.onIconClick();
  };

  private _unsetTimeout = (): void => {
    if (this._timeoutId) {
      window.clearTimeout(this._timeoutId);
      this._timeoutId = 0;
    }
  };

  public async componentDidUpdate(prevProps: SearchBoxProps) {
    if (prevProps.searchText !== this.props.searchText) {
      const searchText = this.props.searchText;
      this.setState({ searchText });
    }

    this.focus();
  }

  public componentWillUnmount() {
    this._unsetTimeout();
  }

  /** @internal */
  public static getDerivedStateFromProps(props: SearchBoxProps, state: SearchBoxState) {
    if (state.context === InputContext.FilteringInProgress && !props.filteringInProgress) {
      if (state.searchText)
        return { context: InputContext.FilteringFinished };
      else
        return { context: InputContext.FilteringFinishedWithNoStepping };
    } else if (state.context === InputContext.ReadyToFilter && props.filteringInProgress) {
      return { context: InputContext.FilteringInProgress };
    }
    return null;
  }

  private _onPrevClick = () => {
    if (this.state.selectedIndex > 1) {
      this.props.onSelectedChanged(this.state.selectedIndex - 1);
      this.setState((state) => ({ selectedIndex: state.selectedIndex - 1 }));
    }
  };

  private _onNextClick = () => {
    if (this.state.selectedIndex < this.props.resultCount) {
      this.props.onSelectedChanged(this.state.selectedIndex + 1);
      this.setState((state) => ({ selectedIndex: state.selectedIndex + 1 }));
    }
  };

  public render() {
    const { autoFocus, className, style, resultCount, placeholder } = this.props;
    const { searchText, selectedIndex } = this.state;
    const searchClassName = classnames("bldg-uisnip-core-searchbox", className);
    const showCount = resultCount > 0;
    const isPrevEnabled = selectedIndex > 1;
    const isNextEnabled = selectedIndex < resultCount;

    return (
      <div className={searchClassName} style={style}>
        <input
          value={searchText}
          ref={(el) => { this._inputElement = el; }}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          onChange={this._trackChange}
          onKeyDown={this._handleKeyDown}
          onPaste={this._trackChange}
          onCut={this._trackChange}
          placeholder={placeholder ? placeholder : UiCore.translate("searchbox.search")}
        ></input>
        <div className="uisnip-core-searchbox-stepping-container">
          {showCount && <span className="uisnip-core-searchbox-stepping-count">{`${selectedIndex}/${resultCount}`}</span>}
          <div className="uisnip-core-searchbox-separator" />
          <IconButton className="uisnip-core-searchbox-step-button" icon="icon-chevron-up" disabled={!isPrevEnabled} onClick={this._onPrevClick} title="Previous" />
          <IconButton className="uisnip-core-searchbox-step-button" icon="icon-chevron-down" disabled={!isNextEnabled} onClick={this._onNextClick} title="Next" />
        </div>

        <span className="uisnip-core-searchbox-step-button icon icon-close"
          onClick={this._handleIconClick}
          onKeyDown={this._handleIconClick}
          role="button"
          tabIndex={0} />
      </div>
    );
  }
}
