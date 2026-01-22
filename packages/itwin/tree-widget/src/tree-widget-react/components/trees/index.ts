/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export { ModelsTreeComponent } from "./models-tree/ModelsTreeComponent.js";
export { useModelsTree, ModelsTreeIcon } from "./models-tree/UseModelsTree.js";
export { useModelsTreeButtonProps } from "./models-tree/ModelsTreeButtons.js";
export { ModelsTreeNode } from "./models-tree/ModelsTreeNode.js";

export { CategoriesTreeComponent } from "./categories-tree/CategoriesTreeComponent.js";
export { useCategoriesTree, CategoriesTreeIcon } from "./categories-tree/UseCategoriesTree.js";
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

export { BaseTreeRendererProps } from "./common/components/BaseTreeRenderer.js";
export { FocusedInstancesContextProvider, useFocusedInstancesContext } from "./common/FocusedInstancesContext.js";

export { Tree } from "./common/components/Tree.js";
export { TreeWidgetViewport, createTreeWidgetViewport } from "./common/TreeWidgetViewport.js";
export { VisibilityTree } from "./common/components/VisibilityTree.js";
export { VisibilityAction } from "./common/components/TreeNodeVisibilityButton.js";
export { TreeRenderer } from "./common/components/TreeRenderer.js";
export { VisibilityTreeRenderer } from "./common/components/VisibilityTreeRenderer.js";
export { SkeletonTree } from "./common/components/SkeletonTree.js";
export { HierarchyVisibilityHandler, VisibilityStatus } from "./common/UseHierarchyVisibility.js";
export { TelemetryContextProvider } from "./common/UseTelemetryContext.js";
export { SearchLimitExceededError } from "./common/TreeErrors.js";

export { ModelsTreeVisibilityHandlerOverrides } from "./models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";

// reexport actions from presentation-hierarchies-react to keep naming consistent
// reexport TreeActionBase to allow consumers defining custom actions without @itwin/presentation-hierarchies-react dependency
export { TreeNodeRenameAction, TreeNodeFilterAction, TreeActionBase, TreeActionBaseAttributes } from "@itwin/presentation-hierarchies-react";
