/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { TableFilterProps } from "@itwin/itwinui-react";
import { BaseFilter, FilterButtonBar, InputGroup, Radio } from "@itwin/itwinui-react";
import React, { useMemo, useState } from "react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

export function ExtractionLogCustomFilter({ column, clearFilter, setFilter }: TableFilterProps<Record<string, unknown>>): React.ReactElement {
  const [value, setValue] = useState<string | undefined>(column.filterValue as string | undefined);
  const translatedLabels = useMemo(
    () => ({
      filter: GroupingMappingWidget.translate("extraction.filter"),
      clear: GroupingMappingWidget.translate("common.clear"),
    }),
    [],
  );
  const filterOptionList = useMemo(() => {
    if (column.id === "category") {
      return [
        { value: "GroupQuery", label: "GroupQuery" },
        { value: "NoMatchesForECProperties", label: "NoMatchesForECProperties" },
        { value: "QueryTranslation", label: "QueryTranslation" },
        { value: "QueryExecution", label: "QueryExecution" },
      ];
    }
    return [
      { value: "Info", label: GroupingMappingWidget.translate("extraction.info") },
      { value: "Warning", label: GroupingMappingWidget.translate("extraction.warning") },
      { value: "Error", label: GroupingMappingWidget.translate("extraction.error") },
      { value: "Trace", label: GroupingMappingWidget.translate("extraction.trace") },
    ];
  }, [column]);
  return (
    <BaseFilter>
      <InputGroup displayStyle="default">
        {filterOptionList.map((option, id) => (
          <Radio name="filterOption" key={id} label={option.label} defaultChecked={option.value === value} onChange={() => setValue(option.value)} />
        ))}
      </InputGroup>
      <FilterButtonBar setFilter={() => setFilter(value)} clearFilter={clearFilter} translatedLabels={translatedLabels} />
    </BaseFilter>
  );
}
