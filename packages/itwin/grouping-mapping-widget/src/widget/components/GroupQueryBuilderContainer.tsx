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
import { PropertyGridWrapperApp } from "./property-grid/PropertyGridWrapper";
import { GroupQueryBuilderContext } from "./GroupQueryBuilderContext";
import { Button } from "@itwin/itwinui-react";
import "./GroupQueryBuilder.scss";

export const GroupQueryBuilderContainer: React.FunctionComponent = () => {
  const iModelConnection = useActiveIModelConnection();
  const context = React.useContext(GroupQueryBuilderContext);

  const [keysState, setKeysState] = React.useState<KeySet>(new KeySet());
  const [selected, SetSelected] = React.useState<boolean>(false);

  useEffect(() => {
    const _onSelectionChanged = async (
      evt: SelectionChangeEventArgs,
      selectionProvider: ISelectionProvider
    ) => {
      SetSelected(true);
      context.setCurrentPropertyList([]);

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
  }, [iModelConnection, context]);

  const _onClickResetButton = async () => {
    context.setQuery("");
    context.queryBuilder.query = undefined;
    context.setCurrentPropertyList([]);
  };

  return (
    <div className="find-similar-container">
      <PropertyGridWrapperApp keys={keysState} imodel={iModelConnection} />
      {selected && (
        <div className="button-container">
          <Button
            styleType="default"
            size="small"
            className="reset-button"
            onClick={_onClickResetButton}
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  );
};
