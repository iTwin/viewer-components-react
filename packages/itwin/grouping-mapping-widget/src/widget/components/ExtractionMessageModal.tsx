/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button, Modal, ModalButtonBar, ModalContent, Table } from "@itwin/itwinui-react";
import React, { useMemo } from "react";
import type { CreateTypeFromInterface } from "../utils";
import type { ExtractionMessageData } from "./Mapping";
import "./ExtractionMessageModal.scss";

export interface ExtractionMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionMessageData: ExtractionMessageData[];
}

export const ExtractionMessageModal = ({ isOpen, onClose, extractionMessageData }: ExtractionMessageModalProps) => {
  const columns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "date",
            Header: "Date",
            accessor: "date",
          },
          {
            id: "catagory",
            Header: "Catagory",
            accessor: "catagory",
          },
          {
            id: "level",
            Header: "Level",
            accessor: "level",
          },
          {
            id: "message",
            Header: "Message",
            accessor: "message",
            width: "25vw",
          },
        ],
      }], []
  );

  return (
    <>
      <Modal
        title="Extraction Logs"
        isOpen={isOpen}
        onClose={onClose}
        closeOnExternalClick={false}
      >
        <ModalContent>
          <Table<CreateTypeFromInterface<ExtractionMessageData>>
            columns={columns}
            data={extractionMessageData}
            emptyTableContent={""}
            className="gmw-extraction-message-table-container"
          />
        </ModalContent>
        <ModalButtonBar>
          <Button
            onClick={onClose}
            styleType="high-visibility"
          >
            Close
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};
