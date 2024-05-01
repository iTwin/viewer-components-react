/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BisCodeSpec, Code, IModel } from "@itwin/core-common";

import type { Id64String } from "@itwin/core-bentley";
import type {
  CategoryProps,
  GeometricElement3dProps,
  InformationPartitionElementProps,
  ModelProps,
  PhysicalElementProps,
  RelatedElementProps,
  SubCategoryProps,
  SubjectProps,
} from "@itwin/core-common";
import type { TestIModelBuilder } from "@itwin/presentation-testing";

export function addSubject<TSubjectProps extends SubjectProps>(
  builder: TestIModelBuilder,
  name: string,
  parentId = IModel.rootSubjectId,
  subjectProps?: Partial<TSubjectProps>,
) {
  const parentProps: RelatedElementProps = {
    relClassName: "BisCore:SubjectOwnsSubjects",
    id: parentId,
  };
  return builder.insertElement({
    classFullName: "BisCore:Subject",
    model: IModel.repositoryModelId,
    parent: parentProps,
    code: builder.createCode(parentId, BisCodeSpec.subject, name),
    ...subjectProps,
  });
}

export function addPartition<TPartitionProps extends InformationPartitionElementProps>(
  builder: TestIModelBuilder,
  classFullName: string,
  name: string,
  parentId = IModel.rootSubjectId,
  partitionProps?: Partial<TPartitionProps>,
) {
  const parentProps: RelatedElementProps = {
    relClassName: "BisCore:SubjectOwnsPartitionElements",
    id: parentId,
  };
  return builder.insertElement({
    classFullName,
    model: IModel.repositoryModelId,
    parent: parentProps,
    code: builder.createCode(parentId, BisCodeSpec.informationPartitionElement, name),
    ...partitionProps,
  });
}

export function addModel<TModelProps extends ModelProps>(
  builder: TestIModelBuilder,
  classFullName: string,
  modeledElementId: string,
  modelProps?: Partial<TModelProps>,
) {
  return builder.insertModel({
    modeledElement: { relClassName: "BisCore:ModelModelsElement", id: modeledElementId },
    classFullName,
    ...modelProps,
  });
}

export function addSpatialCategory(builder: TestIModelBuilder, modelId: string, name: string, isPrivate?: boolean) {
  const spatialCategoryProps: CategoryProps = {
    classFullName: "BisCore:SpatialCategory",
    model: modelId,
    code: builder.createCode(modelId, BisCodeSpec.spatialCategory, name),
    isPrivate,
  };
  return builder.insertElement(spatialCategoryProps);
}

export function addPhysicalObject(builder: TestIModelBuilder, modelId: string, categoryId: string, elemCode = Code.createEmpty(), parentId?: Id64String) {
  const physicalObjectProps: PhysicalElementProps = {
    classFullName: "Generic:PhysicalObject",
    model: modelId,
    category: categoryId,
    parent: parentId ? { relClassName: "BisCore:PhysicalElementAssemblesElements", id: parentId } : undefined,
    code: elemCode,
  };
  return builder.insertElement(physicalObjectProps);
}

export function addSpatialLocationElement(builder: TestIModelBuilder, modelId: string, categoryId: string, elemCode = Code.createEmpty()) {
  const props: GeometricElement3dProps = {
    classFullName: "Generic:SpatialLocation",
    model: modelId,
    category: categoryId,
    code: elemCode,
  };
  return builder.insertElement(props);
}

export function addDrawingCategory(builder: TestIModelBuilder, modelId: string, name: string, isPrivate?: boolean) {
  const spatialCategoryProps: CategoryProps = {
    classFullName: "BisCore:DrawingCategory",
    model: modelId,
    code: builder.createCode(modelId, BisCodeSpec.drawingCategory, name),
    isPrivate,
  };
  return builder.insertElement(spatialCategoryProps);
}

export function addDrawingGraphic(builder: TestIModelBuilder, modelId: string, categoryId: string, elemCode = Code.createEmpty()) {
  const physicalObjectProps: PhysicalElementProps = {
    classFullName: "BisCore:DrawingGraphic",
    model: modelId,
    category: categoryId,
    code: elemCode,
  };
  return builder.insertElement(physicalObjectProps);
}

export function addDocument(builder: TestIModelBuilder, modelId: string, elemCode = Code.createEmpty()) {
  return builder.insertElement({
    classFullName: "BisCore:Drawing",
    model: modelId,
    code: elemCode,
  });
}

export function addGroup(builder: TestIModelBuilder, modelId: string, elemCode = Code.createEmpty(), parentId?: Id64String) {
  return builder.insertElement({
    classFullName: "Generic:Group",
    model: modelId,
    code: elemCode,
    parent: parentId ? { relClassName: "BisCore:ElementOwnsChildElements", id: parentId } : undefined,
  });
}

export function addSubCategory(builder: TestIModelBuilder, modelId: string, parentId: string, name: string, isPrivate?: boolean) {
  const subCategoryProps: SubCategoryProps = {
    classFullName: "BisCore:SubCategory",
    parent: { id: parentId, relClassName: "BisCore:CategoryOwnsSubCategories" },
    model: modelId,
    code: builder.createCode(parentId, BisCodeSpec.subCategory, name),
    isPrivate,
  };
  return builder.insertElement(subCategoryProps);
}
