/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { KeySet } from "@itwin/presentation-common";
import type { SelectionChangesListener } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import {
  DEFAULT_PROPERTY_GRID_RULESET,
  PresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import type { MLResponse } from "../widget/components/GroupAction";
import type { IModelConnection } from "@itwin/core-frontend";

export interface PropertyProps {
  keys: KeySet;
  imodel?: IModelConnection;
}

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
      this.selectionListener
    );
  }

  public static createPropertyDataProvider(
    keys: KeySet,
    imodel: IModelConnection
  ) {
    const dataProvider = new PresentationPropertyDataProvider({
      imodel,
      ruleset: DEFAULT_PROPERTY_GRID_RULESET,
    });
    dataProvider.keys = keys;
    dataProvider.isNestedPropertyCategoryGroupingEnabled = true;
    return dataProvider;
  }

  public static async similarSearch(
    conn: IModelConnection,
    elementIds: string[],
    maxIdsReturned: number = 100,
  ): Promise<MLResponse | undefined> {
    if (elementIds.length === 0) return undefined;

    return fetch(
      "https://imelemssearchapp.azurewebsites.net/api/similar_search?code=QPYFe5y41wh9D/lWOCybYzbchoHpbLxRLJQ8RdznKykSH7rqzcazmA==",
      {
        method: "POST",
        body: JSON.stringify({
          contextId: conn?.iTwinId,
          iModelId: conn?.iModelId,
          changeSetId: conn?.changeset?.id,
          dgnElementIds: elementIds,
          nIdsReturned: maxIdsReturned,
        }),
      }
    )
      .then((response) => {
        if (response.status >= 200 && response.status < 400) {
          return response.json();
        } else {
          return undefined;
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }
}
