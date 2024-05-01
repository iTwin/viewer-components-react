/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Table } from "@itwin/itwinui-react";
import React, { useCallback, useMemo, useState } from "react";
import type { Column } from "react-table";
import type { CreateTypeFromInterface } from "../../common/utils";
import DeleteModal from "../SharedComponents/DeleteModal";
import { PropertyTableToolbar } from "./PropertyTableToolbar";
import "./PropertyTable.scss";

export interface PropertyTableItem {
  propertyName: string;
  id: string;
}

export interface PropertyTableProps<T extends PropertyTableItem> {
  propertyType: string;
  columnsFactory: (handleShowDeleteModal: (value: T) => void) => Array<Column<T>>;
  data: T[];
  isLoading: boolean;
  onClickAdd?: () => void;
  refreshProperties: () => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
}

export const PropertyTable = <T extends PropertyTableItem>({
  propertyType,
  columnsFactory,
  data,
  isLoading,
  onClickAdd,
  refreshProperties,
  deleteProperty,
}: PropertyTableProps<T>) => {

  const [showDeleteModal, setShowDeleteModal] = useState<T | undefined>(undefined);

  const handleDeleteProperty = useCallback(async () => {
    await deleteProperty(showDeleteModal?.id ?? "");
  }, [deleteProperty, showDeleteModal?.id]);

  const handleShowDeleteModal = useCallback((property: T) => {
    setShowDeleteModal(property);
  }, []);

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(undefined);
  };

  const memoizedColumns = useMemo(() =>
    columnsFactory(handleShowDeleteModal), [columnsFactory, handleShowDeleteModal]);

  return (
    <div className="gmw-property-table-container">
      <PropertyTableToolbar
        propertyType={propertyType}
        onClickAddProperty={onClickAdd}
        refreshProperties={refreshProperties}
        isLoading={isLoading}
      />
      <Table<CreateTypeFromInterface<T>>
        data={isLoading ? [] : data}
        density='extra-condensed'
        columns={memoizedColumns}
        emptyTableContent={`No ${propertyType} Properties`}
        isSortable
        isLoading={isLoading}
      />
      {showDeleteModal &&
        <DeleteModal
          entityName={showDeleteModal.propertyName}
          onClose={handleCloseDeleteModal}
          onDelete={handleDeleteProperty}
        />}
    </div>
  );
};
