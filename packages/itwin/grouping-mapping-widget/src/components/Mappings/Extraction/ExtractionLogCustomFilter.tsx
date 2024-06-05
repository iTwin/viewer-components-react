/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { TableFilterProps } from "@itwin/itwinui-react";
import { BaseFilter, FilterButtonBar, InputGroup, Radio } from "@itwin/itwinui-react";
import React, { useMemo, useState } from "react";

export function ExtractionLogCustomFilter({ column, clearFilter, setFilter }: TableFilterProps<Record<string, unknown>>): React.ReactElement {
  const [value, setValue] = useState<string | undefined>(column.filterValue as string | undefined);
  const translatedLabels = useMemo(
    () => ({
      filter: "Filter",
      clear: "Clear",
    }),
    [],
  );
  const filterOptionList = useMemo(() => {
    if (column.Header === "Category") {
      return ["GroupQuery", "NoMatchesForECProperties", "QueryTranslation", "QueryExecution"];
    }
    return ["Info", "Warning", "Error", "Trace"];
  }, [column]);
  return (
    <BaseFilter>
      <InputGroup displayStyle="default">
        {filterOptionList.map((option, id) => (
          <Radio name="filterOption" key={id} label={option} defaultChecked={option === value} onChange={() => setValue(option)} />
        ))}
      </InputGroup>
      <FilterButtonBar setFilter={() => setFilter(value)} clearFilter={clearFilter} translatedLabels={translatedLabels} />
    </BaseFilter>
  );
}
