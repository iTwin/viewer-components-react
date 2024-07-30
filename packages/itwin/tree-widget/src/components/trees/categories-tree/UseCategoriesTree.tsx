/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { SvgLayers } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { useTelemetryContext } from "../common/UseTelemetryContext";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition";
import { CategoriesVisibilityHandler } from "./CategoriesVisibilityHandler";

import type { VisibilityTree } from "../common/components/VisibilityTree";
import type { ComponentPropsWithoutRef } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeRenderer } from "../common/components/VisibilityTreeRenderer";

type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";

/** @beta */
type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;

/** @beta */
type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;

/** @beta */
interface UseCategoriesTreeProps {
  filter: string;
  activeView: Viewport;
}

/** @beta */
interface UseCategoriesTreeResult {
  categoriesTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "noDataMessage"
  >;
  rendererProps: Pick<Required<VisibilityTreeRendererProps>, "getIcon" | "getSublabel">;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @beta
 */
export function useCategoriesTree({ filter, activeView }: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const [filteringError, setFilteringError] = useState<CategoriesTreeFilteringError | undefined>();
  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new CategoriesVisibilityHandler({
      viewport: activeView,
    });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView]);
  const { onFeatureUsed } = useTelemetryContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType: activeView.view.is2d() ? "2d" : "3d" });
    },
    [activeView],
  );

  const getFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        return await CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType: activeView.view.is2d() ? "2d" : "3d" });
      } catch (e) {
        const newError = e instanceof Error && e.message.match(/Filter matches more than \d+ items/) ? "tooManyFilterMatches" : "unknownFilterError";
        if (newError !== "tooManyFilterMatches") {
          const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
          onFeatureUsed({ featureId: feature, reportInteraction: false });
        }
        setFilteringError(newError);
        return [];
      }
    };
  }, [filter, activeView, onFeatureUsed]);

  return {
    categoriesTreeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getFilteredPaths,
      visibilityHandlerFactory,
      noDataMessage: getNoDataMessage(filter, filteringError),
      highlight: filter ? { text: filter } : undefined,
    },
    rendererProps: {
      getIcon,
      getSublabel,
    },
  };
}

function getNoDataMessage(filter: string, error?: CategoriesTreeFilteringError) {
  if (error) {
    return <Text>{TreeWidget.translate(`categoriesTree.filtering.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("categoriesTree.filtering.noMatches", { filter })}</Text>;
  }
  return undefined;
}

function getIcon() {
  return <SvgLayers />;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
