/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  IconButton,
  Leading,
  MiddleTextTruncation,
  Modal,
  ModalButtonBar,
  ProgressRadial,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import './DeleteModal.scss'

export interface DeleteModalProps {
  entityName: string;
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  onDelete: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const DeleteModal = ({
  entityName,
  show,
  setShow,
  onDelete,
  refresh,
}: DeleteModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const deleteCallback = async () => {
    try {
      setIsLoading(true);
      await onDelete();
      setShow(false);
      await refresh();
    } catch (err) {
      // toaster.negative(`${err.response?.data ?? 'Failed to revoke key.'}`, {
      //   hasCloseButton: true,
      // });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal
        title='Confirm'
        modalRootId='grouping-mapping-widget'
        isOpen={show}
        isDismissible={!isLoading}
        onClose={() => {
          setShow(false);
        }}
      >
        <div className="delete-modal-body-text">
          <Leading>
            Are you sure you want to delete
          </Leading>
          <strong>
            {<MiddleTextTruncation text={`${entityName}?`} />}
          </strong>
        </div>
        <ModalButtonBar>
          {isLoading ? (
            <IconButton styleType='high-visibility'>
              <ProgressRadial size="small" indeterminate />
            </IconButton>
          ) : (
            <Button styleType='high-visibility' onClick={deleteCallback}>
              Delete
            </Button>
          )}
          <Button
            styleType='default'
            onClick={() => {
              setShow(false);
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};

export default DeleteModal;
