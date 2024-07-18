/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IModelConnection, ViewChangeOptions } from "@itwin/core-frontend";
import { EmphasizeElements, IModelApp } from "@itwin/core-frontend";
import type { FeatureAppearance } from "@itwin/core-common";
import { ColorDef, FeatureOverrideType, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import type { InstanceKey } from "@itwin/presentation-common";
import { KeySet } from "@itwin/presentation-common";
import { HiliteSetProvider } from "@itwin/presentation-frontend";

export const isolateElementsByKeys = async (keySet: KeySet, replace = false) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    isolateElements(ids, replace);
    return ids;
  }
  return [];
};

export const isolateElementsByQuery = async (query: string, iModelConnection: IModelConnection, replace = false) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const keySet = await manufactureKeys(query, iModelConnection);
  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    isolateElements(ids, replace);
    return ids;
  }
  return [];
};

export const isolateElements = (hilitedIds: string[], replace = false) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);

  emph.isolateElements(hilitedIds, vp, replace);
};

export const clearIsolatedElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearIsolatedElements(vp);
};

export const hideElements = (hilitedIds: string[], replace = false) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);

  emph.hideElements(hilitedIds, vp, replace);
};

export const clearHiddenElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearHiddenElements(vp);
};

export const overrideElementsByQuery = async (
  iModelConnection: IModelConnection,
  query: string,
  color: string,
  overrideType = FeatureOverrideType.ColorOnly,
) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const keySet = await manufactureKeys(query, iModelConnection);
  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    overrideElements(ids, color, overrideType);
    return ids;
  }
  return [];
};

export const overrideElements = (hilitedIds: string[], color: string, overrideType = FeatureOverrideType.ColorOnly, replace = true) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);

  emph.overrideElements(hilitedIds, vp, ColorDef.fromString(color), overrideType, replace);
};

export const clearOverriddenElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearOverriddenElements(vp);
};

export const emphasizeElements = (hilitedIds: string[], defaultAppearance: FeatureAppearance | undefined = undefined, replace = false) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);

  emph.wantEmphasis = true;
  emph.emphasizeElements(hilitedIds, vp, defaultAppearance, replace);
};

export const emphasisElementsByQuery = async (
  iModelConnection: IModelConnection,
  query: string,
  defaultAppearance: FeatureAppearance | undefined = undefined,
  replace = false,
) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const keySet = await manufactureKeys(query, iModelConnection);
  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    emphasizeElements(ids, defaultAppearance, replace);
    return ids;
  }
  return [];
};

export const emphasizeElementsByKeys = async (keySet: KeySet, defaultAppearance: FeatureAppearance | undefined = undefined, replace = false) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    emphasizeElements(ids, defaultAppearance, replace);
    return ids;
  }
  return [];
};

export const visualizeElementsByQuery = async (query: string, color: string, iModelConnection: IModelConnection, replace = false, wantEmphasis = true) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const keySet = await manufactureKeys(query, iModelConnection);
  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    visualizeElements(ids, color, replace, wantEmphasis);
    return ids;
  }
  return [];
};

export const visualizeElementsByKeys = async (keySet: KeySet, color: string, replace = false, wantEmphasis = true) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    const ids = [...set.elements];
    visualizeElements(ids, color, replace, wantEmphasis);
    return ids;
  }
  return [];
};

export const visualizeElements = (elementIds: string[], color: string, replace = false, wantEmphasis = true) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);

  emph.overrideElements(elementIds, vp, ColorDef.fromString(color), FeatureOverrideType.ColorAndAlpha, true);
  if (!wantEmphasis) {
    return;
  }
  emph.wantEmphasis = true;
  emph.emphasizeElements(elementIds, vp, undefined, replace);
};

export const transparentOverriddenElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  const ids = emph.getOverriddenElements()?.values();
  if (ids) {
    const toOverride = new Set<string>();
    Array.from(ids).forEach((a) => a.forEach((id) => toOverride.add(id)));
    emph.overrideElements(toOverride, vp, ColorDef.red.withAlpha(50), FeatureOverrideType.AlphaOnly, true);
  }
};

