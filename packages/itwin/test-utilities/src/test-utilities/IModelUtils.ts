/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cspell:words ecdbmap jpath

import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";
import { SnapshotDb } from "@itwin/core-backend";
import { assert, Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, Code, IModel } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { createFileNameFromString, setupOutputFileLocation } from "./PathUtils.js";

import type { IModelDb } from "@itwin/core-backend";
import type { Id64String } from "@itwin/core-bentley";
import type {
  CategoryProps,
  ElementProps,
  ExternalSourceAspectProps,
  ExternalSourceAttachmentProps,
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

export async function buildIModel(name: string, setup?: (imodel: IModelDb) => Promise<void>): Promise<{ imodelConnection: IModelConnection }>;
export async function buildIModel<TResult extends object>(
  name: string,
  setup: (imodel: IModelDb) => Promise<TResult>,
): Promise<{ imodelConnection: IModelConnection } & TResult>;
export async function buildIModel<TResult extends object | undefined>(name: string, setup?: (imodel: IModelDb) => Promise<TResult>) {
  let res!: TResult;
  const imodelPath = setupOutputFileLocation(`${createFileNameFromString(name)}.bim`);
  fs.rmSync(imodelPath, { force: true });
  const imodel = SnapshotDb.createEmpty(imodelPath, { rootSubject: { name } });
  try {
    if (setup) {
      res = await setup(imodel);
      imodel.saveChanges("Initial commit");
    }
    return { ...res, imodelConnection: new TestIModelConnection(imodel, imodelPath) };
  } catch (err) {
    imodel.close();
    throw err;
  }
}

class TestIModelConnection extends IModelConnection {
  constructor(
    private readonly _db: IModelDb,
    public readonly filePath: string,
  ) {
    super(_db.getConnectionProps());
    IModelConnection.onOpen.raiseEvent(this);
  }

  public override get isClosed(): boolean {
    return !this._db.isOpen;
  }

  public override async close(): Promise<void> {
    this._db.close();
    this.onClose.raiseEvent(this);
    IModelConnection.onClose.raiseEvent(this);
  }
}

export interface ImportSchemaResult {
  schemaName: string;
  schemaAlias: string;
  items: { [className: string]: { name: string; fullName: string; label: string } };
}
export async function importSchema({
  imodel,
  schemaContentXml,
  ...props
}: {
  imodel: IModelDb;
  schemaContentXml: string;
  schemaAlias: string;
  schemaName: string;
}): Promise<ImportSchemaResult> {
  const schemaName = props.schemaName;
  const schemaAlias = props.schemaAlias;
  const schemaXml = getFullSchemaXml({ schemaName, schemaAlias, schemaContentXml });

  await imodel.importSchemaStrings([schemaXml]);

  const parsedSchema = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (_, jpath) => {
      assert(typeof jpath === "string");
      return jpath.startsWith("ECSchema.");
    },
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

function createCode(props: { imodel: IModelDb; scopeId: Id64String; codeSpecName?: BisCodeSpec; codeValue: string }) {
  const codeSpec = props.imodel.codeSpecs.getByName(props.codeSpecName ?? BisCodeSpec.nullCodeSpec);
  return new Code({ spec: codeSpec.id, scope: props.scopeId, value: props.codeValue });
}

interface BaseInstanceInsertProps {
  imodel: IModelDb;
  fullClassNameSeparator?: ":" | ".";
}

export function insertDefinitionContainer(
  props: BaseInstanceInsertProps & { codeValue: string; modelId?: Id64String; isPrivate?: boolean } & Partial<
      Omit<ElementProps, "id" | "model" | "parent" | "code">
    >,
) {
  const { imodel, classFullName, modelId, codeValue, ...elementProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}DefinitionContainer`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model,
    code: createCode({ imodel, scopeId: model, codeValue }),
    ...elementProps,
  });
  return { className, id };
}

export function insertSubject(
  props: BaseInstanceInsertProps & { codeValue: string; parentId?: Id64String } & Partial<Omit<SubjectProps, "id" | "parent" | "code" | "model">>,
) {
  const { imodel, classFullName, codeValue, parentId, ...subjectProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}Subject`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: createCode({ imodel, scopeId: parentId ?? IModel.rootSubjectId, codeSpecName: BisCodeSpec.subject, codeValue }),
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
  const { imodel, classFullName, codeValue, parentId, ...partitionProps } = props;
  const partitionId = imodel.elements.insertElement({
    classFullName,
    model: IModel.repositoryModelId,
    code: createCode({ imodel, scopeId: parentId, codeSpecName: BisCodeSpec.informationPartitionElement, codeValue }),
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
  const { imodel, classFullName, modeledElementId, ...modelProps } = props;
  const modelId = imodel.models.insertModel({
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
  const { imodel, classFullName, modelId, codeValue, ...categoryProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}SpatialCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model,
    code: createCode({ imodel, scopeId: model, codeSpecName: BisCodeSpec.spatialCategory, codeValue }),
    ...categoryProps,
  });
  return { className, id };
}

export function insertDrawingCategory(
  props: BaseInstanceInsertProps & { codeValue: string; modelId?: Id64String } & Partial<Omit<CategoryProps, "id" | "model" | "parent" | "code">>,
) {
  const { imodel, classFullName, modelId, codeValue, ...categoryProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}DrawingCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model,
    code: createCode({ imodel, scopeId: model, codeSpecName: BisCodeSpec.drawingCategory, codeValue }),
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
  const { imodel, classFullName, modelId, codeValue, parentCategoryId, ...subCategoryProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}SubCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model,
    code: createCode({ imodel, scopeId: model, codeSpecName: BisCodeSpec.subCategory, codeValue }),
    parent: {
      id: parentCategoryId,
      relClassName: `BisCore${props.fullClassNameSeparator ?? "."}CategoryOwnsSubCategories`,
    },
    ...subCategoryProps,
  });
  return { className, id };
}

export function insertPhysicalElement<TAdditionalProps extends object>(
  props: BaseInstanceInsertProps & { modelId: Id64String; categoryId: Id64String; parentId?: Id64String } & Partial<
      Omit<PhysicalElementProps, "id" | "model" | "category" | "parent">
    > &
    TAdditionalProps,
) {
  const { imodel, classFullName, modelId, categoryId, parentId, ...elementProps } = props;
  const defaultClassName = `Generic${props.fullClassNameSeparator ?? "."}PhysicalObject`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
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

export function insertDrawingGraphic<TAdditionalProps extends object>(
  props: BaseInstanceInsertProps & { modelId: Id64String; categoryId: Id64String; parentId?: Id64String } & Partial<
      Omit<GeometricElement2dProps, "id" | "model" | "category" | "parent">
    > &
    TAdditionalProps,
) {
  const { imodel, classFullName, modelId, categoryId, parentId, ...elementProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}DrawingGraphic`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
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

export function insertDrawingElement<TAdditionalProps extends object>(
  props: BaseInstanceInsertProps & { modelId: Id64String; codeValue: string; parentId?: Id64String } & Partial<
      Omit<ElementProps, "id" | "model" | "parent" | "code">
    > &
    TAdditionalProps,
) {
  const { imodel, classFullName, codeValue, modelId, parentId, ...elementProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}Drawing`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? createCode({ imodel, scopeId: parentId ?? modelId, codeValue }) : Code.createEmpty(),
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

export function insertRepositoryLink(props: BaseInstanceInsertProps & { codeValue?: string } & Partial<Omit<RepositoryLinkProps, "id" | "model" | "code">>) {
  const { imodel, classFullName, codeValue, ...repoLinkProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}RepositoryLink`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: codeValue ? createCode({ imodel, scopeId: IModel.repositoryModelId, codeValue }) : Code.createEmpty(),
    ...repoLinkProps,
  } as RepositoryLinkProps);
  return { className, id };
}

export function insertExternalSourceAspect(
  props: BaseInstanceInsertProps & { elementId: Id64String; identifier?: string; sourceId?: Id64String } & Partial<
      Omit<ExternalSourceAspectProps, "id" | "classFullName" | "element" | "identifier" | "source">
    >,
) {
  const { imodel, elementId, identifier, sourceId, ...externalSourceAspectProps } = props;
  const className = `BisCore${props.fullClassNameSeparator ?? "."}ExternalSourceAspect`;
  const id = imodel.elements.insertAspect({
    classFullName: className,
    kind: "ExternalSource",
    element: {
      id: elementId,
    },
    source: sourceId
      ? {
          id: sourceId,
        }
      : undefined,
    identifier: identifier ?? "",
    ...externalSourceAspectProps,
  } as ExternalSourceAspectProps);

  return { className, id };
}

export function insertExternalSource(
  props: BaseInstanceInsertProps & { codeValue?: string; parentId?: Id64String; repositoryLinkId?: Id64String } & Partial<
      Omit<ExternalSourceProps, "id" | "repository" | "parent">
    >,
) {
  const { imodel, classFullName, codeValue, parentId, repositoryLinkId, ...externalSourceProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}ExternalSource`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: codeValue ? createCode({ imodel, scopeId: IModel.repositoryModelId, codeValue }) : Code.createEmpty(),
    parent: parentId
      ? {
          relClassName: "BisCore:ElementOwnsChildElements",
          id: parentId,
        }
      : undefined,
    repository: repositoryLinkId
      ? {
          id: repositoryLinkId,
        }
      : undefined,
    ...externalSourceProps,
  } as RepositoryLinkProps);
  return { className, id };
}

export function insertExternalSourceAttachment(
  props: BaseInstanceInsertProps & { codeValue?: string; parentExternalSourceId: Id64String; attachedExternalSourceId: Id64String } & Partial<
      Omit<ExternalSourceAttachmentProps, "id" | "parent" | "attaches">
    >,
) {
  const { imodel, classFullName, codeValue, parentExternalSourceId, attachedExternalSourceId, ...externalSourceAttachmentProps } = props;
  const defaultClassName = `BisCore${props.fullClassNameSeparator ?? "."}ExternalSourceAttachment`;
  const className = classFullName ?? defaultClassName;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: codeValue ? createCode({ imodel, scopeId: IModel.repositoryModelId, codeValue }) : Code.createEmpty(),
    parent: {
      relClassName: "BisCore:ExternalSourceOwnsAttachments",
      id: parentExternalSourceId,
    },
    attaches: {
      relClassName: "BisCore:ExternalSourceAttachmentAttachesSource",
      id: attachedExternalSourceId,
    },
    ...externalSourceAttachmentProps,
  } as RepositoryLinkProps);
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
  const { imodel, modelId, representedElementId, relationshipName, parentId, ...elementProps } = props;
  const className = `Functional${props.fullClassNameSeparator ?? "."}FunctionalComposite`;
  const id = imodel.elements.insertElement({
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
  imodel.relationships.insertInstance({
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
  const { imodel, codeValue, modelId, parentId, ...elementProps } = props;
  const className = `Generic${props.fullClassNameSeparator ?? "."}Group`;
  const id = imodel.elements.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? createCode({ imodel, scopeId: parentId ?? modelId, codeValue }) : Code.createEmpty(),
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
