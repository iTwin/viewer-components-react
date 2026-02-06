/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, MiddleTextTruncation, Modal, ModalButtonBar, Text } from "@itwin/itwinui-react";
import { useMutation } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";
import "./DeleteModal.scss";
import { LoadingSpinner } from "./LoadingSpinner";

export interface DeleteModalProps {
  entityName: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
  confirmationMessage?: JSX.Element;
}

export const DeleteModal = ({ entityName, onClose, onDelete, confirmationMessage }: DeleteModalProps) => {
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
      <Modal title={GroupingMappingWidget.translate("common.confirm")} modalRootId="grouping-mapping-widget" isOpen={!!localEntityName} isDismissible={!deleteMutation.isLoading} onClose={onClose}>
        <div className="gmw-delete-modal-body-text">
          {confirmationMessage ?? (
            <>
              <Text variant="leading" as="h3">
                {GroupingMappingWidget.translate("shared.deleteConfirm")}
              </Text>
              <strong>{<MiddleTextTruncation text={`${entityName}?`} />}</strong>
            </>
          )}
        </div>
        <ModalButtonBar>
          {deleteMutation.isLoading && (
            <div className="gmw-loading-delete">
              <LoadingSpinner />
            </div>
          )}
          <Button styleType="high-visibility" onClick={deleteCallback} disabled={deleteMutation.isLoading}>
            {GroupingMappingWidget.translate("common.delete")}
          </Button>
          <Button styleType="default" onClick={onClose} disabled={deleteMutation.isLoading}>
            {GroupingMappingWidget.translate("common.cancel")}
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};

export default DeleteModal;
