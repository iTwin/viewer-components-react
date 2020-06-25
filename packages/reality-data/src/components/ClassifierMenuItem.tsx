/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/

import "./ClassifierMenuItem.scss";
import classnames from "classnames";
import * as React from "react";
import { AppContext } from "../reality-data-react";
import RealityData from "../api/RealityData";

/** Type of props for ClassifierMenuItem component */
export interface ClassifierMenuItemProps {
  appContext: AppContext;
  /** Name of the context menu item */
  name?: string;
  /** Optional icon */
  icon?: string;
  /** Disabled */
  disabled?: boolean;
  /** Checked or not */
  checked?: boolean;
  /** Separator */
  isSeparator?: boolean;
  /** Called when the item is clicked */
  onClick?: () => void;
  /** Called when delete icon is clicked */
  onDelete?: () => void;
  /** Called when edit icon is clicked */
  onEdit?: () => void;
}

/** ClassifierMenuItem component */
export class ClassifierMenuItem extends React.Component<
  ClassifierMenuItemProps
> {
  private _onClick = (event: any) => {
    event.stopPropagation();
    if (!this.props.disabled && !this.props.isSeparator && this.props.onClick) {
      this.props.onClick();
    }
  };

  private _onDelete = (event: any) => {
    event.stopPropagation();
    if (!this.props.disabled && this.props.onDelete) {
      this.props.onDelete();
    }
  };

  private _onEdit = (event: any) => {
    event.stopPropagation();
    if (!this.props.disabled && this.props.onEdit) {
      this.props.onEdit();
    }
  };

  public render() {
    const menuClassName = classnames(
      "reality-data-classifier-menu-item",
      this.props.disabled && "disabled",
      this.props.checked && "checked"
    );

    return (
      <>
        {this.props.isSeparator && (
          <div className="separator" onClick={this._onClick} />
        )}
        {!this.props.isSeparator && (
          <li className={menuClassName} onClick={this._onClick}>
            {this.props.checked && <span className="icon icon-checkmark" />}
            {this.props.icon && !this.props.checked && (
              <span className={classnames("user-icon icon", this.props.icon)} />
            )}
            <span className="menu-label">{this.props.name}</span>
            <span
              className="icon icon-edit"
              onClick={this._onEdit}
              title={RealityData.translate("createClassifier.edit")}
            />
            <span
              className="icon icon-delete"
              onClick={this._onDelete}
              title={RealityData.translate("createClassifier.delete")}
            />
          </li>
        )}
      </>
    );
  }
}
