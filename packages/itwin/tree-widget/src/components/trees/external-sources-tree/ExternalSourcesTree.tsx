/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@itwin/presentation-components";
import * as RULESET_EXTERNAL_SOURCES_IMPORT from "./ExternalSources.json";

import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Node, Ruleset } from "@itwin/presentation-common";

/**
 * Presentation rules used by ControlledCategoriesTree
 * @internal
 */
export const RULESET_EXTERNAL_SOURCES = RULESET_EXTERNAL_SOURCES_IMPORT as Ruleset;

const PAGING_SIZE = 20;

/**
 * Props for the [[ExternalSourcesTree]] component
 * @alpha
 */
export interface ExternalSourcesTreeProps {
  /** An IModel to pull data from */
  iModel: IModelConnection;
  /** Width of the component */
  width: number;
  /** Height of the component */
  height: number;
}

/**
 * Tree which displays a hierarchy of ExternalSources and their elements.
 * @alpha
 */
export function ExternalSourcesTree(props: ExternalSourcesTreeProps) {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: RULESET_EXTERNAL_SOURCES,
    pagingSize: PAGING_SIZE,
    customizeTreeNodeItem,
  });
  const eventsHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader });
  const treeModel = useTreeModel(nodeLoader.modelSource);
  return (
    <div className="tree-widget-visibility-tree-base">
      <ControlledTree
        nodeLoader={nodeLoader}
        model={treeModel}
        selectionMode={SelectionMode.Extended}
        eventsHandler={eventsHandler}
        width={props.width}
        height={props.height}
        iconsEnabled={true}
      />
    </div>
  );
}

function customizeTreeNodeItem(item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) {
  item.icon = node.extendedData?.imageId;
}
