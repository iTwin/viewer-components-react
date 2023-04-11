/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./TreeWidgetComponent.scss";
import { SelectableContent, SelectableContentDefinition } from "@itwin/components-react";

interface TreeWidgetComponentProps {
  trees?: SelectableContentDefinition[];
}

export function TreeWidgetComponent(props: TreeWidgetComponentProps) {
  const trees: SelectableContentDefinition[] = [];

  if (props.trees && props.trees.length !== 0) {
    for (const entry of props.trees) {
      trees.push(entry);
    }
  }

  return (
    <div className="tree-widget-visibility-widget">
      <SelectableContent
        children={trees} // eslint-disable-line react/no-children-prop
        defaultSelectedContentId={trees[0].id}
      />
    </div>
  );
}
