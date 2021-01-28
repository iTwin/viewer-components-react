/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { TreeModel, TreeModelNode } from "@bentley/ui-components";

export abstract class TreeNodeFunctionalityProvider {
  protected _treeDataProvider: IPresentationTreeDataProvider;
  protected _functionalitySourceName: string;

  constructor (functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider){
    this._treeDataProvider = treeDataProvider;
    this._functionalitySourceName = functionalitySourceName;
  }

  public abstract async performAction(node: TreeModelNode, treeModel: TreeModel): Promise<void>;
}
