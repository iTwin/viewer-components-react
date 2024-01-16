/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module Popup */

import * as React from "react";
import classnames from "classnames";
import type { CommonProps } from "@itwin/core-react";
import { RelativePosition } from "@itwin/appui-abstract";
import "./Popup.scss";

/** Properties for the [[Popup]] component */
export interface PopupProps extends CommonProps {
  /**  show or hide the box shadow */
  showShadow: boolean;
  /** show or hide the arrow */
  showArrow: boolean;
  /** indicate if the popup is shown or not */
  isShown: boolean;
  /** Direction (relative to the target) to which the popup is expanded */
  position: RelativePosition;
  /** Fixed position in the viewport */
  fixedPosition?: { top: number, left: number };
  /** target element */
  context: HTMLElement | null;
  /** Function called when the popup is opened */
  onOpen?: () => void;
  /** Function called when the popup is closed */
  onClose?: () => void;
}

interface PopupState {
  isShown: boolean;
  position: RelativePosition;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Popup React component */
export class Popup extends React.Component<PopupProps, PopupState> {
  private _popupRef = React.createRef<HTMLDivElement>();
  private _targetElement?: HTMLElement; // target element owning the popup

  constructor(props: PopupProps, context?: any) {
    super(props, context);

    this.state = { isShown: this.props.isShown, position: this.props.position };
  }

  public static defaultProps: Partial<PopupProps> = {
    position: RelativePosition.Bottom,
    showShadow: true,
    showArrow: false,
  };

  public componentDidMount() {
    const popupElement = this._popupRef.current;
    if (popupElement && popupElement.parentElement) {
      this._targetElement = popupElement.parentElement;
    }
  }

  public componentDidUpdate(previousProps: PopupProps) {
    if (this.props.isShown === previousProps.isShown)
      return;

    if (this.props.isShown) {
      this._onShow();
    } else {
      this._onClose();
    }
  }

  public componentWillUnmount() {
    document.body.removeEventListener("click", this._onBodyClick, false);
    document.body.removeEventListener("keydown", this._onEsc, false);
  }

  private _onBodyClick = (event: MouseEvent): void => {

    const context = this._getContext();

    // Ignore clicks on the popover or button
    if (context === event.target) {
      return;
    }

    if (context && context.contains(event.target as Node)) {
      return;
    }

    if (this._popupRef.current && (this._popupRef.current === event.target || this._popupRef.current.contains(event.target as Node))) {
      return;
    }

    this._onClose();
  };

  private _onEsc = (event: KeyboardEvent): void => {
    // Esc key
    if (event.key === "Escape") {
      this._onClose();
    }
  };

  private _onShow() {
    if (this.state.isShown) {
      return;
    }

    document.addEventListener("click", this._onBodyClick, true);
    document.addEventListener("keydown", this._onEsc, true);

    const newPosition = this.getPositionWithinViewport();
    this.setState({ position: newPosition, isShown: true }, () => {
      if (this.props.onOpen)
        this.props.onOpen();
    });
  }

  private _onClose() {
    if (!this.state.isShown) {
      return;
    }

    document.removeEventListener("click", this._onBodyClick, true);
    document.removeEventListener("keydown", this._onEsc, true);

    // eslint-disable-next-line @itwin/react-set-state-usage
    this.setState({ isShown: false, position: this.props.position }, () => {
      if (this.props.onClose)
        this.props.onClose();
    });
  }

  private _getContext = () => this.props.context || this._targetElement;

  private getPositionClassName(position: RelativePosition): string {
    switch (position) {
      case RelativePosition.TopLeft:
        return classnames("search-popup-top-left");
      case RelativePosition.TopRight:
        return classnames("search-popup-top-right");
      case RelativePosition.BottomLeft:
        return classnames("search-popup-bottom-left");
      case RelativePosition.BottomRight:
        return classnames("search-popup-bottom-right");
      case RelativePosition.Top:
        return classnames("search-popup-top");
      case RelativePosition.Left:
        return classnames("search-popup-left");
      case RelativePosition.Right:
        return classnames("search-popup-right");
      default:
        return classnames("search-popup-bottom");
    }
  }

  private getPositionWithinViewport(): RelativePosition {
    const popupElement = this._popupRef.current;

    if (!popupElement || !this._targetElement)
      return this.props.position;
    // Note: Cannot use DOMRect yet since it's experimental and not available in all browsers (Nov. 2018)
    const viewportRect: Rect = { left: window.scrollX, top: window.scrollY, right: window.scrollX + window.innerWidth, bottom: window.scrollY + window.innerHeight };
    const targetRect = this._targetElement.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();
    const containerStyle = window.getComputedStyle(this._targetElement);
    const offset = (this.props.showArrow) ? 12 : 4;

    switch (this.props.position) {
      case RelativePosition.BottomRight: {
        const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
        if ((targetRect.bottom + popupRect.height + bottomMargin + offset) > viewportRect.bottom) {
          return RelativePosition.TopRight;
        }
        break;
      }

      case RelativePosition.TopRight: {
        const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
        if ((targetRect.top - popupRect.height - topMargin - offset) < viewportRect.top) {
          return RelativePosition.BottomRight;
        }
        break;
      }

      case RelativePosition.TopLeft: {
        const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
        if ((targetRect.top - popupRect.height - topMargin - offset) < viewportRect.top) {
          return RelativePosition.BottomLeft;
        }
        break;
      }

      case RelativePosition.BottomLeft: {
        const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
        if ((targetRect.bottom + popupRect.height + bottomMargin + offset) > viewportRect.bottom) {
          return RelativePosition.TopLeft;
        }
        break;
      }

      case RelativePosition.Bottom: {
        const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
        if ((targetRect.bottom + popupRect.height + bottomMargin + offset) > viewportRect.bottom) {
          return RelativePosition.Top;
        }
        break;
      }

      case RelativePosition.Top: {
        const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
        if ((targetRect.top - popupRect.height - topMargin - offset) < viewportRect.top) {
          return RelativePosition.Bottom;
        }
        break;
      }

      case RelativePosition.Left: {
        const leftMargin = containerStyle.marginLeft ? parseFloat(containerStyle.marginLeft) : 0;
        if ((targetRect.left - popupRect.width - leftMargin - offset) < viewportRect.left) {
          return RelativePosition.Right;
        }
        break;
      }

      case RelativePosition.Right: {
        const rightMargin = containerStyle.marginRight ? parseFloat(containerStyle.marginRight) : 0;
        if ((targetRect.right + popupRect.width + rightMargin + offset) > viewportRect.right) {
          return RelativePosition.Left;
        }
        break;
      }
    }

    return this.props.position;
  }

  public render(): JSX.Element {
    const className = classnames(
      "search-popup",
      this.getPositionClassName(this.state.position),
      this.props.showShadow && "search-popup-shadow",
      this.state.isShown && "visible",
      this.props.showArrow && "arrow",
      this.props.className,
    );

    let style: React.CSSProperties | undefined;
    if (this.props.fixedPosition) {
      style = {
        top: this.props.fixedPosition.top,
        left: this.props.fixedPosition.left,
        position: "fixed",
      };
    }

    return (
      <div style={style} className={className} ref={this._popupRef}>
        {this.props.children}
      </div>
    );
  }
}

export default Popup;
