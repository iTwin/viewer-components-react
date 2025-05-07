/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type {
  CategoryProps,
  CodeScopeProps,
  ElementAspectProps,
  ElementProps,
  FunctionalElementProps,
  GeometricModel3dProps,
  InformationPartitionElementProps,
  ModelProps,
  PhysicalElementProps,
  RelationshipProps,
  SubCategoryProps,
} from "@itwin/core-common";
import { BisCodeSpec, Code, IModel } from "@itwin/core-common";

import type { Id64String } from "@itwin/core-bentley";

export interface TestIModelBuilder {
  insertModel(props: ModelProps): Id64String;
  insertElement(props: ElementProps): Id64String;
  insertAspect(props: ElementAspectProps): Id64String;
  insertRelationship(props: RelationshipProps): Id64String;
  createCode(scopeModelId: CodeScopeProps, codeSpecName: BisCodeSpec, codeValue: string): Code;
}

export interface BaseInstanceInsertProps {
  builder: TestIModelBuilder;
  fullClassNameSeparator?: ":" | ".";
}

export function insertPhysicalModelWithPartition(props: BaseInstanceInsertProps & { codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertPhysicalPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertPhysicalSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertPhysicalPartition(
  props: BaseInstanceInsertProps & { codeValue: string; parentId: Id64String } & Partial<Omit<InformationPartitionElementProps, "id" | "parent" | "code">>,
) {
  const { builder, classFullName, codeValue, parentId, ...partitionProps } = props;
  const defaultModelClassName = `BisCore${props.fullClassNameSeparator ?? "."}PhysicalPartition`;
  const className = classFullName ?? defaultModelClassName;
  const partitionId = builder.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: builder.createCode(parentId, BisCodeSpec.informationPartitionElement, codeValue),
    parent: {
      id: parentId,
      relClassName: `BisCore${props.fullClassNameSeparator ?? "."}SubjectOwnsPartitionElements`,
    },
    ...partitionProps,
  });
  return { className, id: partitionId };
}

export function insertPhysicalSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  const { builder, classFullName, modeledElementId, ...modelProps } = props;
  const defaultModelClassName = `BisCore${props.fullClassNameSeparator ?? "."}PhysicalModel`;
  const className = classFullName ?? defaultModelClassName;
  const modelId = builder.insertModel({
    classFullName: className,
    modeledElement: { id: modeledElementId },
    ...modelProps,
  });
  return { className, id: modelId };
}

export function insertSpatialCategory(
  props: BaseInstanceInsertProps & { codeValue: string; modelId?: Id64String } & Partial<Omit<CategoryProps, "id" | "model" | "parent" | "code">>,
) {
  const { builder, classFullName, modelId, codeValue, ...categoryProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}SpatialCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = builder.insertElement({
    classFullName: className,
    model,
    code: builder.createCode(model, BisCodeSpec.spatialCategory, codeValue),
    ...categoryProps,
  });
  return { className, id };
}

