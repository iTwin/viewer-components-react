/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import { Ruleset } from "@itwin/presentation-common";
import { ModelsTreeHierarchyConfiguration } from "./ModelsTree";

/** @internal */
export class CachingElementIdsContainer {
  private _ids = new Array<Id64String>();
  constructor(private _generator: AsyncGenerator<Id64String>) {
  }

  private async next() { return (await this._generator.next()).value; }

  public async* getElementIds() {
    for (const id of this._ids) {
      yield id;
    }

    let nextId;
    while (nextId = await this.next()) {
      this._ids.push(nextId);
      yield nextId;
    }
  }
}

/** @internal */
export type CreateRulesetProps = Omit<ModelsTreeHierarchyConfiguration, "enableElementsClassGrouping"> & {
  enableElementsClassGrouping?: boolean;
};

/** @internal */
export function createRuleset(props: CreateRulesetProps): Ruleset {
  const elementClassSpecification = props.elementClassSpecification ?? { schemaName: "BisCore", className: "GeometricElement3d" };
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
        specifications: [
          {
            specType: "InstanceNodesOfSpecificClasses",
            classes: [
              {
                schemaName: "BisCore",
                classNames: [
                  "Subject",
                ],
              },
            ],
            instanceFilter: `this.Parent = NULL`,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          {
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
          },
          {
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
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          {
            specType: "InstanceNodesOfSpecificClasses",
            classes: {
              schemaName: "BisCore",
              classNames: [
                "GeometricModel3d",
              ],
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
            instanceFilter: `(parent.ECInstanceId = partition.Parent.Id OR json_extract(parent.JsonProperties, "$.Subject.Model.TargetPartition") = printf("0x%x", partition.ECInstanceId)) AND NOT this.IsPrivate AND json_extract(partition.JsonProperties, "$.PhysicalPartition.Model.Content") = NULL AND json_extract(partition.JsonProperties, "$.GraphicalPartition3d.Model.Content") = NULL AND this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`,
            hasChildren: "Always",
            hideIfNoChildren: true,
            groupByClass: false,
            groupByLabel: false,
          },
          {
            specType: "InstanceNodesOfSpecificClasses",
            classes: {
              schemaName: "BisCore",
              classNames: [
                "GeometricModel3d",
              ],
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
            instanceFilter: `(parent.ECInstanceId = partition.Parent.Id OR json_extract(parent.JsonProperties, "$.Subject.Model.TargetPartition") = printf("0x%x", partition.ECInstanceId)) AND NOT this.IsPrivate AND (json_extract(partition.JsonProperties, "$.PhysicalPartition.Model.Content") <> NULL OR json_extract(partition.JsonProperties, "$.GraphicalPartition3d.Model.Content") <> NULL) AND this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`,
            hasChildren: "Always",
            hideNodesInHierarchy: true,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("ISubModeledElement", "BisCore")`,
        specifications: [
          {
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
            instanceFilter: `NOT this.IsPrivate AND this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`,
            hideNodesInHierarchy: true,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("GeometricModel3d", "BisCore")`,
        specifications: [
          {
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
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isCategory: "true",
              modelId: "ParentNode.InstanceId",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("SpatialCategory", "BisCore")`,
        specifications: [
          {
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
            groupByClass: !!props.enableElementsClassGrouping,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              modelId: "this.Model.Id",
              categoryId: "this.Category.Id",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("GeometricElement3d", "BisCore")`,
        specifications: [
          {
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
            groupByClass: !!props.enableElementsClassGrouping,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              modelId: "this.Model.Id",
              categoryId: "this.Category.Id",
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
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsInstanceNode ANDALSO ThisNode.IsOfClass("Subject", "BisCore")`,
        imageIdExpression: `IIF(this.Parent.Id = NULL, "icon-imodel-hollow-2", "icon-folder")`,
      },
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsInstanceNode ANDALSO ThisNode.IsOfClass("Model", "BisCore")`,
        imageIdExpression: `"icon-model"`,
      },
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsInstanceNode ANDALSO ThisNode.IsOfClass("Category", "BisCore")`,
        imageIdExpression: `"icon-layers"`,
      },
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsInstanceNode ANDALSO ThisNode.IsOfClass("Element", "BisCore")`,
        imageIdExpression: `"icon-item"`,
      },
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsClassGroupingNode`,
        imageIdExpression: `"icon-ec-class"`,
      },
      {
        ruleType: "Content",
        condition: `ContentDisplayType = "AssemblyElementsRequest"`,
        specifications: [
          {
            specType: "SelectedNodeInstances",
          },
          {
            specType: "ContentRelatedInstances",
            relationshipPaths: [
              {
                relationship: {
                  schemaName: "BisCore",
                  className: "ElementOwnsChildElements",
                },
                direction: "Forward",
                count: "*",
              },
            ],
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
  const elementClassSpecification = props.elementClassSpecification ?? { schemaName: "BisCore", className: "GeometricElement3d" };
  return {
    id: "tree-widget-react/ModelsTreeSearch",
    rules: [
      {
        ruleType: "RootNodes",
        specifications: [
          {
            specType: "InstanceNodesOfSpecificClasses",
            classes: [
              {
                schemaName: "BisCore",
                classNames: [
                  "Subject",
                ],
              },
            ],
            instanceFilter: "this.Parent = NULL",
            arePolymorphic: false,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          {
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
          },
          {
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
            hideExpression: `NOT ThisNode.HasChildren ANDALSO NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.isContentModel)`,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isSubject: "true",
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
            specType: "InstanceNodesOfSpecificClasses",
            classes: {
              schemaName: "BisCore",
              classNames: [
                "GeometricModel3d",
              ],
            },
            arePolymorphic: true,
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
            instanceFilter: `(parent.ECInstanceId = partition.Parent.Id OR json_extract(parent.JsonProperties, "$.Subject.Model.TargetPartition") = printf("0x%x", partition.ECInstanceId)) AND NOT this.IsPrivate AND json_extract(partition.JsonProperties, "$.PhysicalPartition.Model.Content") = NULL AND json_extract(partition.JsonProperties, "$.GraphicalPartition3d.Model.Content") = NULL AND this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
        specifications: [
          {
            specType: "InstanceNodesOfSpecificClasses",
            classes: {
              schemaName: "BisCore",
              classNames: [
                "GeometricModel3d",
              ],
            },
            arePolymorphic: true,
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
            instanceFilter: `(parent.ECInstanceId = partition.Parent.Id OR json_extract(parent.JsonProperties, "$.Subject.Model.TargetPartition") = printf("0x%x", partition.ECInstanceId)) AND NOT this.IsPrivate AND (json_extract(partition.JsonProperties, "$.PhysicalPartition.Model.Content") <> NULL OR json_extract(partition.JsonProperties, "$.GraphicalPartition3d.Model.Content") <> NULL) AND this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`,
            hideNodesInHierarchy: true,
            groupByClass: false,
            groupByLabel: false,
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
            },
          },
        ],
      },
      {
        ruleType: "ChildNodes",
        condition: `ParentNode.IsOfClass("GeometricModel3d", "BisCore")`,
        specifications: [
          {
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
            instanceFilter: `NOT this.IsPrivate AND this.HasRelatedInstance("BisCore:ModelContainsElements", "Forward", "${elementClassSpecification.schemaName}:${elementClassSpecification.className}")`,
            groupByClass: false,
            groupByLabel: false,
          },
        ],
        customizationRules: [
          {
            ruleType: "ExtendedData",
            items: {
              isModel: "true",
            },
          },
        ],
      },
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsOfClass("Subject", "BisCore")`,
        imageIdExpression: `IIF(this.Parent.Id = NULL, "icon-imodel-hollow-2", "icon-folder")`,
      },
      {
        ruleType: "ImageIdOverride",
        condition: `ThisNode.IsOfClass("Model", "BisCore")`,
        imageIdExpression: `"icon-model"`,
      },
    ],
  };
}
