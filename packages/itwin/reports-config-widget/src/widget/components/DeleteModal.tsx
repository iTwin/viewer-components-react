/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import {
  Button,
  Leading,
  MiddleTextTruncation,
  Modal,
  ModalButtonBar,
  ModalContent,
} from "@itwin/itwinui-react";
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
    <>
      <Modal
        title={IModelApp.localization.getLocalizedString("ReportsWidget:Confirm")}
        isOpen={show}
        isDismissible={!isLoading}
        onClose={() => {
          setShow(false);
        }}
      >
        <ModalContent>
          <div className="delete-modal-body-text">
            <Leading>
              {IModelApp.localization.getLocalizedString("ReportsWidget:AreYouSureYouWantToDelete")}
            </Leading>
            <strong>
              {<MiddleTextTruncation text={`${entityName}?`} />}
            </strong>
          </div>
        </ModalContent>
        <ModalButtonBar>
          {isLoading &&
            <div className="loading-delete">
              <LoadingSpinner />
            </div>}
          <Button styleType='high-visibility' onClick={deleteCallback} disabled={isLoading}>
            {IModelApp.localization.getLocalizedString("ReportsConfigWidget:Delete")}
          </Button>
          <Button
            styleType='default'
            onClick={() => {
              setShow(false);
            }}
            disabled={isLoading}
          >
            {IModelApp.localization.getLocalizedString("ReportsConfigWidget:Cancel")}
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};

export default DeleteModal;
