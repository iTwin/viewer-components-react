/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, Observable as RxjsObservable, tap } from "rxjs";
import { TreeEventHandler } from "@itwin/components-react";

import type {
  AbstractTreeNodeLoaderWithProvider,
  TreeCheckboxStateChangeEventArgs,
  TreeNodeEventArgs,
  TreeSelectionChange,
  TreeSelectionModificationEventArgs,
  TreeSelectionReplacementEventArgs,
} from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
export interface ReportingTreeEventHandlerProps {
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  eventHandler?: TreeEventHandler;
  reportUsage?: (props: { featureId?: string; reportInteraction: boolean }) => void;
}

export class ReportingTreeEventHandler extends TreeEventHandler {
  protected _eventHandler?: TreeEventHandler;
  protected _reportUsage?: (props: { featureId?: string; reportInteraction: boolean }) => void;

  constructor(props: ReportingTreeEventHandlerProps) {
    super({ modelSource: props.nodeLoader.modelSource, nodeLoader: props.nodeLoader });
    this._eventHandler = props.eventHandler;
    this._reportUsage = props.reportUsage;
  }

  public dispose() {
    this._eventHandler?.dispose();
    super.dispose();
  }

  public override onNodeExpanded(props: TreeNodeEventArgs) {
    this._reportUsage?.({ reportInteraction: true });
    this._eventHandler ? this._eventHandler.onNodeExpanded(props) : super.onNodeExpanded(props);
  }

  public override onNodeCollapsed(props: TreeNodeEventArgs) {
    this._reportUsage?.({ reportInteraction: true });
    this._eventHandler ? this._eventHandler.onNodeCollapsed(props) : super.onNodeCollapsed(props);
  }

  public override onSelectionModified(props: TreeSelectionModificationEventArgs) {
    let emittedValues = false;
    const rxjsObservable = new RxjsObservable<TreeSelectionChange>((subscriber) => props.modifications.subscribe(subscriber));
    const tracked = rxjsObservable.pipe(
      tap({
        next: () => (emittedValues = true),
        finalize: () => {
          if (emittedValues) {
            this._reportUsage?.({ reportInteraction: true });
          }
        },
      }),
      concatMap(() => rxjsObservable),
    );
    return this._eventHandler ? this._eventHandler.onSelectionModified({ modifications: tracked }) : super.onSelectionModified({ modifications: tracked });
  }

  public override onSelectionReplaced(props: TreeSelectionReplacementEventArgs) {
    this._reportUsage?.({ reportInteraction: true });
    return this._eventHandler ? this._eventHandler.onSelectionReplaced(props) : super.onSelectionReplaced(props);
  }

  public override onCheckboxStateChanged(props: TreeCheckboxStateChangeEventArgs) {
    this._reportUsage?.({ reportInteraction: true });
    return this._eventHandler ? this._eventHandler.onCheckboxStateChanged(props) : super.onCheckboxStateChanged(props);
  }

  public override onDelayedNodeClick(props: TreeNodeEventArgs) {
    this._eventHandler ? this._eventHandler.onDelayedNodeClick(props) : super.onDelayedNodeClick(props);
  }

  public override onNodeDoubleClick(props: TreeNodeEventArgs) {
    this._reportUsage?.({ reportInteraction: true });
    this._eventHandler ? this._eventHandler.onNodeDoubleClick(props) : super.onNodeDoubleClick(props);
  }

  public override onNodeEditorActivated(props: TreeNodeEventArgs) {
    this._reportUsage?.({ reportInteraction: true });
    this._eventHandler ? this._eventHandler.onNodeEditorActivated(props) : super.onNodeEditorActivated(props);
  }
}
