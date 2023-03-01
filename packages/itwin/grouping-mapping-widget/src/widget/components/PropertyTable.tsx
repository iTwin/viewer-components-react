/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Table } from "@itwin/itwinui-react";
import React, { useState } from "react";
import type { Column } from "react-table";
import type { CreateTypeFromInterface } from "../utils";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import DeleteModal from "./DeleteModal";
import { PropertyTableToolbar } from "./PropertyTableToolbar";

export interface PropertyTableItem {
  propertyName: string;
  id: string;
}

export interface PropertyTableProps<T extends PropertyTableItem> {
  propertyType: string;
  columns: (handleShowDeleteModal: (value: T) => void) => ReadonlyArray<Column<T>>;
  data: T[];
  isLoading: boolean;
  onClickAdd?: () => void;
  refreshProperties: () => Promise<void>;
  deleteProperty: (iModelId: string, accessToken: string, propertyId: string) => Promise<void>;

}

export const PropertyTable = <T extends PropertyTableItem>({
  propertyType,
  columns,
  data,
  isLoading,
  onClickAdd,
  refreshProperties,
  deleteProperty,
}: PropertyTableProps<T>) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const [showDeleteModal, setShowDeleteModal] = useState<T | undefined>(undefined);

  const handleDeleteProperty = async () => {
    const accessToken = await getAccessToken();
    await deleteProperty(iModelId, accessToken, showDeleteModal?.id ?? "");
  };

  const handleShowDeleteModal = (property: T) => {
    setShowDeleteModal(property);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(undefined);
  };

  return (
    <>
      <div>
        <PropertyTableToolbar
          propertyType={propertyType}
          onClickAddProperty={onClickAdd}
          refreshProperties={refreshProperties}
          isLoading={isLoading}
        />
      </div>
      <Table<CreateTypeFromInterface<T>>
        data={isLoading ? [] : data}
        density='extra-condensed'
        columns={columns(handleShowDeleteModal)}
        emptyTableContent={`No ${propertyType} Properties`}
        isSortable
        isLoading={isLoading}
      />
      <DeleteModal
        entityName={showDeleteModal?.propertyName}
        onClose={handleCloseDeleteModal}
        onDelete={handleDeleteProperty}
        refresh={refreshProperties}
      />
    </>
  );
};
