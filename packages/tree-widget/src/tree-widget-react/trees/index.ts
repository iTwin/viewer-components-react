/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export { ModelsTreeComponent } from "./models-tree/ModelsTreeComponent.js";
export { useModelsTree } from "./models-tree/UseModelsTree.js";
export { ModelsTreeIcon } from "./models-tree/ModelsTreeIcon.js";
export { useModelsTreeButtonProps } from "./models-tree/ModelsTreeButtons.js";
export { ModelsTreeNode } from "./models-tree/ModelsTreeNode.js";

export { CategoriesTreeComponent } from "./categories-tree/CategoriesTreeComponent.js";
export { useCategoriesTree } from "./categories-tree/UseCategoriesTree.js";
export { CategoriesTreeIcon } from "./categories-tree/CategoriesTreeIcon.js";
export { useCategoriesTreeButtonProps } from "./categories-tree/CategoriesTreeButtons.js";
export { CategoriesTreeNode } from "./categories-tree/CategoriesTreeNode.js";

export { ClassificationsTreeComponent } from "./classifications-tree/ClassificationsTreeComponent.js";
export { ClassificationsTreeIcon } from "./classifications-tree/ClassificationsTreeIcon.js";
export { useClassificationsTree } from "./classifications-tree/UseClassificationsTree.js";
export { useClassificationsTreeDefinition } from "./classifications-tree/UseClassificationsTreeDefinition.js";
export { ClassificationsTreeNode } from "./classifications-tree/ClassificationsTreeNode.js";

export { IModelContentTreeComponent } from "./imodel-content-tree/IModelContentTreeComponent.js";
export { IModelContentTreeIcon } from "./imodel-content-tree/IModelContentTree.js";

export { ExternalSourcesTreeComponent } from "./external-sources-tree/ExternalSourcesTreeComponent.js";
export { ExternalSourcesTreeIcon } from "./external-sources-tree/ExternalSourcesTree.js";

export { FocusedInstancesContextProvider, useFocusedInstancesContext } from "../shared/FocusedInstancesContext.js";

export { Tree } from "../shared/components/Tree.js";
export type { TreeWidgetViewport } from "../shared/TreeWidgetViewport.js";
export { createTreeWidgetViewport } from "../shared/TreeWidgetViewport.js";
export { VisibilityTree } from "../shared/components/VisibilityTree.js";
export { VisibilityAction } from "../shared/components/TreeNodeVisibilityButton.js";
export { TreeRenderer } from "../shared/components/TreeRenderer.js";
export { VisibilityTreeRenderer } from "../shared/components/VisibilityTreeRenderer.js";
export { SkeletonTree } from "../shared/components/SkeletonTree.js";
export type { HierarchyVisibilityHandler, VisibilityStatus } from "../shared/UseHierarchyVisibility.js";
export { SharedTreeContextProvider } from "../shared/SharedTreeContextProvider.js";
export { TelemetryContextProvider } from "../shared/UseTelemetryContext.js";
export { SearchLimitExceededError } from "../shared/TreeErrors.js";

export type { ModelsTreeVisibilityHandlerOverrides } from "./models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";

// reexport actions from presentation-hierarchies-react to keep naming consistent
// reexport TreeActionBase to allow consumers defining custom actions without @itwin/presentation-hierarchies-react dependency
export type { TreeActionBaseAttributes } from "@itwin/presentation-hierarchies-react/stratakit";
export { TreeNodeRenameAction, TreeNodeFilterAction, TreeActionBase } from "@itwin/presentation-hierarchies-react/stratakit";
