/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { TablePaginator, TablePaginatorRendererProps } from "@itwin/itwinui-react";
import React, { useMemo } from "react";



export const LocalizedTablePaginator = (props: TablePaginatorRendererProps) => {
  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginationLocalization = useMemo(() => ({
    pageSizeLabel: (size: number) => IModelApp.localization.getLocalizedString("ReportsWidget:Table.SizePerPage", { size: size }),
    rangeLabel: (
      startIndex: number,
      endIndex: number,
      totalRows: number,
      isLoading: boolean,
    ) =>
      isLoading
        ? IModelApp.localization.getLocalizedString("ReportsWidget:Table.StartIndexEndIndex", { startIndex, endIndex })
        : IModelApp.localization.getLocalizedString("ReportsWidget:Table.StartIndexEndIndexOf", { startIndex, endIndex, totalRows }),
    previousPage: IModelApp.localization.getLocalizedString("ReportsWidget:Table.PreviousPage"),
    nextPage: IModelApp.localization.getLocalizedString("ReportsWidget:Table.NextPage"),
    goToPageLabel: (page: number) => IModelApp.localization.getLocalizedString("ReportsWidget:Table.GoToPage", { page }),
    rowsPerPageLabel: IModelApp.localization.getLocalizedString("ReportsWidget:Table.RowsPerPage"),
  }), [])

  return < TablePaginator {...props} pageSizeList={pageSizeList} localization={paginationLocalization} />
}