export function insertSubCategory(
  props: BaseInstanceInsertProps & { codeValue: string; parentCategoryId: Id64String; modelId?: Id64String } & Partial<
      Omit<SubCategoryProps, "id" | "model" | "parent" | "code">
    >,
) {
  const { builder, classFullName, modelId, codeValue, parentCategoryId, ...subCategoryProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}SubCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = builder.insertElement({
    classFullName: className,
    model,
    code: builder.createCode(model, BisCodeSpec.subCategory, codeValue),
    parent: {
      id: parentCategoryId,
      relClassName: `BisCore${props.fullClassNameSeparator ?? "."}CategoryOwnsSubCategories`,
    },
    ...subCategoryProps,
  });
  return { className, id };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function insertPhysicalElement<TAdditionalProps extends {}>(
  props: BaseInstanceInsertProps & {
    modelId: Id64String;
    categoryId: Id64String;
    codeValue?: string;
    parentId?: Id64String;
    typeDefinitionId?: Id64String;
  } & Partial<Omit<PhysicalElementProps, "id" | "model" | "category" | "parent" | "typeDefinition" | "code">> &
    TAdditionalProps,
) {
  const { builder, classFullName, modelId, categoryId, parentId, typeDefinitionId, codeValue, ...elementProps } = props;
  const defaultClassName = `Generic${props.fullClassNameSeparator ?? "."}PhysicalObject`;
  const className = classFullName ?? defaultClassName;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    category: categoryId,
    code: codeValue ? builder.createCode(parentId ?? modelId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    ...(parentId
      ? {
          parent: {
            id: parentId,
            relClassName: `BisCore${props.fullClassNameSeparator ?? "."}PhysicalElementAssemblesElements`,
          },
        }
      : undefined),
    ...(typeDefinitionId
      ? {
          typeDefinition: {
            id: typeDefinitionId,
            relClassName: `BisCore${props.fullClassNameSeparator ?? "."}PhysicalElementIsOfType`,
          },
        }
      : undefined),
    ...elementProps,
  } as PhysicalElementProps);
  return { className, id };
}

export function insertFunctionalModelWithPartition(props: BaseInstanceInsertProps & { codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertFunctionalPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertFunctionalSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertFunctionalPartition(
  props: BaseInstanceInsertProps & { codeValue: string; parentId: Id64String } & Partial<Omit<InformationPartitionElementProps, "id" | "parent" | "code">>,
) {
  const { builder, classFullName, codeValue, parentId, ...partitionProps } = props;
  const defaultModelClassName = `Functional${props.fullClassNameSeparator ?? "."}FunctionalPartition `;
  const className = classFullName ?? defaultModelClassName;
  const partitionId = builder.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: builder.createCode(parentId, BisCodeSpec.informationPartitionElement, codeValue),
    parent: {
      id: parentId,
      relClassName: `BisCore${props.fullClassNameSeparator ?? "."}SubjectOwnsPartitionElements`,
    },
    ...partitionProps,
  });
  return { className, id: partitionId };
}

export function insertFunctionalSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  const { builder, classFullName, modeledElementId, ...modelProps } = props;
  const defaultModelClassName = `Functional${props.fullClassNameSeparator ?? "."}FunctionalModel`;
  const className = classFullName ?? defaultModelClassName;
  const modelId = builder.insertModel({
    classFullName: className,
    modeledElement: { id: modeledElementId },
    ...modelProps,
  });
  return { className, id: modelId };
}

export function insertFunctionalElement(
  props: BaseInstanceInsertProps & {
    modelId: Id64String;
    representedElementId: Id64String;
    relationshipName: "DrawingGraphicRepresentsFunctionalElement" | "PhysicalElementFulfillsFunction";
    parentId?: string;
  } & Partial<Omit<FunctionalElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, modelId, representedElementId, relationshipName, parentId, ...elementProps } = props;
  const className = `Functional${props.fullClassNameSeparator ?? "."}FunctionalComposite`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    code: Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: `BisCore${props.fullClassNameSeparator ?? "."}ElementOwnsChildElements`,
        }
      : undefined,
    ...elementProps,
  } as FunctionalElementProps);
  builder.insertRelationship({
    sourceId: representedElementId,
    targetId: id,
    classFullName: `Functional.${relationshipName}`,
  });
  return { className, id };
}

export interface GetFullSchemaXmlProps {
  schemaName: string;
  schemaAlias?: string;
  schemaContentXml: string;
}

/**
 * Adds boilerplate to the XML schema.
 */
export function getFullSchemaXml(props: GetFullSchemaXmlProps) {
  const schemaAlias = props.schemaAlias ?? `test`;
  return `
    <?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="${props.schemaName}" alias="${schemaAlias}" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA" />
      <ECSchemaReference name="ECDbMap" version="02.00.01" alias="ecdbmap" />
      ${props.schemaContentXml}
    </ECSchema>
  `;
}
