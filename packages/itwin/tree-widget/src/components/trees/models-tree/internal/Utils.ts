/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";

import type { ModelInfo } from "../ModelsTreeComponent";

import type { ChildNodeSpecification, Node, Ruleset, SingleSchemaClassSpecification } from "@itwin/presentation-common";
import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";
import type { ModelsTreeHierarchyConfiguration } from "../ModelsTree";

/** @internal */
export type CreateRulesetProps = Omit<ModelsTreeHierarchyConfiguration, "enableElementsClassGrouping"> & {
  enableElementsClassGrouping?: boolean;
};

/** @internal */
export function createRuleset(props: CreateRulesetProps): Ruleset {
  const context: SpecificationsContext = {
    elementClassSpecification: props.elementClassSpecification ?? { schemaName: "BisCore", className: "GeometricElement3d" },
    groupElements: !!props.enableElementsClassGrouping,
    showEmptyModels: !!props.showEmptyModels,
  };

  return {
    id: "tree-widget-react/ModelsTree",
    requiredSchemas: [
      {
        name: "BisCore",
      },
    ],
    rules: [
      {
        ruleType: "RootNodes",
        autoExpand: true,
        specifications: [createRootSubjectSpecification()],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
              icon: '"icon-imodel-hollow-2"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [createRelatedHierarchySubjectSpecification(), createRelatedNonHierarchySubjectSpecification()],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
              icon: '"icon-folder"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [createNonContentModelsSpecification(context), createContentModelsSpecification(context)],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
              icon: '"icon-model"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("ISubModeledElement", "BisCore")`,
        specifications: [createElementModelSpecification(context)],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
              icon: '"icon-model"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("GeometricModel3d", "BisCore")`,
        specifications: [createModelCategoriesSpecification(context)],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isCategory: "true",
              modelId: "ParentNode.InstanceId",
              icon: '"icon-layers"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("SpatialCategory", "BisCore")`,
        specifications: [createCategoryElementsSpecification(context)],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              modelId: "this.Model.Id",
              categoryId: "this.Category.Id",
              icon: '"icon-item"',
              groupIcon: '"icon-ec-class"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("GeometricElement3d", "BisCore")`,
        specifications: [createEementElementsSpecification(context)],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              modelId: "this.Model.Id",
              categoryId: "this.Category.Id",
              icon: '"icon-item"',
              groupIcon: '"icon-ec-class"',
            },
          },
        ],
      },
      {
        ruleType: "Grouping",
        class: {
          schemaName: "BisCore",
          className: "Subject",
        },
        groups: [
          {
            specType: "SameLabelInstance",
            applicationStage: "PostProcess",
          },
        ],
      },
      {
        ruleType: "Grouping",
        class: {
          schemaName: "BisCore",
          className: "SpatialCategory",
        },
        groups: [
          {
            specType: "SameLabelInstance",
            applicationStage: "PostProcess",
          },
        ],
      },
    ],
  };
}

/** @internal */
export type CreateSearchRulesetProps = Omit<ModelsTreeHierarchyConfiguration, "enableElementsClassGrouping">;

