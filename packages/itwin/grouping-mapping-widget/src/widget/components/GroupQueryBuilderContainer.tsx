/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import { KeySet } from "@itwin/presentation-common";
import { PropertyGridWrapper } from "./property-grid/PropertyGridWrapper";
import { PropertyGridWrapperContext } from "./context/PropertyGridWrapperContext";
import { Button } from "@itwin/itwinui-react";
import "./GroupQueryBuilder.scss";
import type { QueryBuilder } from "./QueryBuilder";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { GroupingCustomUIProps } from "./customUI/GroupingMappingCustomUI";
import React from "react";

export const GroupQueryBuilderContainer = ({ isUpdating, resetView, updateQuery }: GroupingCustomUIProps) => {
  const iModelConnection = useActiveIModelConnection();

  const [keysState, setKeysState] = useState<KeySet>(new KeySet());
  const [selected, setSelected] = useState<boolean>(false);

  const [queryBuilder, setQueryBuilder] = useState<QueryBuilder | undefined>();
  const [currentPropertyList, setCurrentPropertyList] = useState<PropertyRecord[]>([]);

  useEffect(() => {
    if (!iModelConnection) {
      throw new Error("This component requires an active iModelConnection.");
    }
  }, [iModelConnection]);

  useEffect(() => {
    const _onSelectionChanged = async (
      evt: SelectionChangeEventArgs,
      selectionProvider: ISelectionProvider
    ) => {
      setSelected(true);
      setCurrentPropertyList([]);

      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      const keys = new KeySet(selection);
      setKeysState(keys);
    };

    return iModelConnection
      ? Presentation.selection.selectionChange.addListener(_onSelectionChanged) :
      () => { };
  }, [iModelConnection]);

  const _onClickResetButton = async () => {
    updateQuery("");
    queryBuilder?.resetQuery();
    setCurrentPropertyList([]);
    if (resetView)
      await resetView().catch((e) =>
        /* eslint-disable no-console */
        console.error(e)
      );
  };

  return (
    <div className="gmw-find-similar-container">
      <PropertyGridWrapperContext.Provider
        value={{
          currentPropertyList,
          setCurrentPropertyList,
          queryBuilder,
          setQueryBuilder,
          resetView: resetView ?? (async () => { }),
          setQuery: updateQuery,
          isUpdating: isUpdating ?? false,
        }}>
        <PropertyGridWrapper keys={keysState} imodel={iModelConnection} />
      </PropertyGridWrapperContext.Provider>
      {
        selected && (
          <div className="gmw-button-container">
            <Button
              styleType="default"
              size="small"
              className="gmw-reset-button"
              onClick={_onClickResetButton}
            >
              Reset
            </Button>
          </div>
        )
      }
    </div >
  );
};
