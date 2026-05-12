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
import { withEditTxn } from "@itwin/core-backend";
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

import type { EditTxn } from "@itwin/core-backend";
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
      await using buildIModelResult = await buildIModel(this, async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const { externalSource: rootExternalSource } = insertRootExternalSource({
            txn,
            repositoryLinkProps: { codeValue: "Test repo link" },
            externalSourceProps: { codeValue: "Test external source" },
          });
          return { rootExternalSource };
        }),
      );
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
      await using buildIModelResult = await buildIModel(this, async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const { externalSource: rootExternalSource, repositoryLink: rootRepositoryLink } = insertRootExternalSource({
            txn,
            externalSourceProps: { codeValue: "Root external source" },
          });
          const externalSourceGroup = insertExternalSource({ txn, classFullName: `BisCore.ExternalSourceGroup`, codeValue: "External source group" });
          const externalSourceAttachment = insertExternalSourceAttachment({
            txn,
            parentExternalSourceId: rootExternalSource.id,
            attachedExternalSourceId: externalSourceGroup.id,
          });
          const childExternalSource = insertExternalSource({ txn, codeValue: "Child external source" });
          groupExternalSources(txn, externalSourceGroup.id, [childExternalSource.id]);
          return { rootExternalSource, rootRepositoryLink, externalSourceGroup, externalSourceAttachment, childExternalSource };
        }),
      );
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
      await using buildIModelResult = await buildIModel(this, async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const { externalSource: rootExternalSource } = insertRootExternalSource({ txn });
          const childExternalSource = insertExternalSource({ txn, codeValue: "Child external source" });
          const attachment = insertExternalSourceAttachment({
            txn,
            parentExternalSourceId: rootExternalSource.id,
            attachedExternalSourceId: childExternalSource.id,
          });
          return { rootExternalSource, childExternalSource, attachment };
        }),
      );
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
      await using buildIModelResult = await buildIModel(this, async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const { externalSource: rootExternalSource } = insertRootExternalSource({ txn });
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Model" });
          const category = insertSpatialCategory({ txn, codeValue: "Category" });
          const element1 = insertPhysicalElement({
            txn,
            userLabel: "Element 1",
            modelId: physicalModel.id,
            categoryId: category.id,
          });
          insertExternalSourceAspect({ txn, elementId: element1.id, sourceId: rootExternalSource.id });
          const element2 = insertPhysicalElement({
            txn,
            userLabel: "Element 2",
            modelId: physicalModel.id,
            categoryId: category.id,
          });
          insertExternalSourceAspect({ txn, elementId: element2.id, sourceId: rootExternalSource.id });
          return { rootExternalSource, physicalModel, category, element1, element2 };
        }),
      );
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
  txn,
  repositoryLinkProps,
  externalSourceProps,
}: {
  txn: EditTxn;
  repositoryLinkProps?: Omit<Parameters<typeof insertRepositoryLink>[0], "txn">;
  externalSourceProps?: Omit<Parameters<typeof insertExternalSource>[0], "txn" | "repositoryLinkId">;
}) {
  const imodel = txn.iModel;
  const codeSpec = imodel.codeSpecs.getByName(BisCodeSpec.linkElement);
  const synchronizationConfigLinkId = txn.insertElement({
    classFullName: "BisCore:SynchronizationConfigLink",
    model: IModel.repositoryModelId,
    code: new Code({ spec: codeSpec.id, scope: IModel.repositoryModelId, value: `Root configuration link` }),
  });
  const repositoryLink = insertRepositoryLink({ txn, ...repositoryLinkProps });
  const externalSource = insertExternalSource({ txn, repositoryLinkId: repositoryLink.id, ...externalSourceProps });
  txn.insertRelationship({
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

function groupExternalSources(txn: EditTxn, groupId: Id64String, groupedExternalSourceIds: Id64String[]) {
  groupedExternalSourceIds.forEach((groupedExternalSourceId) => {
    txn.insertRelationship({
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
