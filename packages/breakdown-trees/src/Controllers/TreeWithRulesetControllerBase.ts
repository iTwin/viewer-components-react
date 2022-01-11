/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";

export abstract class TreeWithRulesetControllerBase {
    /** Creates a data provider for the tree with ruleset. */
  public abstract createDataProvider(registeredRuleset: Ruleset, imodel: IModelConnection): IPresentationTreeDataProvider;
}
