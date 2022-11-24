/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type {
  ISelectionProvider,
  SelectionChangeEventArgs,
} from "@itwin/presentation-frontend";
import { KeySet } from "@itwin/presentation-common";
import { GroupQueryBuilderApi } from "../../api/GroupQueryBuilderApi";
import { PropertyGridWrapper } from "./property-grid/PropertyGridWrapper";
import { PropertyGridWrapperContext as PropertyGridWrapperContext } from "./context/PropertyGridWrapperContext";
import { Button } from "@itwin/itwinui-react";
import "./GroupQueryBuilder.scss";
import type { QueryBuilder } from "./QueryBuilder";
import type { PropertyRecord } from "@itwin/appui-abstract";

export interface GroupQueryBuilderContainerProps {
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  isUpdating: boolean;
  resetView: () => (Promise<void>);
}

export const GroupQueryBuilderContainer = ({ isUpdating, resetView, setQuery }: GroupQueryBuilderContainerProps) => {
  const iModelConnection = useActiveIModelConnection();

  const [keysState, setKeysState] = React.useState<KeySet>(new KeySet());
  const [selected, SetSelected] = React.useState<boolean>(false);

  const [queryBuilder, setQueryBuilder] = React.useState<QueryBuilder | undefined>();
  const [currentPropertyList, setCurrentPropertyList] = React.useState<PropertyRecord[]>([]);

  useEffect(() => {
    const _onSelectionChanged = async (
      evt: SelectionChangeEventArgs,
      selectionProvider: ISelectionProvider
    ) => {
      SetSelected(true);
      setCurrentPropertyList([]);

      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      const keys = new KeySet(selection);
      setKeysState(keys);
    };

    if (iModelConnection) {
      GroupQueryBuilderApi.addSelectionListener(_onSelectionChanged);
    }
    return () => {
      GroupQueryBuilderApi.removeSelectionListener();
    };
  }, [iModelConnection]);

  const _onClickResetButton = () => {
    setQuery("");
    queryBuilder?.resetQuery();
    setCurrentPropertyList([]);
    resetView().catch((e) =>
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
          resetView,
          setQuery,
          isUpdating,
        }}>
        <PropertyGridWrapper keys={keysState} imodel={iModelConnection} />
      </PropertyGridWrapperContext.Provider>
      {selected && (
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
      )}
    </div>
  );
};
