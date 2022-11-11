/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  Leading,
  Modal,
  ModalButtonBar,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import "./DeleteModal.scss";
import { handleError, LoadingSpinner } from "./utils";

export interface ReportConfirmModalProps {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  refresh: () => Promise<void>;
}

export const ReportConfirmModal = ({
  show,
  setShow,
  onConfirm,
  refresh,
}: ReportConfirmModalProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const confirmCallback = async () => {
    try {
      setIsLoading(true);
      onConfirm();
      setShow(false);
      await refresh();
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal
        title='Confirm'
        modalRootId='ec3-widget-react'
        isOpen={show}
        isDismissible={!isLoading}
        onClose={() => {
          setShow(false);
        }}
      >
        <div className="ec3w-delete-modal-body-text">
          <Leading>
            Are you sure you want to change template report? All labels will be reset.
          </Leading>
        </div>
        <ModalButtonBar>
          {isLoading &&
            <div className="ec3w-loading-delete">
              <LoadingSpinner />
            </div>}
          <Button styleType='high-visibility' onClick={confirmCallback} disabled={isLoading}>
            Confirm
          </Button>
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

export default ReportConfirmModal;
