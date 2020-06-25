import "./ModalDialog.scss";
import classnames from "classnames";
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Button } from "@bentley/ui-core";
import { AppContext } from "../reality-data-react";

/** Props for the SettingsModalWrapper component */
export interface ModalDialogProps {
  appContext: AppContext;
  isOpen: boolean;
  title: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}

/**
 * Default modal dialog wrapper component, renders content in a modal
 */
export class ModalDialog extends React.Component<ModalDialogProps> {
  private _topRef = React.createRef<HTMLDivElement>();
  private _outsideClickListener = (e: MouseEvent) => {
    if (
      e.target instanceof Element &&
      this._topRef.current &&
      this._topRef.current.contains(e.target)
    ) {
      this.props.onCancel && this.props.onCancel();
    }
  };
  public componentDidMount() {
    document.addEventListener("click", this._outsideClickListener);
  }
  public componentWillUnmount() {
    document.removeEventListener("click", this._outsideClickListener);
  }
  public render(): React.ReactPortal {
    const portalElemId = "reality-data-settings-portal";
    let portalElem = document.getElementById(portalElemId);
    if (!portalElem) {
      portalElem = document.createElement("div");
      portalElem.id = portalElemId;
      document.body.appendChild(portalElem);
    }
    return ReactDOM.createPortal(
      <div
        className={classnames(
          "reality-data-modal-overlay",
          this.props.isOpen && "open"
        )}
      >
        <div className="reality-data-modal">
          <p> {this.props.title} </p>
          {this.props.children}
          <div>
            <Button
              onClick={() => this.props.onCancel && this.props.onCancel()}
            >
              Cancel
            </Button>
            <Button
              onClick={() => this.props.onConfirm && this.props.onConfirm()}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>,
      portalElem
    );
  }
}

export default ModalDialog;
