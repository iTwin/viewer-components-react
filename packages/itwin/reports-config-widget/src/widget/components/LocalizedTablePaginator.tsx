/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { TablePaginatorRendererProps } from "@itwin/itwinui-react";
import { TablePaginator } from "@itwin/itwinui-react";
import React, { useMemo } from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export const LocalizedTablePaginator = (props: TablePaginatorRendererProps) => {
  const pageSizeList = useMemo(() => [10, 25, 50], []);
  const paginationLocalization = useMemo(
    () => ({
      pageSizeLabel: (size: number) => ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.SizePerPage", { size }),
      rangeLabel: (startIndex: number, endIndex: number, totalRows: number, isLoading: boolean) =>
        isLoading
          ? ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.StartIndexEndIndex", { startIndex, endIndex })
          : ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.StartIndexEndIndexOf", { startIndex, endIndex, totalRows }),
      previousPage: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.PreviousPage"),
      nextPage: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.NextPage"),
      goToPageLabel: (page: number) => ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.GoToPage", { page }),
      rowsPerPageLabel: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Table.RowsPerPage"),
    }),
    [],
  );

  return <TablePaginator {...props} pageSizeList={pageSizeList} localization={paginationLocalization} />;
};
