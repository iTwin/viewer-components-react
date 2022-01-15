/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { KeySet } from "@bentley/presentation-common";
import {
  Presentation,
  SelectionChangesListener,
} from "@bentley/presentation-frontend";
import {
  DEFAULT_PROPERTY_GRID_RULESET,
  PresentationPropertyDataProvider,
} from "@bentley/presentation-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";

export interface PropertyProps {
  keys: KeySet;
  imodel?: IModelConnection;
}

/* This class demonstrates the key APIs needed to access formatted property information
   suitable to present to end users. */
export class FindSimilarApi {
  private static selectionListener: SelectionChangesListener;

  public static addSelectionListener(listener: SelectionChangesListener) {
    this.selectionListener = listener;
    Presentation.selection.selectionChange.addListener(this.selectionListener);
  }

  public static removeSelectionListener() {
    Presentation.selection.selectionChange.removeListener(
      this.selectionListener,
    );
  }

  public static createPropertyDataProvider(
    keys: KeySet,
    imodel: IModelConnection,
  ) {
    const dataProvider = new PresentationPropertyDataProvider({
      imodel,
      ruleset: DEFAULT_PROPERTY_GRID_RULESET,
    });
    dataProvider.keys = keys;
    dataProvider.isNestedPropertyCategoryGroupingEnabled = true;
    return dataProvider;
  }
}
