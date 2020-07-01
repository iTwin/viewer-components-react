/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./TreeWidgetComponent.scss";
import { ThemedSelect } from "@bentley/ui-core";
import { useState, useEffect } from "react";

export interface TreeWidgetTree {
  id: string;
  label: string;
  component: JSX.Element;
}

interface TreeWidgetComponentProps {
  trees?: TreeWidgetTree[];
}

export function TreeWidgetComponent(props: TreeWidgetComponentProps) {
  const trees: { [key: string]: TreeWidgetTree } = {};

  const [renderedElement, setRenderedElement] = useState<JSX.Element>();

  const themedSelectOptions = [];

  if (props.trees && props.trees.length !== 0) {
    for (const entry of props.trees) {
      trees[entry?.id] = entry;
      themedSelectOptions.push({
        label: entry?.label,
        value: entry?.id,
      });
    }
  }

  if (renderedElement === undefined) {
    if (props.trees && props.trees.length !== 0) {
      setRenderedElement(props.trees[0].component);
    }
  }

  return (
    <div className="tree-widget-visibility-widget">
      <div className="components-selectable-content">
        <div className="components-selectable-content-header">
          <ThemedSelect
            isSearchable={false}
            options={themedSelectOptions}
            defaultValue={themedSelectOptions[0]}
            onChange={(newValue: any, actionMeta: any) => {
              if (actionMeta?.action === "select-option" && newValue) {
                if (trees[newValue.value]) {
                  setRenderedElement(trees[newValue.value].component);
                } else {
                  setRenderedElement(trees["imodel-tree"].component);
                }
              }
            }}
          />
        </div>

        <div className="components-selectable-content-wrapper">
          {renderedElement}
        </div>
      </div>
    </div>
  );
}
