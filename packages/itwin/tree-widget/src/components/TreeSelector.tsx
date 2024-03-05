/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeSelector.scss";
import type { SelectOption } from "@itwin/itwinui-react";
import { useMemo, useState } from "react";
import { MenuItem, Select } from "@itwin/itwinui-react";
import type { TreeRenderProps } from "./SelectableTree";

export interface TreeContentDefinition {
  id: string;
  label: string;
  render: (props: TreeRenderProps) => React.ReactNode;
}

export interface TreeSelectorProps {
  defaultSelectedContentId: string;
  trees: TreeContentDefinition[];
  selectAriaLabel?: string;
  disabled?: boolean;
  density?: "enlarged" | "default";
}

export function TreeSelector(props: TreeSelectorProps) {
  const [selectedContentId, setSelectedContentId] = useState(props.defaultSelectedContentId);
  const selectedContent = props.trees.find((c) => c.id === selectedContentId) ?? props.trees[0];
  const isEnlarged = props.density === "enlarged";

  const options = useMemo(() => {
    return props.trees.map((c) => ({ label: c.label, value: c.id })) as SelectOption<string>[];
  }, [props.trees]);

  return (
    <div className="presentation-components-tree-selector-content">
      <div className="presentation-components-tree-selector-content-header">
        {options.length > 0 && (
          <Select
            options={options}
            value={selectedContent.id}
            aria-label={props.selectAriaLabel}
            disabled={props.disabled}
            size={isEnlarged ? "large" : "small"}
            itemRenderer={(option, itemProps) => (
              <MenuItem
                size={isEnlarged ? "large" : "default"}
                isSelected={itemProps.isSelected}
                onClick={() => {
                  setSelectedContentId(option.value);
                  itemProps.close();
                }}
                role='option'
              >
                {option.label}
              </MenuItem>
            )}
          />
        )}
      </div>
      <div className="presentation-components-tree-selector-content-wrapper">{selectedContent?.render(props)}</div>
    </div>
  );
}
