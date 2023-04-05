/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  Leading,
  MiddleTextTruncation,
  Modal,
  ModalButtonBar,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import "./DeleteModal.scss";
import { handleError, LoadingSpinner } from "./utils";

export interface DeleteModalProps {
  entityName?: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const DeleteModal = ({
  entityName,
  onClose,
  onDelete,
  refresh,
}: DeleteModalProps) => {
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
    <>
      <Modal
        title='Confirm'
        modalRootId='grouping-mapping-widget'
        isOpen={!!entityName}
        isDismissible={!isDeleting}
        onClose={onClose}
      >
        <div className="gmw-delete-modal-body-text">
          <Leading>
            Are you sure you want to delete
          </Leading>
          <strong>
            {<MiddleTextTruncation text={`${entityName}?`} />}
          </strong>
        </div>
        <ModalButtonBar>
          {isDeleting &&
            <div className="gmw-loading-delete">
              <LoadingSpinner />
            </div>}
          <Button styleType='high-visibility' onClick={deleteCallback} disabled={isDeleting}>
            Delete
          </Button>
          <Button
            styleType='default'
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};

export default DeleteModal;
