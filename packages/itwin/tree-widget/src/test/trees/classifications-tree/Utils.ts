/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "node:fs";
import { createRequire } from "node:module";
import { createCode, importSchema, insertDefinitionSubModel } from "test-utilities";
import { Code, IModel } from "@itwin/core-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ClassificationsTreeDefinition } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";
import { ClassificationsTreeIdsCache } from "../../../tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeIdsCache.js";
import { BaseIdsCache } from "../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { createIModelAccess } from "../Common.js";

import type { EditTxn, IModelDb } from "@itwin/core-backend";
import type { Id64String } from "@itwin/core-bentley";
import type { DefinitionElementProps } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { EC } from "@itwin/presentation-shared";
import type { ClassificationsTreeHierarchyConfiguration } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";

export function createClassificationsTreeProvider(
  imodel: IModelConnection,
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration,
): HierarchyProvider & Disposable {
  const imodelAccess = createIModelAccess(imodel);
  const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: CLASS_NAME_GeometricElement3d, type: "3d" });
  const idsCache = new ClassificationsTreeIdsCache({
    queryExecutor: imodelAccess,
    hierarchyConfig,
    baseIdsCache,
  });
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
    },
  };
}

export function insertClassificationSystem(
  props: {
    txn: EditTxn;
    modelId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { txn, codeValue, modelId, ...elementProps } = props;
  const className: EC.FullClassName = `ClassificationSystems.ClassificationSystem`;
  const id = txn.insertElement({
    classFullName: className,
    model: modelId ?? IModel.dictionaryId,
    code: codeValue ? createCode({ imodel: txn.iModel, scopeId: modelId ?? IModel.dictionaryId, codeValue }) : Code.createEmpty(),
    ...elementProps,
  });
  return { className, id };
}

export function insertClassificationTable(
  props: {
    txn: EditTxn;
    modelId?: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { txn, codeValue, modelId, parentId, ...elementProps } = props;
  const className: EC.FullClassName = `ClassificationSystems.ClassificationTable`;
  const id = txn.insertElement({
    classFullName: className,
    model: modelId ?? IModel.dictionaryId,
    code: codeValue ? createCode({ imodel: txn.iModel, scopeId: parentId ?? modelId ?? IModel.dictionaryId, codeValue }) : Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: "ClassificationSystems.ClassificationSystemOwnsClassificationTable",
        }
      : undefined,
    ...elementProps,
  });
  insertDefinitionSubModel({
    txn,
    modeledElementId: id,
    relationshipName: "ClassificationSystems.DefinitionModelBreaksDownClassificationTable",
  });
  return { className, id };
}

export function insertClassification(
  props: {
    txn: EditTxn;
    modelId: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { txn, codeValue, modelId, parentId, ...elementProps } = props;
  const className: EC.FullClassName = `ClassificationSystems.Classification`;
  const id = txn.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? createCode({ imodel: txn.iModel, scopeId: parentId ?? modelId, codeValue }) : Code.createEmpty(),
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

export function insertElementHasClassificationsRelationship(props: { txn: EditTxn; elementId: Id64String; classificationId: Id64String }) {
  const { txn, elementId, classificationId } = props;
  return txn.insertRelationship({
    classFullName: "ClassificationSystems.ElementHasClassifications",
    sourceId: elementId,
    targetId: classificationId,
  });
}

export async function importClassificationSchema(imodel: IModelDb) {
  const require = createRequire(import.meta.url);
  const schemaPath = require.resolve("@bentley/classification-systems-schema/ClassificationSystems.ecschema.xml");
  const schemaXml = fs.readFileSync(fs.realpathSync(schemaPath), { encoding: "utf-8" });
  await imodel.importSchemaStrings([schemaXml]);
}

export function insertCategorySymbolizesClassificationRelationship(props: { txn: EditTxn; categoryId: Id64String; classificationId: Id64String }) {
  const { txn, categoryId, classificationId } = props;
  return txn.insertRelationship({
    classFullName: `${CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA}.CategorySymbolizesClassification`,
    sourceId: categoryId,
    targetId: classificationId,
  });
}

export const CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA = "TestClassificationSchema";

export async function importCategorySymbolizesClassificationSchema(imodel: IModelDb) {
  // cspell:disable
  await importSchema({
    imodel,
    schemaName: CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA,
    schemaAlias: "tst",
    schemaContentXml: `
      <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
      <ECSchemaReference name="ClassificationSystems" version="01.00.04" alias="clsf" />
      <ECRelationshipClass typeName="CategorySymbolizesClassification" modifier="None" strength="referencing">
          <BaseClass>bis:ElementRefersToElements</BaseClass>
          <Source multiplicity="(0..*)" roleLabel="symbolizes" polymorphic="true">
              <Class class="bis:Category" />
          </Source>
          <Target multiplicity="(0..*)" roleLabel="is symbolized by" polymorphic="true">
              <Class class="clsf:Classification"/>
          </Target>
      </ECRelationshipClass>
    `,
  });
  // cspell:enable
}
