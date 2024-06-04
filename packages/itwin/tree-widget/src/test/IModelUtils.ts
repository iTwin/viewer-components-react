/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { XMLParser } from "fast-xml-parser";
import { Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, Code, IModel } from "@itwin/core-common";
import { buildTestIModel } from "@itwin/presentation-testing";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TestIModelBuilder } from "@itwin/presentation-testing";
import type {
  CategoryProps,
  ElementProps,
  ExternalSourceAspectProps,
  ExternalSourceProps,
  FunctionalElementProps,
  GeometricElement2dProps,
  GeometricModel2dProps,
  GeometricModel3dProps,
  InformationPartitionElementProps,
  ModelProps,
  PhysicalElementProps,
  RepositoryLinkProps,
  SubCategoryProps,
  SubjectProps,
} from "@itwin/core-common";

export async function buildIModel(
  mochaContext: Mocha.Context,
  setup?: (builder: TestIModelBuilder, testSchema: TestSchemaDefinition, mochaContext: Mocha.Context) => Promise<void>,
): Promise<{ imodel: IModelConnection }>;
export async function buildIModel<TResult extends {}>(
  mochaContext: Mocha.Context,
  setup: (builder: TestIModelBuilder, testSchema: TestSchemaDefinition, mochaContext: Mocha.Context) => Promise<TResult>,
): Promise<{ imodel: IModelConnection } & TResult>;
export async function buildIModel<TResult extends {} | undefined>(
  mochaContext: Mocha.Context,
  setup?: (builder: TestIModelBuilder, testSchema: TestSchemaDefinition, mochaContext: Mocha.Context) => Promise<TResult>,
) {
  let res!: TResult;
  // eslint-disable-next-line deprecation/deprecation
  const imodel = await buildTestIModel(mochaContext, async (builder) => {
    const testSchema = importSchema(
      mochaContext,
      builder,
      `
        <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
        <ECEntityClass typeName="SubModelabalePhysicalObject" displayLabel="Test Physical Object" modifier="Sealed" description="Similar to generic:PhysicalObject but also sub-modelable.">
          <BaseClass>bis:PhysicalElement</BaseClass>
          <BaseClass>bis:ISubModeledElement</BaseClass>
        </ECEntityClass>
      `,
    ) as TestSchemaDefinition;
    if (setup) {
      res = await setup(builder, testSchema, mochaContext);
    }
  });
  return { ...res, imodel };
}

interface TestSchemaDefinition extends ImportSchemaResult {
  items: { SubModelabalePhysicalObject: { name: string; fullName: string; label: string } };
}

interface ImportSchemaResult {
  schemaName: string;
  schemaAlias: string;
  items: { [className: string]: { name: string; fullName: string; label: string } };
}
export function importSchema(mochaContext: Mocha.Context, imodel: { importSchema: (xml: string) => void }, schemaContentXml: string): ImportSchemaResult {
  const schemaName = `SCHEMA_${mochaContext.test!.fullTitle()}`.replace(/[^\w\d_]/gi, "_").replace(/_+/g, "_");
  const schemaAlias = `test`;
  const schemaXml = getFullSchemaXml({ schemaName, schemaAlias, schemaContentXml });
  imodel.importSchema(schemaXml);

  const parsedSchema = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (_, jpath) => jpath.startsWith("ECSchema."),
  }).parse(schemaXml);
  const schemaItems = Object.values(parsedSchema.ECSchema)
    .flatMap<any>((itemDef) => itemDef)
    .filter((itemDef: any) => !!itemDef.typeName);

  return {
    schemaName,
    schemaAlias,
    items: schemaItems.reduce<{ [className: string]: { name: string; fullName: string; label: string } }>((classesObj, schemaItemDef) => {
      const name = schemaItemDef.typeName;
      return {
        ...classesObj,
        [name]: {
          fullName: `${schemaName}.${name}`,
          name,
          label: schemaItemDef.displayLabel,
        },
      };
    }, {}),
  };
}
function getFullSchemaXml(props: { schemaName: string; schemaAlias?: string; schemaContentXml: string }) {
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

interface BaseInstanceInsertProps {
  builder: TestIModelBuilder;
  fullClassNameSeparator?: ":" | ".";
}

export function insertSubject(
  props: BaseInstanceInsertProps & { codeValue: string; parentId?: Id64String } & Partial<Omit<SubjectProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, classFullName, codeValue, parentId, ...subjectProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}Subject`;
  const className = classFullName ?? defaultClassName;
  const id = builder.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: builder.createCode(parentId ?? IModel.rootSubjectId, BisCodeSpec.subject, codeValue),
    parent: {
      id: parentId ?? IModel.rootSubjectId,
      relClassName: "BisCore.SubjectOwnsSubjects",
    },
    ...subjectProps,
  });
  return { className, id };
}

export function insertModelWithPartition(
  props: BaseInstanceInsertProps & { modelClassFullName: string; partitionClassFullName: string; codeValue: string; partitionParentId?: Id64String },
) {
  const { modelClassFullName, partitionClassFullName, codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertPartition({ ...baseProps, classFullName: partitionClassFullName, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertSubModel({ ...baseProps, classFullName: modelClassFullName, modeledElementId: partitionKey.id });
}

export function insertPartition(
  props: BaseInstanceInsertProps & { classFullName: string; codeValue: string; parentId: Id64String } & Partial<
      Omit<InformationPartitionElementProps, "id" | "parent" | "code">
    >,
) {
  const { builder, classFullName, codeValue, parentId, ...partitionProps } = props;
  const partitionId = builder.insertElement({
    classFullName,
    model: IModel.repositoryModelId,
    code: builder.createCode(parentId, BisCodeSpec.informationPartitionElement, codeValue),
    parent: {
      id: parentId,
      relClassName: `BisCore${props.fullClassNameSeparator ?? "."}SubjectOwnsPartitionElements`,
    },
    ...partitionProps,
  });
  return { className: classFullName, id: partitionId };
}

export function insertSubModel(
  props: BaseInstanceInsertProps & { classFullName: string; modeledElementId: Id64String } & Partial<Omit<ModelProps, "id" | "modeledElement" | "parentModel">>,
) {
  const { builder, classFullName, modeledElementId, ...modelProps } = props;
  const modelId = builder.insertModel({
    classFullName,
    modeledElement: { id: modeledElementId },
    ...modelProps,
  });
  return { className: classFullName, id: modelId };
}

export function insertPhysicalModelWithPartition(props: BaseInstanceInsertProps & { codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertPhysicalPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertPhysicalSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertPhysicalPartition(
  props: BaseInstanceInsertProps & { codeValue: string; parentId: Id64String } & Partial<Omit<InformationPartitionElementProps, "id" | "parent" | "code">>,
) {
  return insertPartition({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}PhysicalPartition`,
    ...props,
  });
}

