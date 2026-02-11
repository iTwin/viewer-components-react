/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, Modal, ModalButtonBar, Text } from "@itwin/itwinui-react";
import React from "react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

export interface SaveModalProps {
  onSave: () => void;
  onClose: () => void;
  showSaveModal: boolean;
}

export const SaveModal = ({ onSave, onClose, showSaveModal }: SaveModalProps) => {
  return (
    <>
      <Modal title={GroupingMappingWidget.translate("common.confirm")} modalRootId="grouping-mapping-widget" isOpen={showSaveModal} onClose={onClose}>
        <Text variant="leading" as="h3">
          {GroupingMappingWidget.translate("shared.saveConfirm")}
        </Text>
        <ModalButtonBar>
          <Button styleType="high-visibility" onClick={onSave}>
            {GroupingMappingWidget.translate("common.save")}
          </Button>
          <Button onClick={onClose} styleType="default">
            {GroupingMappingWidget.translate("common.cancel")}
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};
