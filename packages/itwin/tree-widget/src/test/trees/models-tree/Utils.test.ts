/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import { IModel } from "@itwin/core-common";
import { StandardNodeTypes } from "@itwin/presentation-common";
import {
  buildTestIModel,
  HierarchyCacheMode,
  initialize as initializePresentationTesting,
  terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { waitFor } from "@testing-library/react";
import { addModelsTreeNodeItemIcons, createRuleset, createSearchRuleset, queryModelsForHeaderActions } from "../../../components/trees/models-tree/Utils";
import { insertPhysicalModelWithPartition, insertPhysicalSubModel } from "../../IModelUtils";

import type { RepositoryLinkProps } from "@itwin/core-common";
import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";
import type { Node } from "@itwin/presentation-common";

describe("createRuleset", () => {
  it("creates default ruleset", () => {
    expect(createRuleset({})).to.matchSnapshot();
  });

  it("creates ruleset with specific element class", () => {
    expect(createRuleset({ elementClassSpecification: { className: "SpatialElement", schemaName: "BisCore" } })).to.matchSnapshot();
  });

  it("creates ruleset with grouped elements", () => {
    expect(createRuleset({ enableElementsClassGrouping: true })).to.matchSnapshot();
  });

  it("creates ruleset with shown empty models", () => {
    expect(createRuleset({ showEmptyModels: true })).to.matchSnapshot();
  });
});

describe("createSearchRuleset", () => {
  it("creates default ruleset", () => {
    expect(createSearchRuleset({})).to.matchSnapshot();
  });

  it("creates ruleset with specific element class", () => {
    expect(createSearchRuleset({ elementClassSpecification: { className: "SpatialElement", schemaName: "BisCore" } })).to.matchSnapshot();
  });

  it("creates ruleset with shown empty models", () => {
    expect(createSearchRuleset({ showEmptyModels: true })).to.matchSnapshot();
  });
});

describe("addModelsTreeNodeItemIcons", () => {
  it("sets icon from extended data", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    const node: Partial<Node> = {
      extendedData: {
        icon: "test-icon",
      },
    };
    addModelsTreeNodeItemIcons(item, node);
    expect(item.icon).to.be.eq("test-icon");
  });

  it("sets icon from extended data for grouping nodes", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    const node: Partial<Node> = {
      key: {
        type: StandardNodeTypes.ECClassGroupingNode,
        className: "TestClass",
        groupedInstancesCount: 5,
        pathFromRoot: [],
        version: 2,
      },
      extendedData: {
        icon: "test-icon",
        groupIcon: "test-group-icon",
      },
    };
    addModelsTreeNodeItemIcons(item, node);
    expect(item.icon).to.be.eq("test-group-icon");
  });
});

describe("queryModelsForHeaderActions", () => {
  beforeEach(async () => {
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
    });
  });

  afterEach(async () => {
    await terminatePresentationTesting();
  });

  it("return zero available models when modeledElement is not GeometricElement3d or InformationPartitionElement", async () => {
    // eslint-disable-next-line deprecation/deprecation
    const iModel = await buildTestIModel("test", async (builder) => {
      const repoLinkId = builder.insertElement({
        model: IModel.repositoryModelId,
        classFullName: "BisCore:RepositoryLink",
        url: "url",
        userLabel: "furl",
      } as RepositoryLinkProps);

      insertPhysicalSubModel({ builder, modeledElementId: repoLinkId });
    });

    const availableModels = await queryModelsForHeaderActions(iModel);
    await waitFor(() => expect(availableModels.length).to.be.equal(0));
  });

  it("returns available model when modeled element is GeometricElement3d or InformationPartitionElement", async () => {
    // eslint-disable-next-line deprecation/deprecation
    const iModel = await buildTestIModel("test", async (builder) => {
      insertPhysicalModelWithPartition({ builder, codeValue: "partition" });
    });
    const availableModels = await queryModelsForHeaderActions(iModel);
    await waitFor(() => expect(availableModels.length).to.be.equal(1));
  });
});
