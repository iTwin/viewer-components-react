/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./TreeWidgetComponent.scss";
import * as React from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { SelectableContent, SelectableContentDefinition, SelectableContentProps } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import { TreeWidget } from "../TreeWidget";

export interface TreeDefinition {
  /** Id of the tree */
  id: string;
  /** Callback that is used to get tree label */
  getLabel: () => string;
  /** Callback that is used to render tree component */
  render: () => React.ReactNode;
  /**
   * Callback that is used to determine if tree should be shown for current active iModel connection.
   * If callback is `undefined` tree is shown for all iModel connections.
   */
  shouldShow?: (imodel: IModelConnection) => Promise<boolean>;
}

interface TreeWidgetComponentProps {
  trees: TreeDefinition[];
}

export function TreeWidgetComponent(props: TreeWidgetComponentProps) {
  const { trees: treeDefinitions } = props;
  const trees = useActiveTrees(treeDefinitions);

  return (
    <div className="tree-widget-visibility-widget">
      <SelectableContent {...getSelectableContentProps(trees)} />
    </div>
  );
}

function useActiveTrees(treeDefinitions: TreeDefinition[]) {
  const [trees, setTrees] = React.useState<SelectableContentDefinition[]>();
  const imodel = useActiveIModelConnection();

  React.useEffect(() => {
    if (!imodel)
      return;

    let disposed = false;
    (async () => {
      const visibleTrees = await getActiveTrees(treeDefinitions, imodel);
      if (!disposed) {
        setTrees(visibleTrees);
      }
    })();

    return () => { disposed = true; };
  }, [treeDefinitions, imodel]);

  return trees;
}

async function getActiveTrees(treeDefinitions: TreeDefinition[], imodel: IModelConnection): Promise<SelectableContentDefinition[]> {
  const activeTrees: SelectableContentDefinition[] = [];
  for (const treeDef of treeDefinitions) {
    if (treeDef.shouldShow !== undefined && !(await treeDef.shouldShow(imodel))) {
      continue;
    }

    activeTrees.push({
      id: treeDef.id,
      label: treeDef.getLabel(),
      render: treeDef.render,
    });
  }

  return activeTrees;
}

function getSelectableContentProps(trees?: SelectableContentDefinition[]): SelectableContentProps {
  if (trees === undefined) {
    return {
      defaultSelectedContentId: "loading",
      children: [{
        id: "loading",
        label: "",
        render: () => (
          <Delayed>
            <ProgressLinear indeterminate={true} />
          </Delayed>
        ),
      }],
    };
  }

  if (trees.length === 0) {
    return {
      defaultSelectedContentId: "no-tress",
      children: [{
        id: "no-trees",
        label: "",
        render: () => (
          <FillCentered>
            {TreeWidget.translate("noTrees")}
          </FillCentered>
        ),
      }],
    };
  }

  return {
    defaultSelectedContentId: trees[0].id,
    children: trees,
  };
}

function Delayed({ delay = 200, children }: React.PropsWithChildren<{ delay?: number }>) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => { setShow(true); }, delay);
    return () => { clearTimeout(id); };
  }, [delay]);

  if (!show) {
    return null;
  }

  return <>{children}</>;
}
