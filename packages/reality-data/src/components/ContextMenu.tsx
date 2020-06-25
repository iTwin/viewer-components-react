/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import "./ContextMenu.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition as Position } from "@bentley/ui-abstract";
import { CommonProps, Popup } from "@bentley/ui-core";

/** Type of props for ContextMenuItem component */
export interface ContextMenuItemProps {
  /** Name of the context menu item */
  name?: string;
  /** Optional icon */
  icon?: string;
  /** Disabled */
  disabled?: boolean;
  /** Checked or not */
  checked?: boolean;
  /** Called when the item is clicked */
  onClick?: () => void;
}

/** Item in a ContextMenu component */
export const ContextMenuItem = (props: ContextMenuItemProps) => {
  return (
    <li
      className={classnames(
        "reality-data-context-menu-item",
        props.disabled && "disabled",
        props.checked && "checked",
      )}
      onClick={(evt) => {
        evt.stopPropagation();
        if (!props.disabled && props.onClick) {
          props.onClick();
        }
      }}
    >
      {props.checked && <span className="icon icon-checkmark" />}
      {props.icon && !props.checked && (
        <span className={classnames("user-icon icon", props.icon)} />
      )}
      <span>{props.name}</span>
    </li>
  );
};

/** Separator of items in a ContextMenu component */
export const ContextMenuSeparator = () => <div className="separator" />;

/** Type of props for ContextMenu component */
export interface ContextMenuProps extends CommonProps {
  /** Show or hide the context menu */
  isOpened: boolean;
  /** Position the context menu relative to the parent */
  position: Position;
  /** List of context menu items */
  items?: ContextMenuItemProps[];
  /** Called when the mouse is clicked outside the context menu */
  onClickOutside?: () => void;
  /** parent element */
  parent: HTMLElement | null;
}

/** ContextMenu component, can contain ContextMenuItems */
export class ContextMenu extends React.Component<ContextMenuProps> {
  public render() {
    const { items, parent, position, isOpened, onClickOutside } = this.props;
    const contentClassName = classnames(
      "reality-data-context-menu",
      this.props.className,
    );
    return (
      <Popup
        isOpen={isOpened}
        target={parent}
        position={position}
        onClose={onClickOutside}
      >
        <div className={contentClassName}>
          <ul>
            {items &&
              items.map((item: ContextMenuItemProps, index: number) => (
                <ContextMenuItem
                  key={index}
                  name={item.name}
                  icon={item.icon}
                  disabled={item.disabled}
                  onClick={item.onClick}
                />
              ))}
            {this.props.children}
          </ul>
        </div>
      </Popup>
    );
  }
}
