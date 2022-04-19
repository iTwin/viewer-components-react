/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { TablePaginator } from "@itwin/itwinui-react";
import React, { useMemo } from "react";

export const LocalizedTablePaginator = (props: TablePaginatorRendererProps) => {
  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginationLocalization = useMemo(() => ({
    pageSizeLabel: (size: number) => IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.SizePerPage", { size }),
    rangeLabel: (
      startIndex: number,
      endIndex: number,
      totalRows: number,
      isLoading: boolean,
    ) =>
      isLoading
        ? IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.StartIndexEndIndex", { startIndex, endIndex })
        : IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.StartIndexEndIndexOf", { startIndex, endIndex, totalRows }),
    previousPage: IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.PreviousPage"),
    nextPage: IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.NextPage"),
    goToPageLabel: (page: number) => IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.GoToPage", { page }),
    rowsPerPageLabel: IModelApp.localization.getLocalizedString("ReportsConfigWidget:Table.RowsPerPage"),
  }), []);

  return < TablePaginator {...props} pageSizeList={pageSizeList} localization={paginationLocalization} />;
};
