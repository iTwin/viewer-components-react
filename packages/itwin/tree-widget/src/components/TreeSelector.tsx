/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeSelector.scss";
import type { SelectOption } from "@itwin/itwinui-react";
import { useMemo, useState } from "react";
import { Select } from "@itwin/itwinui-react";

export interface TreeContentDefinition {
  id: string;
  label: string;
  render: (density?: "enlarged" | "default") => React.ReactNode;
}

export interface TreeSelectorProps {
  defaultSelectedContentId: string;
  children: TreeContentDefinition[];
  selectAriaLabel?: string;
  disabled?: boolean;
  density?: "enlarged" | "default";
}

export function TreeSelector(props: TreeSelectorProps) {
  const [selectedContentId, setSelectedContentId] = useState(props.defaultSelectedContentId);
  const selectedContent = props.children.find((c) => c.id === selectedContentId) ?? props.children[0];
  const className = props.density === "enlarged" ? "presentation-components-tree-selector-menu-enlarged" : "presentation-components-tree-selector-menu";

  const options = useMemo(() => {
    return props.children.map((c) => ({ label: c.label, value: c.id })) as SelectOption<string>[];
  }, [props.children]);

  return (
    <div className="presentation-components-tree-selector-content" title={className}>
      <div className="presentation-components-tree-selector-content-header">
        {options.length > 0 && (
          <Select
            options={options}
            value={selectedContent.id}
            onChange={setSelectedContentId}
            aria-label={props.selectAriaLabel}
            disabled={props.disabled}
            menuClassName={className}
            size={props.density === "enlarged" ? "large" : "small"}
          />
        )}
      </div>
      <div className="presentation-components-tree-selector-content-wrapper">{selectedContent?.render(props.density)}</div>
    </div>
  );
}
