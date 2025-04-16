/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWidgetComponentImpl.css";
import { useEffect, useState } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Spinner } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../TreeWidget.js";
import { WidgetHeader } from "./tree-header/WidgetHeader.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeContentDefinition, WidgetHeaderProps } from "./tree-header/WidgetHeader.js";
/**
 * Props for rendering trees
 * @public
 */
export interface TreeRenderProps {
  filter?: string;
  onPerformanceMeasured?: (featureId: string, elapsedTime: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

// TODO: fix interface so startIcon type is taken from this interface for `TreeSelector`
/**
 * Definition of a tree component displayed in `SelectableTree`.
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
  /**
   *  Flag to determine if search box should be rendered.
   *  - false or undefined, the search box will not be rendered.
   *  - true, the search box will be rendered.
   */
  isSearchable?: boolean;
  /** Icon to render before tree label in tree selector */
  startIcon?: React.ReactNode;
}

/**
 * Props for `TreeWidgetComponent`
 * @internal
 */
export interface TreeWidgetComponentImplProps {
  trees: TreeDefinition[];
  onPerformanceMeasured?: (feature: string, elapsedTime: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders a tree (combo box) selector and the selected tree component.
 * @internal
 */
export function TreeWidgetComponentImpl(props: TreeWidgetComponentImplProps) {
  const imodel = useActiveIModelConnection();
  if (!imodel) {
    return null;
  }
  return <SelectableTreeContent {...props} imodel={imodel} />;
}

function SelectableTreeContent(props: TreeWidgetComponentImplProps & { imodel: IModelConnection }) {
  const { trees: treeDefinitions, imodel } = props;
  const trees = useActiveTrees(treeDefinitions, imodel);

  // TODO: move tree content rendering here
  return (
    <div className="tree-widget-selectable-tree">
      <WidgetHeader {...getWidgetWithHeaderProps(trees)} onPerformanceMeasured={props.onPerformanceMeasured} onFeatureUsed={props.onFeatureUsed} />
    </div>
  );
}

function useActiveTrees(treeDefinitions: TreeDefinition[], imodel: IModelConnection) {
  const [trees, setTrees] = useState<TreeContentDefinition[]>();

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const visibleTrees = await getActiveTrees(treeDefinitions, imodel);
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
      isSearchable: treeDef.isSearchable,
      label: treeDef.getLabel(),
      render: treeDef.render,
      startIcon: treeDef.startIcon,
    };
  };

  return (await Promise.all(treeDefinitions.map(handleDefinition))).filter((tree) => tree !== undefined) as TreeContentDefinition[];
}

function getWidgetWithHeaderProps(trees?: TreeContentDefinition[]): WidgetHeaderProps {
  if (trees === undefined) {
    return {
      defaultSelectedContentId: "loading",
      trees: [
        {
          id: "loading",
          label: "",
          isSearchable: false,
          render: () => (
            <Delayed>
              {/* <ProgressLinear indeterminate={true} /> */}
              <Spinner />
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
          isSearchable: false,
          label: "",
          render: () => (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }} className="tree-widget-no-trees-container">
              {TreeWidget.translate("selectableTree.noTrees")}
            </div>
          ),
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
