/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./TreeWidgetComponent.scss";
import * as React from "react";
import { SelectableContent, SelectableContentDefinition } from "@itwin/components-react";

export interface TreeDefinition {
  id: string;
  getLabel: () => string;
  render: () => React.ReactNode;
}

interface TreeWidgetComponentProps {
  trees: TreeDefinition[];
}

export function TreeWidgetComponent(props: TreeWidgetComponentProps) {
  const trees: SelectableContentDefinition[] = props.trees.map((tree) => ({
    id: tree.id,
    label: tree.getLabel(),
    render: tree.render,
  }));

  return (
    <div className="tree-widget-visibility-widget">
      <SelectableContent
        children={trees} // eslint-disable-line react/no-children-prop
        defaultSelectedContentId={trees[0].id}
      />
    </div>
  );
}