export function insertPhysicalSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  return insertSubModel({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}PhysicalModel`,
    ...props,
  });
}

export function insertDrawingModelWithPartition(props: BaseInstanceInsertProps & { codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertDrawingPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertDrawingSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertDrawingPartition(
  props: BaseInstanceInsertProps & { codeValue: string; parentId: Id64String } & Partial<
      Omit<InformationPartitionElementProps, "id" | "parent" | "code" | "userLabel">
    >,
) {
  return insertPartition({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}Drawing`,
    ...props,
  });
}

export function insertDrawingSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel2dProps, "id" | "modeledElement" | "parentModel">>,
) {
  return insertSubModel({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}DrawingModel`,
    ...props,
  });
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

export function insertDrawingCategory(
  props: BaseInstanceInsertProps & { codeValue: string; modelId?: Id64String } & Partial<Omit<CategoryProps, "id" | "model" | "parent" | "code">>,
) {
  const { builder, classFullName, modelId, codeValue, ...categoryProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}DrawingCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = builder.insertElement({
    classFullName: className,
    model,
    code: builder.createCode(model, BisCodeSpec.drawingCategory, codeValue),
    ...categoryProps,
  });
  return { className, id };
}

export function getDefaultSubcategoryKey(categoryId: Id64String, fullClassNameSeparator?: string) {
  const pair = Id64.getUint32Pair(categoryId);
  pair.lower++; // id of default subcategory is always `category id + 1`
  return {
    className: `BisCore${fullClassNameSeparator ?? "."}SubCategory`,
    id: Id64.fromUint32PairObject(pair),
  };
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

export function insertPhysicalElement<TAdditionalProps extends {}>(
  props: BaseInstanceInsertProps & { modelId: Id64String; categoryId: Id64String; parentId?: Id64String } & Partial<
      Omit<PhysicalElementProps, "id" | "model" | "category" | "parent">
    > &
    TAdditionalProps,
) {
  const { builder, classFullName, modelId, categoryId, parentId, ...elementProps } = props;
  const defaultClassName = `Generic${props.fullClassNameSeparator ?? "."}PhysicalObject`;
  const className = classFullName ?? defaultClassName;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    category: categoryId,
    code: Code.createEmpty(),
    ...(parentId
      ? {
          parent: {
            id: parentId,
            relClassName: `BisCore${props.fullClassNameSeparator ?? "."}PhysicalElementAssemblesElements`,
          },
        }
      : undefined),
    ...elementProps,
  } as PhysicalElementProps);
  return { className, id };
}

export function insertDrawingGraphic<TAdditionalProps extends {}>(
  props: BaseInstanceInsertProps & { modelId: Id64String; categoryId: Id64String; parentId?: Id64String } & Partial<
      Omit<GeometricElement2dProps, "id" | "model" | "category" | "parent">
    > &
    TAdditionalProps,
) {
  const { builder, classFullName, modelId, categoryId, parentId, ...elementProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}DrawingGraphic`;
  const className = classFullName ?? defaultClassName;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    category: categoryId,
    code: Code.createEmpty(),
    ...(parentId
      ? {
          parent: {
            id: parentId,
            relClassName: `BisCore${props.fullClassNameSeparator ?? "."}ElementOwnsChildElements`,
          },
        }
      : undefined),
    ...elementProps,
  } as GeometricElement2dProps);
  return { className, id };
}

