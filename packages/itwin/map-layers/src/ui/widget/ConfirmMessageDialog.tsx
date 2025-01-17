/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import "./MapUrlDialog.scss";
import * as React from "react";
import { Button, Dialog } from "@itwin/itwinui-react";

interface ConfirmMessageDialogProps {
  /** Title to show in title bar of dialog */
  title?: string | React.JSX.Element;
  className?: string;
  message?: string | React.JSX.Element;
  onYesResult?: () => void;
  onNoResult?: () => void;
  onClose?: () => void;
  onEscape?: () => void;
  minWidth?: string | number;
  /** Minimum height that the dialog may be resized to. Displayed in px if value is a number; otherwise, displayed in specified CSS unit. Default: 100px */
  minHeight?: string | number;
  /** Maximum width that the dialog may be resized to. Displayed in px if value is a number; otherwise, displayed in specified CSS unit. */
  maxWidth?: string | number;
  /** Maximum height that the dialog may be resized to. Displayed in px if value is a number; otherwise, displayed in specified CSS unit. */
  maxHeight?: string | number;
}

export function ConfirmMessageDialog(props: ConfirmMessageDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleNo = () => {
    setIsOpen(false);
    if (props.onNoResult) {
      props.onNoResult();
    }
  };

  const handleYes = () => {
    setIsOpen(false);
    if (props.onYesResult) {
      props.onYesResult();
    }
  }
  return (
    <Dialog
      as="div"
      className={props.className}
      isOpen={isOpen}
      onClose={handleNo}
      closeOnEsc
      closeOnExternalClick
      preventDocumentScroll
      trapFocus
      setFocus
      isDismissible
      minHeight={props.minHeight}
      minWidth={props.minWidth}
      maxHeight={props.maxHeight}
      maxWidth={props.maxWidth}
    >
      <Dialog.Backdrop />
      <Dialog.TitleBar titleText={props.title} />
      <Dialog.Content>
        <div>{props.message}</div>
      </Dialog.Content>
      <Dialog.ButtonBar>
        <Button styleType='high-visibility' onClick={handleYes}>Yes</Button>
        <Button onClick={handleNo}>No</Button>
      </Dialog.ButtonBar>
    </Dialog>
  );
}
