/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./WidgetHeader.css";

import { useState } from "react";
import { NativeSelect, Skeleton } from "@mui/material";
import { DebouncedSearchBox } from "./SearchBox.js";

import type { TreeRenderProps } from "../TreeWidgetComponentImpl.js";

// cspell:words xlarge

/**
 * A definition for trees displayed in `WidgetWithHeader`
 * @internal
 */
export interface TreeContentDefinition {
  id: string;
  label: string;
  isSearchable?: boolean;
  render: (props: TreeRenderProps) => React.ReactNode;
}

/**
 * Props for `WidgetWithHeader`
 * @internal
 */
export interface TreeSelectionProps {
  defaultSelectedContentId: string;
  trees: TreeContentDefinition[];
}

/**
 * Props for `WidgetWithHeader`
 * @internal
 */
export type WidgetHeaderProps = {
  onSearch: (value?: string) => void;
  onSelect: (value: string) => void;
  isLoading?: boolean;
} & TreeSelectionProps;

/**
 * A component that accepts a list of trees and renders a select box at the top,
 * allowing to choose which of the provided tree components should be rendered at the bottom.
 * @internal
 */
export function WidgetHeader({ defaultSelectedContentId, trees, onSelect, onSearch }: WidgetHeaderProps) {
  const [selectedContentId, setSelectedContentId] = useState(defaultSelectedContentId);
  const selectedContent = trees.find((c) => c.id === selectedContentId) ?? trees[0];
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  if (trees.length === 0 || selectedContent.id === "loading") {
    return <LoadingHeader />;
  }

  return (
    <div className="tw-content-header">
      {trees.length > 0 && !isSearchOpen && (
        <NativeSelect
          className={"tw-content-header-selector"}
          size="small"
          value={selectedContentId}
          onChange={(e) => {
            const treeId = e.target.value;
            onSelect(treeId);
            setSelectedContentId(treeId);
          }}
        >
          {trees.map((tree) => (
            <option key={tree.id} value={tree.id}>
              {tree.label}
            </option>
          ))}
        </NativeSelect>
      )}
      {selectedContent.isSearchable && (
        <DebouncedSearchBox className={"tw-content-header-search"} isOpened={isSearchOpen} setIsOpened={setIsSearchOpen} onSearch={onSearch} delay={300} />
      )}
    </div>
  );
}

function LoadingHeader() {
  return (
    <div className="tw-content-header">
      <Skeleton variant={"rounded"} width={"100%"} height={24} />
      <Skeleton variant={"rounded"} width={24} height={24} />
    </div>
  );
}
