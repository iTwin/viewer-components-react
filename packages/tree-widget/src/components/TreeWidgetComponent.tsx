/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./TreeWidgetComponent.scss";
import { useState } from "react";
import {
  SelectableContent,
  SelectableContentDefinition,
} from "@bentley/ui-components";

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
        children={trees}
        defaultSelectedContentId={trees[0].id}
      />
    </div>
  );
}
