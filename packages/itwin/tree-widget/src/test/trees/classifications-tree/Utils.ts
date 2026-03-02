/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "node:fs";
import { BisCodeSpec, Code, IModel } from "@itwin/core-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ClassificationsTreeIdsCache } from "../../../tree-widget-react-internal.js";
import { ClassificationsTreeDefinition } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";
import { BaseIdsCache } from "../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { insertDefinitionSubModel } from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";

import type { Id64String } from "@itwin/core-bentley";
import type { DefinitionElementProps } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { TestIModelBuilder } from "@itwin/presentation-testing";
import type { ClassificationsTreeHierarchyConfiguration } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";

export function createClassificationsTreeProvider(
  imodel: IModelConnection,
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration,
): HierarchyProvider & Disposable {
  const imodelAccess = createIModelAccess(imodel);
  const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: CLASS_NAME_GeometricElement3d, type: "3d" });
  const idsCache = new ClassificationsTreeIdsCache({ queryExecutor: imodelAccess, hierarchyConfig, baseIdsCache });
  const hierarchyProvider = createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ClassificationsTreeDefinition({
      imodelAccess,
      getIdsCache: () => idsCache,
      hierarchyConfig,
    }),
  });
  return {
    hierarchyChanged: hierarchyProvider.hierarchyChanged,
    getNodes: (props) => hierarchyProvider.getNodes(props),
    getNodeInstanceKeys: (props) => hierarchyProvider.getNodeInstanceKeys(props),
    setFormatter: (formatter) => hierarchyProvider.setFormatter(formatter),
    setHierarchySearch: (props) => hierarchyProvider.setHierarchySearch(props),
    [Symbol.dispose]() {
      hierarchyProvider[Symbol.dispose]();
      idsCache[Symbol.dispose]();
      baseIdsCache[Symbol.dispose]();
    },
  };
}

export function insertClassificationSystem(
  props: {
    builder: TestIModelBuilder;
    modelId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, ...elementProps } = props;
  const className = `ClassificationSystems.ClassificationSystem`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId ?? IModel.dictionaryId,
    code: codeValue ? builder.createCode(modelId ?? IModel.dictionaryId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    ...elementProps,
  });
  return { className, id };
}

export function insertClassificationTable(
  props: {
    builder: TestIModelBuilder;
    modelId?: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, parentId, ...elementProps } = props;
  const className = `ClassificationSystems.ClassificationTable`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId ?? IModel.dictionaryId,
    code: codeValue ? builder.createCode(parentId ?? modelId ?? IModel.dictionaryId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: "ClassificationSystems.ClassificationSystemOwnsClassificationTable",
        }
      : undefined,
    ...elementProps,
  });
  insertDefinitionSubModel({
    builder,
    modeledElementId: id,
    modelModelsElementRelationshipName: "ClassificationSystems.DefinitionModelBreaksDownClassificationTable",
  });
  return { className, id };
}

export function insertClassification(
  props: {
    builder: TestIModelBuilder;
    modelId: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, parentId, ...elementProps } = props;
  const className = `ClassificationSystems.Classification`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? builder.createCode(parentId ?? modelId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: "ClassificationSystems.ClassificationOwnsSubClassifications",
        }
      : undefined,
    ...elementProps,
  });
  return { className, id };
}

export function insertElementHasClassificationsRelationship(props: { builder: TestIModelBuilder; elementId: Id64String; classificationId: Id64String }) {
  const { builder, elementId, classificationId } = props;
  return builder.insertRelationship({
    classFullName: "ClassificationSystems.ElementHasClassifications",
    sourceId: elementId,
    targetId: classificationId,
  });
}

export async function importClassificationSchema(builder: TestIModelBuilder) {
  const schemaPath = import.meta.resolve("@bentley/classification-systems-schema/ClassificationSystems.ecschema.xml");
  const schemaXml = fs.readFileSync(fs.realpathSync(new URL(schemaPath)), { encoding: "utf-8" });
  await builder.importSchema(schemaXml);
}
