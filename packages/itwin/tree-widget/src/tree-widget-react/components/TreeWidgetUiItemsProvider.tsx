/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWidgetUiItemsProvider.css";
import { useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { StagePanelLocation, StagePanelSection, useTransientState } from "@itwin/appui-react";
import { Icon } from "@stratakit/foundations";
import hierarchyTreeSvg from "@stratakit/icons/hierarchy-tree.svg";
import { TreeWidget } from "../TreeWidget.js";
import { ErrorState } from "./tree-header/ErrorState.js";
import { useActiveTreeWidgetViewport } from "./trees/common/internal/UseActiveTreeWidgetViewport.js";
import { TreeWidgetContextProvider } from "./trees/common/TreeWidgetContextProvider.js";
import { TreeWidgetComponentImpl } from "./TreeWidgetComponentImpl.js";

import type { Ref } from "react";
import type { Widget } from "@itwin/appui-react";
import type { TreeWidgetViewport } from "./trees/common/TreeWidgetViewport.js";
import type { TreeDefinition } from "./TreeWidgetComponentImpl.js";

/**
 * Props for `createWidget`.
 * @public
 */
interface TreeWidgetProps {
  /**
   * Trees to show in the widget.
   * @see ModelsTreeComponent
   * @see CategoriesTreeComponent
   * @see ExternalSourcesTreeComponent
   * @see IModelContentTreeComponent
   */
  trees: TreeDefinition[];
  /** Callback that is invoked when performance of tracked feature is measured. */
  onPerformanceMeasured?: (feature: string, elapsedTime: number) => void;
  /** Callback that is invoked when a tracked feature is used. */
  onFeatureUsed?: (feature: string) => void;
  /**
   * Viewport used data querying.
   *
   * When viewport is not provided, `IModelApp.viewManager.selectedView` will be used.
   */
  treeWidgetViewport?: TreeWidgetViewport;
}

/**
 * Creates a tree widget definition that should be returned from `UiItemsProvider.getWidgets()`.
 * @public
 */
export function createTreeWidget(props: TreeWidgetProps): Widget {
  return {
    id: "tree-widget-react:trees",
    label: TreeWidget.translate("widget.label"),
    icon: <Icon href={hierarchyTreeSvg} />,
    layouts: {
      standard: {
        section: StagePanelSection.Start,
        location: StagePanelLocation.Right,
      },
    },
    content: (
      <TreeWidgetComponent
        trees={props.trees}
        onPerformanceMeasured={props.onPerformanceMeasured}
        onFeatureUsed={props.onFeatureUsed}
        treeWidgetViewport={props.treeWidgetViewport}
      />
    ),
  };
}

/**
 * Tree widget component which allows selecting which tree to render.
 * @public
 */
export function TreeWidgetComponent(props: TreeWidgetProps) {
  const ref = useTreeWidgetTransientState();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.treeWidgetViewport });
  if (!viewport) {
    return null;
  }

  return (
    <div ref={ref} className="tree-widget">
      <ErrorBoundary FallbackComponent={ErrorState}>
        <TreeWidgetContextProvider imodelConnection={viewport.iModel}>
          <TreeWidgetComponentImpl {...props} />
        </TreeWidgetContextProvider>
      </ErrorBoundary>
    </div>
  );
}

function useTreeWidgetTransientState() {
  const { ref, persist, restore } = useTreeStorage();
  useTransientState(persist, restore);
  return ref;
}

interface UseTreeStorageResult {
  ref: Ref<HTMLDivElement>;
  persist: () => void;
  restore: () => void;
}

function useTreeStorage(): UseTreeStorageResult {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTop = useRef<number | undefined>();

  const getContainer = () => {
    return ref.current?.querySelector("#tw-tree-renderer-container");
  };

  const persist = () => {
    const container = getContainer();
    scrollTop.current = container?.scrollTop;
  };

  const restore = () => {
    setTimeout(() => {
      const container = getContainer();
      if (container && scrollTop.current) {
        container.scrollTop = scrollTop.current;
      }
    });
  };

  return { ref, persist, restore };
}
