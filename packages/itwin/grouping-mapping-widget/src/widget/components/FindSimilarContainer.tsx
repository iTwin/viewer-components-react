/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useEffect } from 'react';
import { useActiveIModelConnection } from '@bentley/ui-framework';
import {
  ISelectionProvider,
  SelectionChangeEventArgs,
} from '@bentley/presentation-frontend';
import { KeySet } from '@bentley/presentation-common';
import { FindSimilarApi } from '../../api/FindSimilarApi';
import { PropertyGridWrapperApp } from './property-grid/PropertyGridWrapper';
import { FindSimilarContext } from './FindSimilarContext';
import { Button } from '@itwin/itwinui-react';
import './FindSimilar.scss';

export const FindSimilarContainer: React.FunctionComponent = () => {
  const iModelConnection = useActiveIModelConnection();
  const context = React.useContext(FindSimilarContext);

  const [keysState, setKeysState] = React.useState<KeySet>(new KeySet());
  const [selected, SetSelected] = React.useState<boolean>(false);

  useEffect(() => {
    const _onSelectionChanged = async (
      evt: SelectionChangeEventArgs,
      selectionProvider: ISelectionProvider,
    ) => {
      SetSelected(true);
      context.setCurrentPropertyList([]);

      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      const keys = new KeySet(selection);
      setKeysState(keys);
    };

    if (iModelConnection) {
      FindSimilarApi.addSelectionListener(_onSelectionChanged);
    }
    return () => {
      FindSimilarApi.removeSelectionListener();
    };
  }, [iModelConnection, context]);

  const _onClickResetButton = async () => {
    context.setQuery('');
    context.queryBuilder.query = undefined;
    context.setCurrentPropertyList([]);
  };

  return (
    <div className='find-similar-container'>
      <PropertyGridWrapperApp keys={keysState} imodel={iModelConnection} />
      {selected && (
        <div className='button-container'>
          <Button
            styleType='default'
            size='small'
            className='reset-button'
            onClick={_onClickResetButton}
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  );
};
