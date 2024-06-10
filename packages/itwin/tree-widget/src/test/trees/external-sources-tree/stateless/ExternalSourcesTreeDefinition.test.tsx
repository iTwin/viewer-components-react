/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createHierarchyProvider } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { ExternalSourcesTreeDefinition } from "../../../../components/trees/stateless/external-sources-tree/ExternalSourcesTreeDefinition";
import {
  buildIModel,
  insertExternalSource,
  insertExternalSourceAspect,
  insertExternalSourceAttachment,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertRepositoryLink,
  insertSpatialCategory,
} from "../../../IModelUtils";
import { createIModelAccess } from "../../Common";
import { NodeValidators, validateHierarchy } from "../../HierarchyValidation";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TestIModelBuilder } from "@itwin/presentation-testing";

describe("ExternalSources Tree", () => {
  describe.skip("Hierarchy definition", () => {
    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        testOutputDir: join(__dirname, "output"),
        backendHostProps: {
          cacheDir: join(__dirname, "cache"),
        },
        rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("creates auto-expanded root nodes", async function () {
      // eslint-disable-next-line deprecation/deprecation
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const { externalSource: rootExternalSource } = insertRootExternalSource({
          builder,
          repositoryLinkProps: { codeValue: "Test repo link" },
          externalSourceProps: { codeValue: "Test external source" },
        });
        return { rootExternalSource };
      });
      await validateHierarchy({
        provider: createExternalSourcesTreeProvider(imodel),
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            label: `Test repo link - Test external source`,
            autoExpand: true,
            supportsFiltering: true,
            children: false,
          }),
        ],
      });
    });

    it("creates external sources as external source group node children", async function () {
      // eslint-disable-next-line deprecation/deprecation
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const { externalSource: rootExternalSource, repositoryLink: rootRepositoryLink } = insertRootExternalSource({
          builder,
          externalSourceProps: { codeValue: "Root external source" },
        });
        const externalSourceGroup = insertExternalSource({ builder, classFullName: `BisCore.ExternalSourceGroup`, codeValue: "External source group" });
        const externalSourceAttachment = insertExternalSourceAttachment({
          builder,
          parentExternalSourceId: rootExternalSource.id,
          attachedExternalSourceId: externalSourceGroup.id,
        });
        const childExternalSource = insertExternalSource({ builder, codeValue: "Child external source" });
        groupExternalSources(builder, externalSourceGroup.id, [childExternalSource.id]);
        return { rootExternalSource, rootRepositoryLink, externalSourceGroup, externalSourceAttachment, childExternalSource };
      });
      await validateHierarchy({
        provider: createExternalSourcesTreeProvider(imodel),
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            label: `Repository Link ${createECInstanceIdSuffix(keys.rootRepositoryLink.id)} - Root external source`,
            autoExpand: true,
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.externalSourceGroup],
                label: `External source group`,
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.childExternalSource],
                    label: `Child external source`,
                    supportsFiltering: true,
                    children: false,
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    it("creates attached external sources as external source node children", async function () {
      // eslint-disable-next-line deprecation/deprecation
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const { externalSource: rootExternalSource } = insertRootExternalSource({ builder });
        const childExternalSource = insertExternalSource({ builder, codeValue: "Child external source" });
        const attachment = insertExternalSourceAttachment({
          builder,
          parentExternalSourceId: rootExternalSource.id,
          attachedExternalSourceId: childExternalSource.id,
        });
        return { rootExternalSource, childExternalSource, attachment };
      });
      await validateHierarchy({
        provider: createExternalSourcesTreeProvider(imodel),
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            autoExpand: true,
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.childExternalSource],
                autoExpand: false,
                supportsFiltering: true,
                children: false,
              }),
            ],
          }),
        ],
      });
    });

    it("creates elements as external source node children", async function () {
      // eslint-disable-next-line deprecation/deprecation
      const { imodel, ...keys } = await buildIModel(this, async (builder) => {
        const { externalSource: rootExternalSource } = insertRootExternalSource({ builder });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Model" });
        const category = insertSpatialCategory({ builder, codeValue: "Category" });
        const element1 = insertPhysicalElement({
          builder,
          userLabel: "Element 1",
          modelId: physicalModel.id,
          categoryId: category.id,
        });
        insertExternalSourceAspect({ builder, elementId: element1.id, sourceId: rootExternalSource.id });
        const element2 = insertPhysicalElement({
          builder,
          userLabel: "Element 2",
          modelId: physicalModel.id,
          categoryId: category.id,
        });
        insertExternalSourceAspect({ builder, elementId: element2.id, sourceId: rootExternalSource.id });
        return { rootExternalSource, physicalModel, category, element1, element2 };
      });
      await validateHierarchy({
        provider: createExternalSourcesTreeProvider(imodel),
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            autoExpand: true,
            supportsFiltering: true,
            children: [
              NodeValidators.createForCustomNode({
                label: "Elements",
                children: [
                  NodeValidators.createForClassGroupingNode({
                    className: keys.element1.className,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element1],
                        autoExpand: false,
                        supportsFiltering: true,
                        children: false,
                      }),
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element2],
                        autoExpand: false,
                        supportsFiltering: true,
                        children: false,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });
  });
});

function createExternalSourcesTreeProvider(imodel: IModelConnection) {
  const imodelAccess = createIModelAccess(imodel);
  return createHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ExternalSourcesTreeDefinition({ imodelAccess }),
  });
}

function insertRootExternalSource({
  builder,
  repositoryLinkProps,
  externalSourceProps,
}: {
  builder: TestIModelBuilder;
  repositoryLinkProps?: Omit<Parameters<typeof insertRepositoryLink>[0], "builder">;
  externalSourceProps?: Omit<Parameters<typeof insertExternalSource>[0], "builder" | "repositoryLinkId">;
}) {
  const synchronizationConfigLinkId = builder.insertElement({
    classFullName: "BisCore:SynchronizationConfigLink",
    model: IModel.repositoryModelId,
    code: builder.createCode(IModel.repositoryModelId, BisCodeSpec.linkElement, `Root configuration link`),
  });
  const repositoryLink = insertRepositoryLink({ builder, ...repositoryLinkProps });
  const externalSource = insertExternalSource({ builder, repositoryLinkId: repositoryLink.id, ...externalSourceProps });
  builder.insertRelationship({
    classFullName: "BisCore:SynchronizationConfigSpecifiesRootSources",
    sourceId: synchronizationConfigLinkId,
    targetId: externalSource.id,
  });
  return {
    synchronizationConfigLink: { className: `BisCore.SynchronizationConfigLink`, id: synchronizationConfigLinkId },
    repositoryLink,
    externalSource,
  };
}

function groupExternalSources(builder: TestIModelBuilder, groupId: Id64String, groupedExternalSourceIds: Id64String[]) {
  groupedExternalSourceIds.forEach((groupedExternalSourceId) => {
    builder.insertRelationship({
      classFullName: "BisCore:ExternalSourceGroupGroupsSources",
      sourceId: groupId,
      targetId: groupedExternalSourceId,
    });
  });
}

function createECInstanceIdSuffix(id: Id64String) {
  const briefcaseId = Id64.getBriefcaseId(id);
  const localId = Id64.getLocalId(id);
  return `[${briefcaseId.toString(36).toLocaleUpperCase()}-${localId.toString(36).toLocaleUpperCase()}]`;
}
