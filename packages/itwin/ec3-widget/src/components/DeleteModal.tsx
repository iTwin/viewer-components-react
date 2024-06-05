/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, MiddleTextTruncation, Modal, ModalButtonBar, Text } from "@itwin/itwinui-react";
import React, { useState } from "react";
import "./DeleteModal.scss";
import { handleError, LoadingSpinner } from "./utils";

export interface DeleteModalProps {
  entityName: string;
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  onDelete: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const DeleteModal = ({ entityName, show, setShow, onDelete, refresh }: DeleteModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const deleteCallback = async () => {
    try {
      setIsLoading(true);
      await onDelete();
      setShow(false);
      await refresh();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title="Confirm"
      data-testid="ec3-delete-modal"
      modalRootId="ec3-widget-react"
      isOpen={show}
      isDismissible={!isLoading}
      onClose={() => {
        setShow(false);
      }}
    >
      <div className="ec3w-delete-modal-body-text">
        <Text variant="leading">Are you sure you want to delete</Text>
        <strong>
          <MiddleTextTruncation text={`${entityName}?`} />
        </strong>
      </div>
      <ModalButtonBar>
        {isLoading && (
          <div className="ec3w-loading-delete">
            <LoadingSpinner />
          </div>
        )}
        <Button styleType="high-visibility" onClick={deleteCallback} disabled={isLoading} data-testid="ec3-delete-modal-button">
          Delete
        </Button>
        <Button
          data-testid="ec3-delete-modal-cancel-button"
          styleType="default"
          onClick={() => {
            setShow(false);
          }}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};
