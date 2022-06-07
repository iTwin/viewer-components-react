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
  ModalContent,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import "./DeleteModal.scss";
import { handleError, LoadingSpinner } from "./utils";

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
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Confirm")}
      isOpen={show}
      isDismissible={!isLoading}
      onClose={() => {
        setShow(false);
      }}
    >
      <ModalContent>
        <div className="delete-modal-body-text">
          <Leading>
            {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:AreYouSureYouWantToDelete")}
          </Leading>
          <strong>
            {<MiddleTextTruncation text={`${entityName}?`} />}
          </strong>
        </div>
      </ModalContent>
      <ModalButtonBar>
        {isLoading &&
          <div className="rcw-loading-delete" data-testid="rcw-loading-delete">
            <LoadingSpinner />
          </div>}
        <Button styleType='high-visibility' onClick={deleteCallback} disabled={isLoading}>
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Delete")}
        </Button>
        <Button
          styleType='default'
          onClick={() => {
            setShow(false);
          }}
          disabled={isLoading}
        >
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Cancel")}
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};

export default DeleteModal;