export const zoomToElements = async (elementIds: string[]) => {
  if (!IModelApp.viewManager.selectedView || elementIds.length === 0) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const viewChangeOpts: ViewChangeOptions = {};
  viewChangeOpts.animateFrustumChange = true;
  // It was removed. Should be a prop to be passed to lookAtViewAlignedVolume within the implementation.
  // viewChangeOpts.marginPercent = new MarginPercent(0.1, 0.1, 0.1, 0.1);
  await vp.zoomToElements(elementIds, { ...viewChangeOpts });
};

export const getHiliteIds = async (query: string, iModelConnection: IModelConnection) => {
  if (!IModelApp.viewManager.selectedView) {
    return { keySet: new KeySet(), ids: [] };
  }

  const vp = IModelApp.viewManager.selectedView;

  const keySet = await manufactureKeys(query, iModelConnection);
  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    return { keySet, ids: [...set.elements] };
  }
  return { keySet: new KeySet(), ids: [] };
};

export const manufactureKeys = async (query: string, iModelConnection: IModelConnection): Promise<KeySet> => {
  if (query === "") {
    return new KeySet();
  }
  const queryWithIdAndECClassName = `SELECT q.ECInstanceId, ec_classname(e.ECClassId) FROM (${query}) q JOIN BisCore.Element e on e.ECInstanceId = q.ECInstanceId`;
  const keys: InstanceKey[] = [];

  for await (const row of iModelConnection.createQueryReader(queryWithIdAndECClassName)) {
    keys.push({ id: row[0], className: row[1] });
  }

  return new KeySet(keys);
};

/** Often a list of ECInstanceIds does not directly match the ids of the elements drawn in the 3D viewer.
 *   To be safe, in all cases before sending recoloring, or zoom commands to the viewer, one should fetch
 *   the HiliteSet - the resolved ECInstanceIds of the elements drawn in the viewer - and use that for
 *   coloring, zooming, etc.
 */
export const getHiliteIdsWithElementIds = async (elementIds: string[]) => {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp) {
    return [];
  }

  const keySet = await manufactureKeysWithElementIds(elementIds);
  const hiliteProvider: HiliteSetProvider = HiliteSetProvider.create({
    imodel: vp.iModel,
  });
  const set = await hiliteProvider.getHiliteSet(keySet);
  if (set.elements) {
    return [...set.elements];
  }
  return [];
};

/** A helper function for getting a HiliteSet. */
export const manufactureKeysWithElementIds = async (elementIds: string[]): Promise<KeySet> => {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp || elementIds.length === 0) {
    return new KeySet();
  }

  const batchSize = 1000;
  const batches: AsyncIterableIterator<any>[] = [];
  const iModelConnection = vp.iModel;

  for (let i = 0; i < elementIds.length; i += batchSize) {
    const batchIds = elementIds.slice(i, i + batchSize);
    const params = batchIds.map((_) => "?").join(",");
    const query = `SELECT ECInstanceId, ec_classname(ECClassId) from BisCore.Element WHERE ECInstanceId IN (${params})`;
    batches.push(
      iModelConnection.query(query, QueryBinder.from(batchIds), {
        rowFormat: QueryRowFormat.UseECSqlPropertyIndexes,
      }),
    );
  }

  const keys: InstanceKey[] = [];
  for (const batch of batches) {
    for await (const row of batch) {
      keys.push({ id: row[0], className: row[1] });
    }
  }

  return new KeySet(keys);
};

export const clearEmphasizedElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearEmphasizedElements(vp);
};

export const clearEmphasizedOverriddenElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearEmphasizedElements(vp);
  emph.clearOverriddenElements(vp);
};

export const clearAll = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearEmphasizedElements(vp);
  emph.clearOverriddenElements(vp);
  emph.clearHiddenElements(vp);
};
