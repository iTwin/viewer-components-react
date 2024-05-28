/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, Modal, ModalButtonBar, Text } from "@itwin/itwinui-react";
import React, { useState } from "react";
import "./ReportConfirmModal.scss";
import { handleError, LoadingSpinner } from "./utils";

export interface ReportConfirmModalProps {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  refresh: () => Promise<void>;
  onCancel: () => void;
}

export const ReportConfirmModal = ({ show, setShow, onConfirm, refresh, onCancel }: ReportConfirmModalProps) => {
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
    <Modal
      title="Confirm"
      data-testid="ec3-report-confirm-modal"
      modalRootId="ec3-widget-react"
      isOpen={show}
      isDismissible={!isLoading}
      onClose={() => {
        setShow(false);
        onCancel();
      }}
    >
      <div className="ec3w-delete-modal-body-text">
        <Text variant="leading">Are you sure you want to change template report? All labels will be reset.</Text>
      </div>
      <ModalButtonBar>
        {isLoading && (
          <div className="ec3w-loading-delete">
            <LoadingSpinner />
          </div>
        )}
        <Button styleType="high-visibility" onClick={confirmCallback} disabled={isLoading} data-testid="ec3-report-confirm-modal-button">
          Confirm
        </Button>
        <Button
          styleType="default"
          data-testid="ec3-report-confirm-modal-cancel-button"
          onClick={() => {
            setShow(false);
            onCancel();
          }}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};
