/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./WidgetHeader.css";
import { useState } from "react";
import { Select } from "@itwin/itwinui-react/bricks";
import { DebouncedSearchBox } from "./SearchBox.js";

import type { TreeWidgetComponentRenderProps } from "../TreeWidgetComponent.js";

/**
 * A definition for trees displayed in `WidgetWithHeader`
 * @internal
 */
export interface TreeContentDefinition {
  id: string;
  label: string;
  render: (props: TreeWidgetComponentRenderProps) => React.ReactNode;
  startIcon?: React.ReactNode;
}

/**
 * Props for `WidgetWithHeader`
 * @internal
 */
export interface WidgetHeaderProps {
  defaultSelectedContentId: string;
  trees: TreeContentDefinition[];
  onPerformanceMeasured?: (feature: string, elapsedTime: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

// TODO: move tree content rendering outside
/**
 * A component that accepts a list of trees and renders a select box at the top,
 * allowing to choose which of the provided tree components should be rendered at the bottom.
 * @internal
 */
export function WidgetHeader({ defaultSelectedContentId, trees, onFeatureUsed, onPerformanceMeasured }: WidgetHeaderProps) {
  const [selectedContentId, setSelectedContentId] = useState(defaultSelectedContentId);
  const selectedContent = trees.find((c) => c.id === selectedContentId) ?? trees[0];
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined);

  return (
    <div className="tw-content">
      <div className="tw-content-header">
        {trees.length > 0 && !isSearchOpen && (
          <Select.Root className={"tw-content-header-selector"}>
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
        <DebouncedSearchBox className={"tw-content-header-search"} isOpened={isSearchOpen} setIsOpened={setIsSearchOpen} onSearch={setSearchValue} delay={20} />
      </div>
      <div className="tw-content-wrapper">{selectedContent?.render({ onPerformanceMeasured, onFeatureUsed, filter: searchValue })}</div>
    </div>
  );
}
