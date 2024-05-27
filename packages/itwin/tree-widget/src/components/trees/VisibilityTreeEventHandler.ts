/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import { EMPTY, endWith, from, ignoreElements, map, mergeMap, Observable, of } from "rxjs";
import { CheckBoxState } from "@itwin/core-react";
import { UnifiedSelectionTreeEventHandler } from "@itwin/presentation-components";
import { isPromiseLike } from "../utils/IsPromiseLike";
import { toVoidPromise } from "./common/Rxjs";

import type { BeEvent, IDisposable } from "@itwin/core-bentley";
import type {
  CheckBoxInfo,
  CheckboxStateChange,
  TreeCheckboxStateChangeEventArgs,
  TreeModelNode,
  TreeNodeItem,
  TreeSelectionChange,
  TreeSelectionModificationEventArgs,
  TreeSelectionReplacementEventArgs,
} from "@itwin/components-react";
import type { UnifiedSelectionTreeEventHandlerParams } from "@itwin/presentation-components";
/**
 * Data structure that describes instance visibility status.
 * @public
 */
export interface VisibilityStatus {
  state: "visible" | "partial" | "hidden";
  isDisabled?: boolean;
  tooltip?: string;
}

/**
 * Type definition of visibility change event listener.
 * @public
 */
export type VisibilityChangeListener = (nodeIds?: string[], visibilityStatus?: Map<string, VisibilityStatus>) => void;

/**
 * Visibility handler used to change or get visibility of instances represented by the tree node.
 * @public
 */
export interface IVisibilityHandler extends IDisposable {
  getVisibilityStatus(node: TreeNodeItem): VisibilityStatus | Promise<VisibilityStatus>;
  changeVisibility(node: TreeNodeItem, shouldDisplay: boolean): Promise<void>;
  onVisibilityChange: BeEvent<VisibilityChangeListener>;
}

/**
 * Type definition of predicate used to decide if node can be selected.
 * @public
 */
export type VisibilityTreeSelectionPredicate = (node: TreeNodeItem) => boolean;

/**
 * Parameters for [[VisibilityTreeEventHandler]]
 * @public
 */
export interface VisibilityTreeEventHandlerParams extends UnifiedSelectionTreeEventHandlerParams {
  visibilityHandler: IVisibilityHandler;
  selectionPredicate?: VisibilityTreeSelectionPredicate;
}

/**
 * Base event handler for visibility tree.
 * @public
 */
export class VisibilityTreeEventHandler extends UnifiedSelectionTreeEventHandler {
  private _visibilityHandler: IVisibilityHandler;
  private _selectionPredicate?: VisibilityTreeSelectionPredicate;
  private _listeners = new Array<() => void>();
  private _isChangingVisibility: boolean;

