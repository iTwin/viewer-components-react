/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, MiddleTextTruncation, Modal, ModalButtonBar, ModalContent, Text } from "@itwin/itwinui-react";
import React, { useState } from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import "./DeleteModal.scss";
import { handleError, LoadingSpinner } from "./utils";

export interface DeleteModalProps {
  entityName?: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const DeleteModal = ({ entityName, onClose, onDelete, refresh }: DeleteModalProps) => {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const deleteCallback = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
      await refresh();
      onClose();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Confirm")}
      isOpen={!!entityName}
      isDismissible={!isDeleting}
      onClose={onClose}
    >
      <ModalContent>
        <div className="rcw-delete-modal-body-text">
          <Text variant="leading">{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:AreYouSureYouWantToDelete")}</Text>
          <strong>{<MiddleTextTruncation text={`${entityName}?`} />}</strong>
        </div>
      </ModalContent>
      <ModalButtonBar>
        {isDeleting && (
          <div className="rcw-loading-delete" data-testid="rcw-loading-delete">
            <LoadingSpinner />
          </div>
        )}
        <Button styleType="high-visibility" onClick={deleteCallback} disabled={isDeleting}>
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Delete")}
        </Button>
        <Button styleType="default" onClick={onClose} disabled={isDeleting}>
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Cancel")}
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};

export default DeleteModal;
