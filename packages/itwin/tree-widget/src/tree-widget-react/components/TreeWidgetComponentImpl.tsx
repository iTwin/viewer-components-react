/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWidgetComponentImpl.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Skeleton } from "@stratakit/bricks";
import { SelectableTree } from "./tree-header/SelectableTree.js";
import { WidgetHeader } from "./tree-header/WidgetHeader.js";
import { useTranslation } from "./trees/common/components/LocalizationContext.js";
import { SkeletonTree } from "./trees/common/components/SkeletonTree.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeContentDefinition, TreeSelectionProps } from "./tree-header/WidgetHeader.js";
import type { TranslateFunc } from "./trees/common/components/LocalizationContext.js";

/** @beta */
export interface StandardTreeLabels {
  models: string;
  categories: string;
  imodelContent: string;
  externalSources: string;
  classifications: string;
}

/**
 * Props for rendering trees
 * @public
 */
export interface TreeRenderProps {
  searchText?: string;
  treeLabel: string;
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
  getLabel: (props: { standardLabels: StandardTreeLabels }) => string;
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

function SelectableTreeContent({
  onPerformanceMeasured,
  onFeatureUsed,
  trees: treeDefinitions,
  imodel,
}: TreeWidgetComponentImplProps & { imodel: IModelConnection }) {
  const activeTrees = useActiveTrees(treeDefinitions, imodel);
  const translate = useTranslation();
  const { trees, defaultSelectedContentId } = useMemo(() => getWidgetWithHeaderProps(translate, activeTrees), [activeTrees, translate]);
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined);
  const [selectedContentId, setSelectedContentId] = useState<string | undefined>(defaultSelectedContentId);
  const selectedContent = useMemo(() => trees.find((c) => c.id === selectedContentId) ?? trees[0], [selectedContentId, trees]);

  const onSelect = useCallback(
    (treeId: string) => {
      onFeatureUsed?.(`choose-${treeId}`);
      setSelectedContentId(treeId);
    },
    [onFeatureUsed],
  );

  return (
    <div className="tree-widget-selectable-tree">
      <div className="tw-content">
        <WidgetHeader
          trees={trees}
          defaultSelectedContentId={defaultSelectedContentId}
          onSearch={setSearchValue}
          onSelect={onSelect}
          isLoading={selectedContent.id === "loading"}
        />
        <div className="tw-content-wrapper">
          {selectedContent?.render({ onPerformanceMeasured, onFeatureUsed, searchText: searchValue, treeLabel: selectedContent.label })}
        </div>
      </div>
    </div>
  );
}

function useActiveTrees(treeDefinitions: TreeDefinition[], imodel: IModelConnection) {
  const [trees, setTrees] = useState<TreeContentDefinition[]>();
  const translate = useTranslation();
  const standardTreeLabels = useMemo<StandardTreeLabels>(
    () => ({
      models: translate("modelsTree.label"),
      categories: translate("categoriesTree.label"),
      imodelContent: translate("imodelContentTree.label"),
      classifications: translate("classificationsTree.label"),
      externalSources: translate("externalSourcesTree.label"),
    }),
    [translate],
  );

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const visibleTrees = await getActiveTrees(treeDefinitions, imodel, standardTreeLabels);
      if (!disposed) {
        setTrees(visibleTrees);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [treeDefinitions, imodel, standardTreeLabels]);

  return trees;
}

async function getActiveTrees(
  treeDefinitions: TreeDefinition[],
  imodel: IModelConnection,
  standardTreeLabels: StandardTreeLabels,
): Promise<TreeContentDefinition[]> {
  const handleDefinition = async (treeDef: TreeDefinition) => {
    if (treeDef.shouldShow !== undefined && !(await treeDef.shouldShow(imodel))) {
      return undefined;
    }
    return {
      id: treeDef.id,
      isSearchable: treeDef.isSearchable,
      label: treeDef.getLabel({ standardLabels: standardTreeLabels }),
      render: treeDef.render,
      startIcon: treeDef.startIcon,
    };
  };

  return (await Promise.all(treeDefinitions.map(handleDefinition))).filter((tree) => tree !== undefined) as TreeContentDefinition[];
}

function getWidgetWithHeaderProps(translate: TranslateFunc, trees?: TreeContentDefinition[]): TreeSelectionProps {
  if (trees === undefined) {
    return {
      defaultSelectedContentId: "loading",
      trees: [
        {
          id: "loading",
          label: "",
          isSearchable: false,
          render: () => <LoadingTree />,
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
              {translate("selectableTree.noTrees")}
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

function LoadingTree() {
  return (
    <SelectableTree
      buttons={
        <>
          <Skeleton variant={"object"} size={"medium"} />
          <Skeleton variant={"object"} size={"medium"} />
          <Skeleton variant={"object"} size={"medium"} />
          <Skeleton variant={"object"} size={"medium"} />
          <Skeleton variant={"object"} size={"medium"} />
          <Skeleton variant={"object"} size={"medium"} />
        </>
      }
    >
      <SkeletonTree />
    </SelectableTree>
  );
}