  constructor(params: VisibilityTreeEventHandlerParams) {
    super(params);
    this._visibilityHandler = params.visibilityHandler;
    this._selectionPredicate = params.selectionPredicate;
    this._isChangingVisibility = false;
    this._listeners.push(
      this._visibilityHandler.onVisibilityChange.addListener(async (nodeIds, visibilityStatus) => {
        if (this._isChangingVisibility) {
          return;
        }
        void this.updateCheckboxes(nodeIds, visibilityStatus);
      }),
    );
    this._listeners.push(
      this.modelSource.onModelChanged.addListener(async ([_, changes]) => {
        void this.updateCheckboxes([...changes.addedNodeIds, ...changes.modifiedNodeIds]);
      }),
    );
    this.updateCheckboxes(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  public override dispose() {
    super.dispose();
    this._listeners.forEach((disposeFunc) => disposeFunc());
  }

  private filterSelectionItems(items: TreeNodeItem[]) {
    // istanbul ignore if
    if (!this._selectionPredicate) {
      return items;
    }

    return items.filter((item) => this._selectionPredicate!(item));
  }

  public override onSelectionModified({ modifications }: TreeSelectionModificationEventArgs) {
    const filteredModification = new Observable<TreeSelectionChange>((subscriber) => modifications.subscribe(subscriber)).pipe(
      map(({ selectedNodeItems, deselectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
          deselectedNodeItems: this.filterSelectionItems(deselectedNodeItems),
        };
      }),
    );
    return super.onSelectionModified({ modifications: filteredModification });
  }

  public override onSelectionReplaced({ replacements }: TreeSelectionReplacementEventArgs) {
    const filteredReplacements = new Observable<{ selectedNodeItems: TreeNodeItem[] }>((subscriber) => replacements.subscribe(subscriber)).pipe(
      map(({ selectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
        };
      }),
    );
    return super.onSelectionReplaced({ replacements: filteredReplacements });
  }

  public override onCheckboxStateChanged(event: TreeCheckboxStateChangeEventArgs) {
    const handleStateChanged = () => {
      this._isChangingVisibility = false;
      void this.updateCheckboxes();
    };

    new Observable<CheckboxStateChange[]>((subscriber) => event.stateChanges.subscribe(subscriber))
      .pipe(mergeMap((changes) => this.changeVisibility(changes)))
      .subscribe({
        next: (nodeId) => {
          void this.updateCheckboxes([nodeId]);
        },
        complete: handleStateChanged,
        error: handleStateChanged,
      });
    return undefined;
  }

  private changeVisibility(changes: CheckboxStateChange[]) {
    return from(changes).pipe(
      mergeMap(({ nodeItem, newState }) => {
        this._isChangingVisibility = true;
        return from(this._visibilityHandler.changeVisibility(nodeItem, newState === CheckBoxState.On)).pipe(ignoreElements(), endWith(nodeItem.id));
      }),
    );
  }

  private async updateCheckboxes(affectedNodes?: string[], visibilityStatus?: Map<string, VisibilityStatus>) {
    const changes = affectedNodes ? this.getAffectedNodesCheckboxInfos(affectedNodes, visibilityStatus) : this.getAllNodesCheckboxInfos(visibilityStatus);
    const obs = changes.pipe(
      map(([nodeId, checkboxInfo]) => {
        this.modelSource.modifyModel((model) => {
          const node = model.getNode(nodeId);
          // istanbul ignore if
          if (!node) {
            return;
          }

          node.checkbox.isDisabled = checkboxInfo.isDisabled;
          node.checkbox.isVisible = checkboxInfo.isVisible;
          node.checkbox.state = checkboxInfo.state;
          node.checkbox.tooltip = checkboxInfo.tooltip;
        });
      }),
    );
    return toVoidPromise(obs);
  }

  private getAffectedNodesCheckboxInfos(affectedNodes: string[], visibilityStatus?: Map<string, VisibilityStatus>) {
    return from(affectedNodes).pipe(
      mergeMap((nodeId) => {
        const node = this.modelSource.getModel().getNode(nodeId);
        if (!node) {
          return EMPTY;
        }
        return this.getNodeCheckBoxInfoObs(node, visibilityStatus).pipe(map((info) => [nodeId, info] as const));
      }),
    );
  }

  private getAllNodesCheckboxInfos(visibilityStatus?: Map<string, VisibilityStatus>) {
    return from(this.modelSource.getModel().iterateTreeModelNodes()).pipe(
      // Doing this without throttling can crash the browser when using hierarchy-based display states.
      mergeMap((node) => {
        return this.getNodeCheckBoxInfoObs(node, visibilityStatus).pipe(map((info) => [node.id, info] as const));
      }, 4),
    );
  }

  private getNodeCheckBoxInfoObs(node: TreeModelNode, visibilityStatus?: Map<string, VisibilityStatus>): Observable<CheckBoxInfo> {
    const result = visibilityStatus?.get(node.id) ?? this._visibilityHandler.getVisibilityStatus(node.item);

    if (isPromiseLike(result)) {
      return from(result).pipe(map((status) => this.createCheckboxInfo(status)));
    }
    return of(this.createCheckboxInfo(result));
  }

  private createCheckboxInfo(status: VisibilityStatus): CheckBoxInfo {
    return {
      state: visibilityStateToCheckboxState(status),
      isDisabled: status.isDisabled || false,
      isVisible: true,
      tooltip: status.tooltip,
    };
  }
}

const visibilityStateToCheckboxState = (status: VisibilityStatus) => {
  switch (status.state) {
    case "visible":
      return CheckBoxState.On;
    // istanbul ignore next
    case "partial":
      return CheckBoxState.Partial;
    case "hidden":
    default:
      return CheckBoxState.Off;
  }
};
