/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PropertyValueRendererManager } from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";
import { TREE_NODE_LABEL_RENDERER, TreeNodeLabelRenderer } from "./TreeNodeRenderer";

import type { DelayLoadedTreeNodeItem, IPropertyValueRenderer } from "@itwin/components-react";
import type { Node } from "@itwin/presentation-common";
import type { IDisposable } from "@itwin/core-bentley";

/** @internal */
export function combineTreeNodeItemCustomizations(customizations: Array<(item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) => void>) {
  return (item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) => {
    customizations.forEach((customize) => customize(item, node));
  };
}

/** @internal */
export function addCustomTreeNodeItemLabelRenderer(item: Partial<DelayLoadedTreeNodeItem>) {
  if (!item.label) {
    return;
  }

  item.label.property.renderer = { name: TREE_NODE_LABEL_RENDERER };
}

/** @internal */
export function addTreeNodeItemCheckbox(item: Partial<DelayLoadedTreeNodeItem>) {
  item.isCheckboxVisible = true;
  item.isCheckboxDisabled = true;
  item.checkBoxState = CheckBoxState.Off;
}

/** @internal */
export function registerRenderers() {
  const renderers: Array<{ name: string; renderer: IPropertyValueRenderer }> = [
    {
      name: TREE_NODE_LABEL_RENDERER,
      renderer: new TreeNodeLabelRenderer(),
    },
  ];

  for (const { name, renderer } of renderers) {
    PropertyValueRendererManager.defaultManager.registerRenderer(name, renderer);
  }

  return () => {
    for (const { name } of renderers) {
      PropertyValueRendererManager.defaultManager.unregisterRenderer(name);
    }
  };
}

export interface CacheLike extends IDisposable {
  /** Reset cache to default state (e.g. resubscribe to observables) */
  invalidate(): void;
}
