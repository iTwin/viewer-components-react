/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { TreeModel, TreeModelNode } from "@itwin/components-react";

export abstract class TreeNodeFunctionalityProvider {
  protected _treeDataProvider: IPresentationTreeDataProvider;
  protected _functionalitySourceName: string;

  constructor(functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider) {
    this._treeDataProvider = treeDataProvider;
    this._functionalitySourceName = functionalitySourceName;
  }

  public abstract performAction(nodes: TreeModelNode[], treeModel: TreeModel): Promise<void>;
}
