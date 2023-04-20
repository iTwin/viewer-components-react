/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { TreeModelChanges, TreeModelNode, TreeModelSource } from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";
import type { VisibilityTreeEventHandlerParams } from "@itwin/tree-widget-react";
import { VisibilityTreeEventHandler } from "@itwin/tree-widget-react";

export interface SelectionTrackingUnifiedSelectionTreeEventHandlerParams extends VisibilityTreeEventHandlerParams {
  onNewSelectionSetCallback: (newSelection: TreeModelNode[]) => void;
}

export class SelectionTrackingUnifiedSelectionTreeEventHandler extends VisibilityTreeEventHandler {
  private _onNewSelectionSetCallback: (newSelection: TreeModelNode[]) => void;

  constructor(params: SelectionTrackingUnifiedSelectionTreeEventHandlerParams) {
    super(params);
    this._onNewSelectionSetCallback = params.onNewSelectionSetCallback;
  }
  private collectSelectedNodes(modelSource: TreeModelSource): TreeModelNode[] {
    const nodeIterator = modelSource.getModel().iterateTreeModelNodes();
    const selectedNodes: TreeModelNode[] = [];
    for (const treeNode of nodeIterator) {
      if (treeNode.isSelected)
        selectedNodes.push(treeNode);
    }
    return selectedNodes;
  }

  public selectNodes(modelChange?: TreeModelChanges) {
    super.selectNodes(modelChange);
    if (this._onNewSelectionSetCallback)
      this._onNewSelectionSetCallback(this.collectSelectedNodes(this.modelSource));
  }
}

/**
 * A custom hook which creates and disposes `UnifiedSelectionTreeEventHandler`
 * @beta
 */
export function useSelectionTrackingUnifiedSelectionTreeEventHandler(props: SelectionTrackingUnifiedSelectionTreeEventHandlerParams) {
  return useDisposable(React.useCallback(
    () => new SelectionTrackingUnifiedSelectionTreeEventHandler(props),
    Object.values(props), /* eslint-disable-line react-hooks/exhaustive-deps */ /* want to re-create the handler whenever any prop changes */
  ));
}
