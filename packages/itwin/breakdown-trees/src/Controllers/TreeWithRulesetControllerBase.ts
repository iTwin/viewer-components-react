/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { IPresentationTreeDataProvider } from "@itwin/presentation-components";

export abstract class TreeWithRulesetControllerBase {
  /** Creates a data provider for the tree with ruleset. */
  public abstract createDataProvider(registeredRuleset: Ruleset, imodel: IModelConnection): IPresentationTreeDataProvider;
}
