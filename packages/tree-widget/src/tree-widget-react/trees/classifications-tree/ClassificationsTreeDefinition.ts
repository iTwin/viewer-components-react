/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createClassificationsTree } from "@itwin/presentation-tree-definitions";
import { ParentElementsPath } from "../../shared/internal/Utils.js";
import { mapSearchLimitExceededError } from "../../shared/TreeErrors.js";
import { ClassificationsTreeNodeInternal } from "./internal/ClassificationsTreeNodeInternal.js";

import type { GuidString } from "@itwin/core-bentley";
import type {
  DefineHierarchyLevelProps,
  HierarchyDefinition,
  LimitingECSqlQueryExecutor,
  NodePostProcessor,
  NodePreProcessor,
} from "@itwin/presentation-hierarchies";
import type { EC, ECSchemaProvider, InstanceKey } from "@itwin/presentation-shared";
import type { ClassificationsTreeIdsProvider } from "./internal/ClassificationsTreeIdsProvider.js";

interface ClassificationsTreeDefinitionProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  idsProvider: ClassificationsTreeIdsProvider;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
}

/** @beta */
export interface ClassificationsTreeHierarchyConfiguration {
  /**
   * The classifications' hierarchy starts at the root `ClassificationSystem` element. This attribute identifiers that
   * root `ClassificationSystem`.
   */
  rootClassificationSystemCode: string;
  /**
   * Element node's configuration options.
   *
   * Defaults to `{ excludedClasses: [] }`.
   */
  elements?: {
    /**
     * Element classes to exclude from the hierarchy.
     *
     * Elements, whose class is or derives from one of the classes in this list, are not loaded into the hierarchy.
     * Children of such nodes are also not shown.
     *
     * Defaults to `[]`.
     */
    excludedClasses?: EC.FullClassNameDotNotation[];
  };
}

interface ClassificationsTreeInstanceKeyPathsBaseProps {
  imodelAccess: ECSchemaProvider & LimitingECSqlQueryExecutor;
  limit?: number | "unbounded";
  idsProvider: ClassificationsTreeIdsProvider;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  componentId?: GuidString;
  abortSignal?: AbortSignal;
}

/** @internal */
export interface ClassificationsTreeInstanceKeyPathsFromInstanceLabelProps extends ClassificationsTreeInstanceKeyPathsBaseProps {
  label: string;
}

/** @internal */
export interface ClassificationsTreeInstanceKeyPathsFromInstanceKeysProps extends ClassificationsTreeInstanceKeyPathsBaseProps {
  targetItems: Array<InstanceKey>;
}

type ClassificationsTreeInstanceKeyPaths = ReturnType<ReturnType<typeof createClassificationsTree>["createInstanceKeyPaths"]>;

/**
 * Classifications tree hierarchy definition. Uses `@itwin/presentation-tree-definitions` classifications tree definition under the hood and
 * additionally assigns `parentElementsPath` to element nodes.
 * @internal
 */
export class ClassificationsTreeDefinition implements HierarchyDefinition {
  #impl: HierarchyDefinition;

  public constructor(props: ClassificationsTreeDefinitionProps) {
    this.#impl = createClassificationsTree({
      imodelAccess: props.imodelAccess,
      idsProvider: props.idsProvider,
      hierarchyConfig: props.hierarchyConfig,
    }).hierarchyDefinition;
  }

  public preProcessNode: NodePreProcessor = async (props) => (this.#impl.preProcessNode ? this.#impl.preProcessNode(props) : props.node);

  public postProcessNode: NodePostProcessor = async (props) => {
    const node = this.#impl.postProcessNode ? await this.#impl.postProcessNode(props) : props.node;
    if (!ClassificationsTreeNodeInternal.isGeometricElementNode(node)) {
      return node;
    }
    const { parentNode } = props;
    assert(parentNode !== undefined);
    if (ClassificationsTreeNodeInternal.isClassificationNode(parentNode)) {
      node.extendedData = {
        ...node.extendedData,
        parentElementsPath: [],
      };
      return node;
    }
    assert(ClassificationsTreeNodeInternal.isGeometricElementNode(parentNode));
    node.extendedData = {
      ...node.extendedData,
      parentElementsPath: ParentElementsPath.appendToPath({
        path: parentNode.extendedData.parentElementsPath,
        ids: parentNode.key.instanceKeys.map(({ id }) => id),
        categoryId: parentNode.extendedData.categoryId,
      }),
    };
    return node;
  };

  public async defineHierarchyLevel(props: DefineHierarchyLevelProps) {
    return this.#impl.defineHierarchyLevel(props);
  }

  public static createInstanceKeyPaths(
    props: ClassificationsTreeInstanceKeyPathsFromInstanceLabelProps | ClassificationsTreeInstanceKeyPathsFromInstanceKeysProps,
  ): ClassificationsTreeInstanceKeyPaths {
    const { imodelAccess, idsProvider, hierarchyConfig, componentId, limit, abortSignal } = props;
    const { createInstanceKeyPaths } = createClassificationsTree({ imodelAccess, idsProvider, hierarchyConfig, uniqueId: componentId });
    return mapSearchLimitExceededError(
      "label" in props
        ? createInstanceKeyPaths({ label: props.label, limit, abortSignal })
        : createInstanceKeyPaths({ targetItems: props.targetItems, limit, abortSignal }),
    );
  }
}
