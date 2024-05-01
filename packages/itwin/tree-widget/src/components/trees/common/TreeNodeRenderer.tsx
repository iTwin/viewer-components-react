/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext } from "react";
import { PrimitivePropertyValueRenderer } from "@itwin/components-react";

import type { ReactNode } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IPropertyValueRenderer, PropertyValueRendererContext, TreeModelNode } from "@itwin/components-react";

/**
 * Context for rendering label value.
 * @public
 */
export interface LabelRendererContext {
  /** Style that should be applied to the rendered element. */
  style?: React.CSSProperties;
  /** Callback to highlight text. */
  textHighlighter?: (text: string) => React.ReactNode;
}

/**
 * Props for custom node renderer.
 * @public
 */
export interface TreeNodeLabelRendererProps {
  /** Tree node to rendered label for. */
  node: TreeModelNode;
  /** Context for rendering node's label value. */
  context?: LabelRendererContext;
}

/**
 * Props for customizing node rendering.
 * @public
 */
export interface TreeNodeRendererProps {
  /** Custom renderer for node's label. */
  nodeLabelRenderer?: (props: TreeNodeLabelRendererProps) => ReactNode;
}

/**
 * Props for [[DefaultLabelRenderer]] component.
 * @public
 */
export interface DefaultLabelRendererProps {
  /** Label that should be rendered. */
  label: PropertyRecord;
  /** Context for rendering label value. */
  context?: LabelRendererContext;
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
export interface TreeNodeRendererContextProviderProps extends TreeNodeRendererProps {
  node: TreeModelNode;
  children: ReactNode;
}

/** @internal */
export function TreeNodeRendererContextProvider({ nodeLabelRenderer, node, children }: TreeNodeRendererContextProviderProps) {
  return <treeNodeLabelRendererContext.Provider value={{ renderer: nodeLabelRenderer, node }}>{children}</treeNodeLabelRendererContext.Provider>;
}

/** @internal */
export const TREE_NODE_LABEL_RENDERER = "visibility-tree-node-label";

/** @internal */
export class TreeNodeLabelRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord, _context?: PropertyValueRendererContext | undefined): boolean {
    return record.property.renderer?.name === TREE_NODE_LABEL_RENDERER;
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext | undefined): ReactNode {
    const labelContext: LabelRendererContext = {
      style: context?.style,
      textHighlighter: context?.textHighlighter,
    };
    return <LabelRenderer record={record} context={labelContext} />;
  }
}

interface TreeNodeLabelRendererContext {
  renderer?: (props: TreeNodeLabelRendererProps) => ReactNode;
  node: TreeModelNode;
}

const treeNodeLabelRendererContext = createContext<TreeNodeLabelRendererContext | undefined>(undefined);

interface LabelRendererProps {
  record: PropertyRecord;
  context?: LabelRendererContext;
}

function LabelRenderer({ record, context }: LabelRendererProps) {
  const renderContext = useContext(treeNodeLabelRendererContext);

  if (!renderContext || !renderContext.renderer) {
    return <DefaultLabelRenderer label={record} context={context} />;
  }

  const { renderer, node } = renderContext;
  return <>{renderer({ node, context })}</>;
}
