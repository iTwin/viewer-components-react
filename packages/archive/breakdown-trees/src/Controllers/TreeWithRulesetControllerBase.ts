/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

export abstract class TreeWithRulesetControllerBase {
  /** Creates a data provider for the tree with ruleset. */
  public abstract createDataProvider(registeredRuleset: Ruleset, imodel: IModelConnection): IPresentationTreeDataProvider;
}
