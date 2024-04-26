/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/


import { TreeEventHandler } from "@itwin/components-react";

import type {
  AbstractTreeNodeLoaderWithProvider,
  TreeCheckboxStateChangeEventArgs,
  TreeNodeEventArgs,
  TreeSelectionModificationEventArgs,
  TreeSelectionReplacementEventArgs,
} from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
export interface ReportingTreeEventHandlerProps {
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  eventHandler: TreeEventHandler;
  reportUsage: (props: { reportInteraction: boolean }) => void;
}

export class ReportingTreeEventHandler extends TreeEventHandler {
  protected _eventHandler: TreeEventHandler;
  protected _reportUsage: (props: { reportInteraction: boolean }) => void;

  constructor(props: ReportingTreeEventHandlerProps) {
    super({ modelSource: props.nodeLoader.modelSource, nodeLoader: props.nodeLoader });
    this._eventHandler = props.eventHandler;
    this._reportUsage = props.reportUsage;
  }

  public dispose() {
    this._eventHandler.dispose();
    super.dispose();
  }

  public override onNodeExpanded(props: TreeNodeEventArgs) {
    this._reportUsage({ reportInteraction: true });
    this._eventHandler.onNodeExpanded(props);
  }

  public override onNodeCollapsed(props: TreeNodeEventArgs) {
    this._reportUsage({ reportInteraction: true });
    this._eventHandler.onNodeCollapsed(props);
  }

  public override onSelectionModified(props: TreeSelectionModificationEventArgs) {
    this._reportUsage({ reportInteraction: true });
    return this._eventHandler.onSelectionModified(props);
  }

  public override onSelectionReplaced(props: TreeSelectionReplacementEventArgs) {
    this._reportUsage({ reportInteraction: true });
    return this._eventHandler.onSelectionReplaced(props);
  }

  public override onCheckboxStateChanged(props: TreeCheckboxStateChangeEventArgs) {
    return this._eventHandler.onCheckboxStateChanged(props);
  }

  public override onDelayedNodeClick(props: TreeNodeEventArgs) {
    this._eventHandler.onDelayedNodeClick(props);
  }

  public override onNodeDoubleClick(props: TreeNodeEventArgs) {
    this._reportUsage({ reportInteraction: true });
    this._eventHandler.onNodeDoubleClick(props);
  }

  public override onNodeEditorActivated(props: TreeNodeEventArgs) {
    this._reportUsage({ reportInteraction: true });
    this._eventHandler.onNodeEditorActivated(props);
  }
}
