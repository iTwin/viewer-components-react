/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  HierarchyCacheMode,
  initializeCore,
  insertExternalSource,
  insertExternalSourceAspect,
  insertExternalSourceAttachment,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertRepositoryLink,
  insertSpatialCategory,
  terminateCore,
} from "test-utilities";
import { Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, Code, IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ExternalSourcesTreeDefinition } from "../../../tree-widget-react/components/trees/external-sources-tree/ExternalSourcesTreeDefinition.js";
import { buildIModel } from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { IModelDb } from "@itwin/core-backend";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";

describe("External sources tree", () => {
  describe("Hierarchy definition", () => {
    before(async function () {
      await initializeCore({
        backendProps: {
          caching: {
            hierarchies: {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminateCore();
    });

    it("creates auto-expanded root nodes", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const { externalSource: rootExternalSource } = insertRootExternalSource({
          imodel,
          repositoryLinkProps: { codeValue: "Test repo link" },
          externalSourceProps: { codeValue: "Test external source" },
        });
        return { rootExternalSource };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createExternalSourcesTreeProvider(imodelConnection);
      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            label: `Test repo link - Test external source`,
            autoExpand: true,
            supportsFiltering: false,
            children: false,
          }),
        ],
      });
    });

    it("creates external sources as external source group node children", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const { externalSource: rootExternalSource, repositoryLink: rootRepositoryLink } = insertRootExternalSource({
          imodel,
          externalSourceProps: { codeValue: "Root external source" },
        });
        const externalSourceGroup = insertExternalSource({ imodel, classFullName: `BisCore.ExternalSourceGroup`, codeValue: "External source group" });
        const externalSourceAttachment = insertExternalSourceAttachment({
          imodel,
          parentExternalSourceId: rootExternalSource.id,
          attachedExternalSourceId: externalSourceGroup.id,
        });
        const childExternalSource = insertExternalSource({ imodel, codeValue: "Child external source" });
        groupExternalSources(imodel, externalSourceGroup.id, [childExternalSource.id]);
        return { rootExternalSource, rootRepositoryLink, externalSourceGroup, externalSourceAttachment, childExternalSource };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createExternalSourcesTreeProvider(imodelConnection);
      await validateHierarchy({
        provider,
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
                    supportsFiltering: false,
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
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const { externalSource: rootExternalSource } = insertRootExternalSource({ imodel });
        const childExternalSource = insertExternalSource({ imodel, codeValue: "Child external source" });
        const attachment = insertExternalSourceAttachment({
          imodel,
          parentExternalSourceId: rootExternalSource.id,
          attachedExternalSourceId: childExternalSource.id,
        });
        return { rootExternalSource, childExternalSource, attachment };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createExternalSourcesTreeProvider(imodelConnection);
      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            autoExpand: true,
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.childExternalSource],
                autoExpand: false,
                supportsFiltering: false,
                children: false,
              }),
            ],
          }),
        ],
      });
    });

    it("creates elements as external source node children", async function () {
      await using buildIModelResult = await buildIModel(this, async (imodel) => {
        const { externalSource: rootExternalSource } = insertRootExternalSource({ imodel });
        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Model" });
        const category = insertSpatialCategory({ imodel, codeValue: "Category" });
        const element1 = insertPhysicalElement({
          imodel,
          userLabel: "Element 1",
          modelId: physicalModel.id,
          categoryId: category.id,
        });
        insertExternalSourceAspect({ imodel, elementId: element1.id, sourceId: rootExternalSource.id });
        const element2 = insertPhysicalElement({
          imodel,
          userLabel: "Element 2",
          modelId: physicalModel.id,
          categoryId: category.id,
        });
        insertExternalSourceAspect({ imodel, elementId: element2.id, sourceId: rootExternalSource.id });
        return { rootExternalSource, physicalModel, category, element1, element2 };
      });
      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createExternalSourcesTreeProvider(imodelConnection);
      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootExternalSource],
            autoExpand: true,
            supportsFiltering: false,
            children: [
              NodeValidators.createForGenericNode({
                label: "Elements",
                supportsFiltering: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    className: keys.element1.className,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element1],
                        autoExpand: false,
                        supportsFiltering: false,
                        children: false,
                      }),
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.element2],
                        autoExpand: false,
                        supportsFiltering: false,
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
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ExternalSourcesTreeDefinition({ imodelAccess }),
  });
}

function insertRootExternalSource({
  imodel,
  repositoryLinkProps,
  externalSourceProps,
}: {
  imodel: IModelDb;
  repositoryLinkProps?: Omit<Parameters<typeof insertRepositoryLink>[0], "imodel">;
  externalSourceProps?: Omit<Parameters<typeof insertExternalSource>[0], "imodel" | "repositoryLinkId">;
}) {
  const codeSpec = imodel.codeSpecs.getByName(BisCodeSpec.linkElement);
  const synchronizationConfigLinkId = imodel.elements.insertElement({
    classFullName: "BisCore:SynchronizationConfigLink",
    model: IModel.repositoryModelId,
    code: new Code({ spec: codeSpec.id, scope: IModel.repositoryModelId, value: `Root configuration link` }),
  });
  const repositoryLink = insertRepositoryLink({ imodel, ...repositoryLinkProps });
  const externalSource = insertExternalSource({ imodel, repositoryLinkId: repositoryLink.id, ...externalSourceProps });
  imodel.relationships.insertInstance({
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

function groupExternalSources(imodel: IModelDb, groupId: Id64String, groupedExternalSourceIds: Id64String[]) {
  groupedExternalSourceIds.forEach((groupedExternalSourceId) => {
    imodel.relationships.insertInstance({
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
