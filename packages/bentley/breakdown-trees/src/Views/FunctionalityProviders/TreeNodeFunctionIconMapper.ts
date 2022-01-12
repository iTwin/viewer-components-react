/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { NodeKey } from "@bentley/presentation-common";
import { TreeModelNode } from "@bentley/ui-components";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
import { IModelReadRpcInterface } from "@bentley/imodeljs-common";


export interface FunctionIconInfo {
  key: string;
  label: string;
  toolbarIcon: string;
  disabled?: boolean;
  functionalityProvider: TreeNodeFunctionalityProvider;
}

export class TreeNodeFunctionIconInfoMapper {
  protected _treeDataProvider: IPresentationTreeDataProvider;
  private _functionIconInfos: FunctionIconInfo[];
  private _globalFunctionIconInfos: number[];
  private _groupNodeFunctionIconInfos: number[];
  private _multipleNodesFunctionIconInfos: number[];
  private _TreeNodeClassFunctionIconInfoMap: Map<string, number[]>;

  constructor(treeDataProvider: IPresentationTreeDataProvider) {
    this._treeDataProvider = treeDataProvider;
    this._globalFunctionIconInfos = [];
    this._groupNodeFunctionIconInfos = [];
    this._multipleNodesFunctionIconInfos = [];
    this._functionIconInfos = [];
    this._TreeNodeClassFunctionIconInfoMap = new Map<string, number[]>();
  }

  public getIconIndexByKey(key: string): number {
    return this._functionIconInfos.findIndex((value: FunctionIconInfo, _index, _array) => { return value.key === key; })
  }

  private insertOrGetIconIndex(functionIconInfo: FunctionIconInfo): number {
    const foundIndex = this._functionIconInfos.indexOf(functionIconInfo);
    if (foundIndex >= 0)
      return foundIndex;
    return this._functionIconInfos.push(functionIconInfo) - 1;
  }

  public registerForGroupNodes(functionIconInfo: FunctionIconInfo) {
    this._groupNodeFunctionIconInfos.push(this.insertOrGetIconIndex(functionIconInfo));
  }

  public registerGlobal(functionIconInfo: FunctionIconInfo) {
    this._globalFunctionIconInfos.push(this.insertOrGetIconIndex(functionIconInfo));
  }

  public registerForNodesOfClasses(classNames: string[], functionIconInfo: FunctionIconInfo) {
    const iconInfoIndex = this.insertOrGetIconIndex(functionIconInfo);
    for (let className of classNames) {
      let mappedArrayInstance = this._TreeNodeClassFunctionIconInfoMap.get(className);

      if (mappedArrayInstance === undefined) {
        mappedArrayInstance = [];
        this._TreeNodeClassFunctionIconInfoMap.set(className, mappedArrayInstance);
      }
      mappedArrayInstance.push(iconInfoIndex);
    }
  }

  public registerForMultipleNodes(functionIconInfo: FunctionIconInfo) {
    this._multipleNodesFunctionIconInfos.push(this.insertOrGetIconIndex(functionIconInfo));
  }

  public async getFunctionIconInfosFor(node?: TreeModelNode): Promise<FunctionIconInfo[]> {
    const returnedList: number[] = [];
    if (node) {
      const elementKey = this._treeDataProvider.getNodeKey(node.item);
      if (NodeKey.isGroupingNodeKey(elementKey)) {
        returnedList.push(...this._groupNodeFunctionIconInfos);
      }
      else if (NodeKey.isInstancesNodeKey(elementKey)) {
        const classHierarchyArray = await IModelReadRpcInterface.getClient().getClassHierarchy(this._treeDataProvider.imodel.getRpcProps(), elementKey.instanceKeys[0].className);
        for (let className of classHierarchyArray) {
          const mappedFunctionalityProviders = this._TreeNodeClassFunctionIconInfoMap.get(className);
          if (mappedFunctionalityProviders)
            returnedList.push(...mappedFunctionalityProviders);
        }
      }
    }
    returnedList.push(...this._globalFunctionIconInfos);
    return this._functionIconInfos.map((value: FunctionIconInfo, index: number, _array) => {
      const returnValue = { ...value };
      if (returnedList.indexOf(index) >= 0)
        returnValue.disabled = false;
      else
        returnValue.disabled = true;
      return returnValue;
    });
  }

  public getGlobalFunctionIconInfos(): ReadonlyArray<FunctionIconInfo> {
    return this._globalFunctionIconInfos.map<FunctionIconInfo>((value, _index, _array) => { return this._functionIconInfos[value] });
  }

  public getAllFunctionIconInfos(): ReadonlyArray<FunctionIconInfo> {
    return this._functionIconInfos;
  }
}
