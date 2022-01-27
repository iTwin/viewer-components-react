/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  EmphasizeElements,
  IModelApp,
  IModelConnection,
  ViewChangeOptions,
} from "@itwin/core-frontend";
import {
  ColorDef,
  ElementProps,
  FeatureOverrideType,
} from "@itwin/core-common";
import { KeySet } from "@itwin/presentation-common";
import { HiliteSetProvider } from "@itwin/presentation-frontend";

export const visualizeElementsById = async (
  elementIds: string[],
  color: string,
  iModelConnection: IModelConnection,
  replace = false,
  wantEmphasis = true,
) => {
  if (!IModelApp.viewManager.selectedView) {
    return [];
  }

  const vp = IModelApp.viewManager.selectedView;

  const keySet = await manufactureKeys(elementIds, iModelConnection);
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

export const visualizeElementsByKeys = async (
  keySet: KeySet,
  color: string,
  replace = false,
  wantEmphasis = true,
) => {
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

export const visualizeElements = (
  elementIds: string[],
  color: string,
  replace = false,
  wantEmphasis = true,
) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);

  emph.overrideElements(
    elementIds,
    vp,
    ColorDef.fromString(color),
    FeatureOverrideType.ColorOnly,
    true,
  );
  if (!wantEmphasis) {
    return;
  }
  emph.wantEmphasis = true;
  emph.emphasizeElements(elementIds, vp, undefined, replace);
};

export const zoomToElements = async (elementIds: string[]) => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }

  const vp = IModelApp.viewManager.selectedView;
  const viewChangeOpts: ViewChangeOptions = {};
  viewChangeOpts.animateFrustumChange = true;
  // It was removed. Should be a prop to be passed to lookAtViewAlignedVolume within the implementation.
  // viewChangeOpts.marginPercent = new MarginPercent(0.1, 0.1, 0.1, 0.1);
  await vp.zoomToElements(elementIds, { ...viewChangeOpts });
};

export const manufactureKeys = async (
  elementIds: string[],
  iModelConnection: IModelConnection,
): Promise<KeySet> => {
  // segment ids into batches
  const batches: string[][] = [];
  let currBatch: string[] = [];
  const batchSize = 100000;
  for (const id of elementIds) {
    if (currBatch.length < batchSize) {
      currBatch.push(id);
    } else {
      batches.push(currBatch);
      currBatch = [id];
    }
  }
  if (currBatch.length > 0 && currBatch.length <= batchSize) {
    batches.push(currBatch);
  }

  // retrieve element properties in batches
  let elemProps: ElementProps[] = [];
  for (const batch of batches) {
    const props = await iModelConnection.elements.getProps(batch);
    elemProps = elemProps.concat(props);
  }

  const isElementId = (elem: {
    id: string | undefined;
    className: string;
  }): elem is {
    id: string;
    className: string;
  } => {
    return elem.id !== undefined;
  };

  // create keyset from the element properties
  const keys = elemProps
    .map((elem: ElementProps) => ({
      id: elem.id,
      className: elem.classFullName,
    }))
    .filter(isElementId);
  return new KeySet(keys);
};

export const clearEmphasizedElements = () => {
  if (!IModelApp.viewManager.selectedView) {
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  const emph = EmphasizeElements.getOrCreate(vp);
  emph.clearEmphasizedElements(vp);
  emph.clearOverriddenElements(vp);
};
