/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { KeySet } from "@itwin/presentation-common";
import type {
  SelectionChangesListener,
} from "@itwin/presentation-frontend";
import {
  Presentation,
} from "@itwin/presentation-frontend";
import {
  DEFAULT_PROPERTY_GRID_RULESET,
  PresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import type { IModelConnection } from "@itwin/core-frontend";

/* This class demonstrates the key APIs needed to access formatted property information
   suitable to present to end users. */
export class GroupQueryBuilderApi {
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
