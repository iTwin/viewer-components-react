/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, Modal, ModalButtonBar, Text } from "@itwin/itwinui-react";
import React from "react";

export interface SaveModalProps {
  onSave: () => void;
  onClose: () => void;
  showSaveModal: boolean;
}

export const SaveModal = ({ onSave, onClose, showSaveModal }: SaveModalProps) => {
  return (
    <>
      <Modal title="Confirm" modalRootId="grouping-mapping-widget" isOpen={showSaveModal} onClose={onClose}>
        <Text variant="leading" as="h3">
          Are you sure you want to save this property with a new name? You may need to update this name in Custom Calculation formulas.
        </Text>
        <ModalButtonBar>
          <Button styleType="high-visibility" onClick={onSave}>
            Save
          </Button>
          <Button onClick={onClose} styleType="default">
            Cancel
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};