export function insertDrawingElement<TAdditionalProps extends {}>(
  props: BaseInstanceInsertProps & { modelId: Id64String; codeValue: string; parentId?: Id64String } & Partial<
      Omit<ElementProps, "id" | "model" | "parent" | "code">
    > &
    TAdditionalProps,
) {
  const { builder, classFullName, codeValue, modelId, parentId, ...elementProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}Drawing`;
  const className = classFullName ?? defaultClassName;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? builder.createCode(parentId ?? modelId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    ...(parentId
      ? {
          parent: {
            id: parentId,
            relClassName: `BisCore${props.fullClassNameSeparator ?? "."}ElementOwnsChildElements`,
          },
        }
      : undefined),
    ...elementProps,
  } satisfies ElementProps);
  return { className, id };
}

export function insertRepositoryLink(
  props: BaseInstanceInsertProps & { repositoryUrl: string; repositoryLabel: string } & Partial<
      Omit<RepositoryLinkProps, "id" | "model" | "url" | "userLabel">
    >,
) {
  const { builder, classFullName, repositoryUrl, repositoryLabel, ...repoLinkProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}RepositoryLink`;
  const className = classFullName ?? defaultClassName;
  const id = builder.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    url: repositoryUrl,
    userLabel: repositoryLabel,
    ...repoLinkProps,
  } as RepositoryLinkProps);
  return { className, id };
}

export function insertExternalSourceAspect(
  props: BaseInstanceInsertProps & { elementId: Id64String; identifier: String; repositoryId?: Id64String } & Partial<
      Omit<ExternalSourceAspectProps, "id" | "classFullName" | "element" | "source">
    >,
) {
  const { builder, repositoryId, elementId, identifier, ...externalSourceAspectProps } = props;
  const externalSourceId = builder.insertElement({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}ExternalSource`,
    model: IModel.repositoryModelId,
    repository: repositoryId
      ? {
          id: repositoryId,
        }
      : undefined,
  } as ExternalSourceProps);

  const className = `BisCore${props.fullClassNameSeparator ?? "."}ExternalSourceAspect`;
  const id = builder.insertAspect({
    classFullName: className,
    kind: "ExternalSource",
    element: {
      id: elementId,
    },
    source: {
      id: externalSourceId,
    },
    identifier,
    ...externalSourceAspectProps,
  } as ExternalSourceAspectProps);

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
  return insertPartition({
    classFullName: `Functional${props.fullClassNameSeparator ?? "."}FunctionalPartition`,
    ...props,
  });
}

export function insertFunctionalSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  return insertSubModel({
    classFullName: `Functional${props.fullClassNameSeparator ?? "."}FunctionalModel`,
    ...props,
  });
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

export function insertGroupInformationModelWithPartition(props: BaseInstanceInsertProps & { codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertGroupInformationPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertGroupInformationSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertGroupInformationPartition(
  props: BaseInstanceInsertProps & { codeValue: string; parentId: Id64String } & Partial<Omit<InformationPartitionElementProps, "id" | "parent" | "code">>,
) {
  return insertPartition({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}GroupInformationPartition`,
    ...props,
  });
}

export function insertGroupInformationSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  return insertSubModel({
    classFullName: `Generic${props.fullClassNameSeparator ?? "."}GroupModel`,
    ...props,
  });
}

export function insertGroupInformationElement(
  props: BaseInstanceInsertProps & {
    modelId: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<FunctionalElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, parentId, ...elementProps } = props;
  const className = `Generic${props.fullClassNameSeparator ?? "."}Group`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? builder.createCode(parentId ?? modelId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: `BisCore${props.fullClassNameSeparator ?? "."}ElementOwnsChildElements`,
        }
      : undefined,
    ...elementProps,
  });
  return { className, id };
}

export function insertDefinitionModelWithPartition(props: BaseInstanceInsertProps & { codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertDefinitionPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertDefinitionSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertDefinitionPartition(
  props: BaseInstanceInsertProps & { codeValue: string; parentId: Id64String } & Partial<Omit<InformationPartitionElementProps, "id" | "parent" | "code">>,
) {
  return insertPartition({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}DefinitionPartition`,
    ...props,
  });
}

export function insertDefinitionSubModel(
  props: BaseInstanceInsertProps & { modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  return insertSubModel({
    classFullName: `BisCore${props.fullClassNameSeparator ?? "."}DefinitionModel`,
    ...props,
  });
}
