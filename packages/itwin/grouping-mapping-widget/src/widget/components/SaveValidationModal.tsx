/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  Modal,
  ModalButtonBar,
  Table,
  Text,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import type { invalids } from "./PropertyValidationUtils";

export interface SaveValidationModalProps {
  onSave: (rows: string) => void;
  onClose: () => void;
  invalidCustomCalcs: invalids[];
  showSaveValidationModal: boolean;
  setInvalidCustomCalcs: (updatesCals: invalids[]) => void;
}

export const SaveValidationModal = ({
  onSave,
  onClose,
  showSaveValidationModal,
  invalidCustomCalcs,
}: SaveValidationModalProps) => {

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const selectedRows = useRef("");

  useEffect(() => {
    if (invalidCustomCalcs.length > 0) {
      setIsLoading(false);
    }
  }, [invalidCustomCalcs]);

  const onSelect = useCallback(async (rows) => {
    selectedRows.current = JSON.stringify(rows);
  }, []);

  const handleOnSave = useCallback(() => {
    onSave(selectedRows.current);
  }, [onSave]);

  const columns = useMemo(() => [{
    id: "customCalcName",
    Header: "Custom Calculation",
    accessor: "customCalcName" as keyof invalids,
  }, {
    id: "origFormula",
    Header: "Original Formula",
    accessor: "origFormula" as keyof invalids,
  }, {
    id: "changedFormula",
    Header: "Formula",
    accessor: "changedFormula" as keyof invalids,
  }], []);

  return (
    <Modal
      title='Confirm Update'
      modalRootId='grouping-mapping-widget'
      isOpen={showSaveValidationModal}
      onClose={onClose}
    >
      <Text variant="leading" as="h3">
          Update to this property will cause the following custom calculations to be invalid. Do you also want to make the suggested changes to their formula(s) ?
          Please select the custom calculation(s) that you want to update along with the change in the property.
      </Text>
      <Table<CreateTypeFromInterface<invalids>>
        columns={columns}
        data={isLoading ? []: invalidCustomCalcs}
        emptyTableContent='No data.'
        isSelectable={true}
        isLoading={isLoading}
        onSelect={onSelect}
        selectionMode='multi'
      />
      <ModalButtonBar>
        <Button styleType='high-visibility' onClick={handleOnSave}>
            Save
        </Button>
        <Button
          onClick={onClose}
          styleType='default'
        >
            Cancel
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};