/** @internal */
export function createSearchRuleset(props: CreateSearchRulesetProps): Ruleset {
  const context: SpecificationsContext = {
    elementClassSpecification: props.elementClassSpecification ?? { schemaName: "BisCore", className: "GeometricElement3d" },
    groupElements: false,
    showEmptyModels: !!props.showEmptyModels,
  };

  return {
    id: "tree-widget-react/ModelsTreeSearch",
    rules: [
      {
        ruleType: "RootNodes",
        specifications: [createRootSubjectSpecification()],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
              icon: '"icon-imodel-hollow-2"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          createRelatedHierarchySubjectSpecification(),
          {
            ...createRelatedNonHierarchySubjectSpecification(),
            hideExpression: `NOT ThisNode.HasChildren ANDALSO NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.isContentModel)`,
            hideIfNoChildren: undefined,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
              icon: '"icon-folder"',
            },
          },
          {
            ruleType: "Grouping",
            class: {
              schemaName: "BisCore",
              className: "Subject",
            },
            groups: [
              {
                specType: "SameLabelInstance",
                applicationStage: "PostProcess",
              },
            ],
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          {
            ...createNonContentModelsSpecification(context),
            hasChildren: "Unknown",
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
              icon: '"icon-model"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          {
            ...createContentModelsSpecification(context),
            hasChildren: "Unknown",
          },
        ],
        customizationRules: [
          {
            ruleType: "NodeArtifacts",
            items: {
              isContentModel: "true",
            },
          },
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
              icon: '"icon-model"',
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("GeometricModel3d", "BisCore")`,
        specifications: [createModelSubModelsSpecification(context)],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
              icon: '"icon-model"',
            },
          },
        ],
      },
    ],
  };
}

interface SpecificationsContext {
  elementClassSpecification: SingleSchemaClassSpecification;
  groupElements: boolean;
  showEmptyModels: boolean;
}

function createRootSubjectSpecification(): ChildNodeSpecification {
  return {
    specType: "InstanceNodesOfSpecificClasses",
    classes: [
      {
        schemaName: "BisCore",
        classNames: ["Subject"],
      },
    ],
    instanceFilter: `this.Parent = NULL`,
    groupByClass: false,
    groupByLabel: false,
  };
}

function createRelatedHierarchySubjectSpecification(): ChildNodeSpecification {
  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      {
        relationship: {
          schemaName: "BisCore",
          className: "SubjectOwnsSubjects",
        },
        direction: "Forward",
        targetClass: {
          schemaName: "BisCore",
          className: "Subject",
        },
      },
    ],
    instanceFilter: `json_extract(this.JsonProperties, "$.Subject.Job.Bridge") <> NULL OR ifnull(json_extract(this.JsonProperties, "$.Subject.Model.Type"), "") = "Hierarchy"`,
    hideNodesInHierarchy: true,
    groupByClass: false,
    groupByLabel: false,
  };
}

function createRelatedNonHierarchySubjectSpecification(): ChildNodeSpecification {
  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      {
        relationship: {
          schemaName: "BisCore",
          className: "SubjectOwnsSubjects",
        },
        direction: "Forward",
        targetClass: {
          schemaName: "BisCore",
          className: "Subject",
        },
      },
    ],
    instanceFilter: `json_extract(this.JsonProperties, "$.Subject.Job.Bridge") = NULL AND ifnull(json_extract(this.JsonProperties, "$.Subject.Model.Type"), "") <> "Hierarchy"`,
    hideIfNoChildren: true,
    groupByClass: false,
    groupByLabel: false,
  };
}

function createNonContentModelsSpecification({ elementClassSpecification, showEmptyModels }: SpecificationsContext): ChildNodeSpecification {
  const partitionFilter = `parent.ECInstanceId = partition.Parent.Id OR json_extract(parent.JsonProperties, "$.Subject.Model.TargetPartition") = printf("0x%x", partition.ECInstanceId)`;
  const modelHasElements = `this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`;

  const hasNoContent = `json_extract(partition.JsonProperties, "$.PhysicalPartition.Model.Content") = NULL AND json_extract(partition.JsonProperties, "$.GraphicalPartition3d.Model.Content") = NULL`;
  const instanceFilter = `(${partitionFilter}) AND NOT this.IsPrivate AND ${hasNoContent}${showEmptyModels ? "" : ` AND ${modelHasElements}`}`;

  return {
    specType: "InstanceNodesOfSpecificClasses",
    classes: {
      schemaName: "BisCore",
      classNames: ["GeometricModel3d"],
      arePolymorphic: true,
    },
    relatedInstances: [
      {
        relationshipPath: {
          relationship: {
            schemaName: "BisCore",
            className: "ModelModelsElement",
          },
          direction: "Forward",
          targetClass: {
            schemaName: "BisCore",
            className: "InformationPartitionElement",
          },
        },
        alias: "partition",
        isRequired: true,
      },
    ],
    instanceFilter,
    hasChildren: showEmptyModels ? "Unknown" : "Always",
    groupByClass: false,
    groupByLabel: false,
  };
}

function createContentModelsSpecification({ elementClassSpecification, showEmptyModels }: SpecificationsContext): ChildNodeSpecification {
  const partitionFilter = `parent.ECInstanceId = partition.Parent.Id OR json_extract(parent.JsonProperties, "$.Subject.Model.TargetPartition") = printf("0x%x", partition.ECInstanceId)`;
  const modelHasElements = `this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`;

  const hasContent = `json_extract(partition.JsonProperties, "$.PhysicalPartition.Model.Content") <> NULL OR json_extract(partition.JsonProperties, "$.GraphicalPartition3d.Model.Content") <> NULL`;
  const instanceFilter = `(${partitionFilter}) AND NOT this.IsPrivate AND (${hasContent})${showEmptyModels ? "" : ` AND ${modelHasElements}`}`;

  return {
    specType: "InstanceNodesOfSpecificClasses",
    classes: {
      schemaName: "BisCore",
      classNames: ["GeometricModel3d"],
      arePolymorphic: true,
    },
    relatedInstances: [
      {
        relationshipPath: {
          relationship: {
            schemaName: "BisCore",
            className: "ModelModelsElement",
          },
          direction: "Forward",
          targetClass: {
            schemaName: "BisCore",
            className: "InformationPartitionElement",
          },
        },
        alias: "partition",
        isRequired: true,
      },
    ],
    instanceFilter,
    hasChildren: showEmptyModels ? "Unknown" : "Always",
    hideNodesInHierarchy: true,
    groupByClass: false,
    groupByLabel: false,
  };
}

function createElementModelSpecification({ elementClassSpecification, showEmptyModels }: SpecificationsContext): ChildNodeSpecification {
  const hasElements = `this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`;
  const instanceFilter = `NOT this.IsPrivate${showEmptyModels ? "" : ` AND ${hasElements}`}`;

  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      {
        relationship: {
          schemaName: "BisCore",
          className: "ModelModelsElement",
        },
        direction: "Backward",
      },
    ],
    instanceFilter,
    hideNodesInHierarchy: true,
    groupByClass: false,
    groupByLabel: false,
  };
}

function createModelCategoriesSpecification({ elementClassSpecification }: SpecificationsContext): ChildNodeSpecification {
  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      [
        {
          relationship: {
            schemaName: "BisCore",
            className: "ModelContainsElements",
          },
          direction: "Forward",
          targetClass: elementClassSpecification,
        },
        {
          relationship: {
            schemaName: "BisCore",
            className: "GeometricElement3dIsInCategory",
          },
          direction: "Forward",
        },
      ],
    ],
    instanceFilter: `NOT this.IsPrivate`,
    suppressSimilarAncestorsCheck: true,
    hideIfNoChildren: true,
    groupByClass: false,
    groupByLabel: false,
  };
}

function createCategoryElementsSpecification({ elementClassSpecification, groupElements }: SpecificationsContext): ChildNodeSpecification {
  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      {
        relationship: {
          schemaName: "BisCore",
          className: "GeometricElement3dIsInCategory",
        },
        direction: "Backward",
        targetClass: elementClassSpecification,
      },
    ],
    instanceFilter: `this.Model.Id = parent.parent.ECInstanceId ANDALSO this.Parent = NULL`,
    groupByClass: groupElements,
    groupByLabel: false,
  };
}

function createEementElementsSpecification({ elementClassSpecification, groupElements }: SpecificationsContext): ChildNodeSpecification {
  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      {
        relationship: {
          schemaName: "BisCore",
          className: "ElementOwnsChildElements",
        },
        direction: "Forward",
        targetClass: elementClassSpecification,
      },
    ],
    groupByClass: groupElements,
    groupByLabel: false,
  };
}

function createModelSubModelsSpecification({ elementClassSpecification, showEmptyModels }: SpecificationsContext): ChildNodeSpecification {
  const hasElements = `this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`;
  const instanceFilter = `NOT this.IsPrivate${showEmptyModels ? "" : ` AND ${hasElements}`}`;

  return {
    specType: "RelatedInstanceNodes",
    relationshipPaths: [
      {
        relationship: {
          schemaName: "BisCore",
          className: "ModelOwnsSubModel",
        },
        direction: "Forward",
        targetClass: {
          schemaName: "BisCore",
          className: "GeometricModel3d",
        },
      },
    ],
    instanceFilter,
    groupByClass: false,
    groupByLabel: false,
  };
}

/** @internal */
export function addModelsTreeNodeItemIcons(item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) {
  item.icon = node.key && NodeKey.isClassGroupingNodeKey(node.key) ? node.extendedData?.groupIcon : node.extendedData?.icon;
}

/** @internal */
export async function queryModelsForHeaderActions(iModel: IModelConnection) {
  const queryParams: ModelQueryParams = {
    from: "BisCore.GeometricModel3d",
    where: `
        EXISTS (
          SELECT 1
          FROM BisCore.Element e
          WHERE e.ECClassId IS (BisCore.GeometricElement3d, BisCore.InformationPartitionElement)
            AND e.ECInstanceId = GeometricModel3d.ModeledElement.Id
        )
      `,
    wantPrivate: false,
  };

  const modelProps = await iModel.models.queryProps(queryParams);
  return modelProps.map(({ id, isPlanProjection }: GeometricModel3dProps) => ({ id, isPlanProjection })).filter(({ id }) => id) as ModelInfo[];
}
