/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { CachingElementIdsContainer } from "../Utils";

import type { GroupingNodeKey, Keys } from "@itwin/presentation-common";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";

interface GroupedElementIds {
  modelId?: string;
  categoryId?: string;
  elementIds: CachingElementIdsContainer;
}

/** @internal */
// istanbul ignore next
export class ElementIdsCache {
  private _assemblyElementIdsCache = new Map<string, CachingElementIdsContainer>();
  private _groupedElementIdsCache = new Map<string, GroupedElementIds>();

  constructor(
    private _imodel: IModelConnection,
    private _rulesetId: string,
  ) {}

  public clear() {
    this._assemblyElementIdsCache.clear();
    this._groupedElementIdsCache.clear();
  }

  public getAssemblyElementIds(assemblyId: Id64String) {
    const ids = this._assemblyElementIdsCache.get(assemblyId);
    if (ids) {
      return ids;
    }

    const container = createAssemblyElementIdsContainer(this._imodel, this._rulesetId, assemblyId);
    this._assemblyElementIdsCache.set(assemblyId, container);
    return container;
  }

  public async getGroupedElementIds(groupingNodeKey: GroupingNodeKey): Promise<GroupedElementIds> {
    const keyString = JSON.stringify(groupingNodeKey);
    const ids = this._groupedElementIdsCache.get(keyString);
    if (ids) {
      return ids;
    }
    const info = await createGroupedElementsInfo(this._imodel, this._rulesetId, groupingNodeKey);
    this._groupedElementIdsCache.set(keyString, info);
    return info;
  }
}

// istanbul ignore next
async function* createInstanceIdsGenerator(imodel: IModelConnection, rulesetId: string, displayType: string, inputKeys: Keys) {
  const res = await Presentation.presentation.getContentInstanceKeys({
    imodel,
    rulesetOrId: rulesetId,
    displayType,
    keys: new KeySet(inputKeys),
  });
  for await (const key of res.items()) {
    yield key.id;
  }
}

// istanbul ignore next
function createAssemblyElementIdsContainer(imodel: IModelConnection, rulesetId: string, assemblyId: Id64String) {
  return new CachingElementIdsContainer(
    createInstanceIdsGenerator(imodel, rulesetId, "AssemblyElementsRequest", [{ className: "BisCore:Element", id: assemblyId }]),
  );
}

// istanbul ignore next
async function createGroupedElementsInfo(imodel: IModelConnection, rulesetId: string, groupingNodeKey: GroupingNodeKey) {
  const groupedElementIdsContainer = new CachingElementIdsContainer(
    createInstanceIdsGenerator(imodel, rulesetId, "AssemblyElementsRequest", [groupingNodeKey]),
  );
  const elementId = await groupedElementIdsContainer.getElementIds().next();
  if (elementId.done) {
    throw new Error("Invalid grouping node key");
  }

  let modelId, categoryId;
  const query = `SELECT Model.Id AS modelId, Category.Id AS categoryId FROM bis.GeometricElement3d WHERE ECInstanceId = ? LIMIT 1`;
  const reader = imodel.createQueryReader(query, QueryBinder.from([elementId.value]), { rowFormat: QueryRowFormat.UseJsPropertyNames });
  if (await reader.step()) {
    modelId = reader.current.modelId;
    categoryId = reader.current.categoryId;
  }
  return { modelId, categoryId, elementIds: groupedElementIdsContainer };
}
