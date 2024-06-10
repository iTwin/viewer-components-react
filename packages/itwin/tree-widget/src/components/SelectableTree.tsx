/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SelectableTree.scss";
import { useEffect, useState } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import { TreeWidget } from "../TreeWidget";
import { TreeSelector } from "./TreeSelector";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeContentDefinition, TreeSelectorProps } from "./TreeSelector";

/**
 * Props for rendering trees
 * @public
 */
export interface TreeRenderProps {
  density?: "enlarged" | "default";
  onPerformanceMeasured?: (featureId: string, elapsedTime: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * Definition of a tree component displayed in [[SelectableTree]]
 * @public
 */
export interface TreeDefinition {
  /** Id of the tree */
  id: string;
  /** Callback that is used to get tree label */
  getLabel: () => string;
  /** Callback that is used to render tree component */
  render: (props: TreeRenderProps) => React.ReactNode;
  /**
   * Callback that is used to determine if tree should be shown for current active iModel connection.
   * If callback is `undefined` tree is shown for all iModel connections.
   */
  shouldShow?: (imodel: IModelConnection) => Promise<boolean>;
  /** Icon to render before tree label in tree selector */
  startIcon?: React.ReactNode;
}

/**
 * Props for [[SelectableTree]]
 * @public
 */
export interface SelectableTreeProps {
  trees: TreeDefinition[];
  density?: "enlarged" | "default";
  onPerformanceMeasured?: (feature: string, elapsedTime: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders a tree (combo box) selector and the selected tree component.
 * @public
 */
export function SelectableTree(props: SelectableTreeProps) {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return <SelectableTreeContent {...props} imodel={imodel} />;
}

function SelectableTreeContent(props: SelectableTreeProps & { imodel: IModelConnection }) {
  const { trees: treeDefinitions, imodel } = props;
  const trees = useActiveTrees(treeDefinitions, imodel);

  return (
    <div className="tree-widget-selectable-tree">
      <TreeSelector
        {...getTreeSelectorProps(trees)}
        density={props.density}
        onPerformanceMeasured={props.onPerformanceMeasured}
        onFeatureUsed={props.onFeatureUsed}
      />
    </div>
  );
}

function useActiveTrees(treeDefinitions: TreeDefinition[], imodel: IModelConnection) {
  const [trees, setTrees] = useState<TreeContentDefinition[]>();

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const visibleTrees = await getActiveTrees(treeDefinitions, imodel);
      // istanbul ignore else
      if (!disposed) {
        setTrees(visibleTrees);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [treeDefinitions, imodel]);

  return trees;
}

async function getActiveTrees(treeDefinitions: TreeDefinition[], imodel: IModelConnection): Promise<TreeContentDefinition[]> {
  const handleDefinition = async (treeDef: TreeDefinition) => {
    if (treeDef.shouldShow !== undefined && !(await treeDef.shouldShow(imodel))) {
      return undefined;
    }
    return {
      id: treeDef.id,
      label: treeDef.getLabel(),
      render: treeDef.render,
      startIcon: treeDef.startIcon,
    };
  };

  return (await Promise.all(treeDefinitions.map(handleDefinition))).filter((tree) => tree !== undefined) as TreeContentDefinition[];
}

function getTreeSelectorProps(trees?: TreeContentDefinition[]): TreeSelectorProps {
  if (trees === undefined) {
    return {
      defaultSelectedContentId: "loading",
      trees: [
        {
          id: "loading",
          label: "",
          render: () => (
            <Delayed>
              <ProgressLinear indeterminate={true} />
            </Delayed>
          ),
        },
      ],
    };
  }

  if (trees.length === 0) {
    return {
      defaultSelectedContentId: "no-trees",
      trees: [
        {
          id: "no-trees",
          label: "",
          render: () => <FillCentered>{TreeWidget.translate("noTrees")}</FillCentered>,
        },
      ],
    };
  }

  return {
    defaultSelectedContentId: trees[0].id,
    trees,
  };
}

function Delayed({ delay = 200, children }: PropsWithChildren<{ delay?: number }>) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setShow(true);
    }, delay);
    return () => {
      clearTimeout(id);
    };
  }, [delay]);

  if (!show) {
    return null;
  }

  return <>{children}</>;
}
