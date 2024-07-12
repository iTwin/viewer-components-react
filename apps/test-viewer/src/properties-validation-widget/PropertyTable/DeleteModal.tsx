/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, MiddleTextTruncation, Modal, ModalButtonBar, Text } from "@itwin/itwinui-react";
import { useMutation } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import "./DeleteModal.scss";
import { LoadingSpinner } from "@itwin/core-react";

export interface DeleteModalProps {
  entityName: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export const DeleteModal = ({ entityName, onClose, onDelete }: DeleteModalProps) => {
  const [localEntityName] = useState(entityName);

  const deleteMutation = useMutation({
    mutationFn: onDelete,
    onSuccess: async () => {
      onClose();
    },
  });

  const deleteCallback = useCallback(() => {
    deleteMutation.mutate();
  }, [deleteMutation]);

  return (
    <>
      <Modal title="Confirm" modalRootId="grouping-mapping-widget" isOpen={!!localEntityName} isDismissible={!deleteMutation.isLoading} onClose={onClose}>
        <div className="gmw-delete-modal-body-text">
          <Text variant="leading" as="h3">
            Are you sure you want to delete
          </Text>
          <strong>{<MiddleTextTruncation text={`${entityName}?`} />}</strong>
        </div>
        <ModalButtonBar>
          {deleteMutation.isLoading && (
            <div className="gmw-loading-delete">
              <LoadingSpinner />
            </div>
          )}
          <Button styleType="high-visibility" onClick={deleteCallback} disabled={deleteMutation.isLoading}>
            Delete
          </Button>
          <Button styleType="default" onClick={onClose} disabled={deleteMutation.isLoading}>
            Cancel
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};

export default DeleteModal;
