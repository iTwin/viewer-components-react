/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createContext, useContext } from "react";
import { PrimitivePropertyValueRenderer } from "@itwin/components-react";

import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type {
  IPropertyValueRenderer, PropertyValueRendererContext, TreeModelNode,
} from "@itwin/components-react";

/**
 * Props for custom node renderer.
 * @public
 */
export interface TreeNodeLabelRendererProps {
  node: TreeModelNode;
  context?: PropertyValueRendererContext;
}

/**
 * Props for customizing node rendering.
 * @public
 */
export interface TreeNodeRendererContext {
  nodeLabelRenderer?: (props: TreeNodeLabelRendererProps) => ReactNode;
}

/**
 * Props for [[DefaultLabelRenderer]] component.
 * @public
 */
export interface DefaultLabelRendererProps {
  label: PropertyRecord;
  context?: PropertyValueRendererContext;
}

/**
 * Renders label for tree node.
 * @public
 */
export function DefaultLabelRenderer({ label, context }: DefaultLabelRendererProps) {
  const renderer = new PrimitivePropertyValueRenderer();
  return renderer.render(label, context);
}

/** @internal */
export interface TreeNodeRendererContextProviderProps extends TreeNodeRendererContext {
  node: TreeModelNode;
  children: ReactNode;
}

/** @internal */
export function TreeNodeRendererContextProvider({ nodeLabelRenderer, node, children }: TreeNodeRendererContextProviderProps) {
  return (
    <treeNodeLabelRendererContext.Provider value={{ renderer: nodeLabelRenderer, node }}>
      {children}
    </treeNodeLabelRendererContext.Provider>
  );
}

/** @internal */
export const TREE_NODE_LABEL_RENDERER = "visibility-tree-node-label";

/** @internal */
export class TreeNodeLabelRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord, _context?: PropertyValueRendererContext | undefined): boolean {
    return record.property.renderer?.name === TREE_NODE_LABEL_RENDERER;
  }

  public render(record: PropertyRecord, _context?: PropertyValueRendererContext | undefined): ReactNode {
    return <LabelRenderer record={record} />;
  }
}

interface TreeNodeLabelRendererContext {
  renderer?: (props: TreeNodeLabelRendererProps) => ReactNode;
  node: TreeModelNode;
}

const treeNodeLabelRendererContext = createContext<TreeNodeLabelRendererContext | undefined>(undefined);

interface LabelRendererProps {
  record: PropertyRecord;
  context?: PropertyValueRendererContext;
}

function LabelRenderer({ record, context }: LabelRendererProps) {
  const renderContext = useContext(treeNodeLabelRendererContext);

  if (!renderContext || !renderContext.renderer) {
    return <DefaultLabelRenderer label={record} context={context} />;
  }

  const { renderer, node } = renderContext;
  return <>{renderer({ node, context })}</>;
}
