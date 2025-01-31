/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeSelector.scss";
import { useState } from "react";
import { Select } from "@itwin/itwinui-react/bricks";

import type { SelectableTreeRenderProps } from "./SelectableTree.js";

/**
 * A definition for trees displayed in `TreeSelector`
 * @internal
 */
export interface TreeContentDefinition {
  id: string;
  label: string;
  render: (props: SelectableTreeRenderProps) => React.ReactNode;
  startIcon?: React.ReactNode;
}

/**
 * Props for `TreeSelector`
 * @internal
 */
export interface TreeSelectorProps {
  defaultSelectedContentId: string;
  trees: TreeContentDefinition[];
  onPerformanceMeasured?: (feature: string, elapsedTime: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that accepts a list of trees and renders a select box at the top,
 * allowing to choose which of the provided tree components should be rendered at the bottom.
 * @internal
 */
export function TreeSelector({ defaultSelectedContentId, trees, onFeatureUsed, onPerformanceMeasured }: TreeSelectorProps) {
  const [selectedContentId, setSelectedContentId] = useState(defaultSelectedContentId);
  const selectedContent = trees.find((c) => c.id === selectedContentId) ?? trees[0];

  return (
    <div className="presentation-components-tree-selector-content">
      <div className="presentation-components-tree-selector-content-header">
        {trees.length > 0 && (
          <Select.Root>
            <Select.HtmlSelect
              value={selectedContent.id}
              onChange={(e) => {
                const treeId = e.target.value;
                onFeatureUsed?.(`choose-${treeId}`);
                setSelectedContentId(treeId);
              }}
            >
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>
                  {tree.startIcon}
                  {tree.label}
                </option>
              ))}
            </Select.HtmlSelect>
          </Select.Root>
        )}
      </div>
      <div className="presentation-components-tree-selector-content-wrapper">{selectedContent?.render({ onPerformanceMeasured, onFeatureUsed })}</div>
    </div>
  );
}
