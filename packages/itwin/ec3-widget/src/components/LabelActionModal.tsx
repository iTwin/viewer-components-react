/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Modal } from "@itwin/itwinui-react";
import React from "react";
import type { LabelActionProps } from "./LabelAction";
import { LabelAction } from "./LabelAction";
import "./LabelActionModal.scss";

export interface LabelActionModalProps extends LabelActionProps {
  show: boolean;
}

export const LabelActionModal = (props: LabelActionModalProps) => {
  return (
    <Modal title={props.label?.name ?? "Add Assembly"} className="ec3w-label-action-modal" isOpen={props.show} onClose={props.onClose}>
      <LabelAction {...props} />
    </Modal>
  );
};
