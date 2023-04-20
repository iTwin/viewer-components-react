/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as moq from "typemoq";
import type { ConfigurableCreateInfo } from "@itwin/appui-react";
import { ContentControl, FrameworkReducer, SyncUiEventDispatcher, UiFramework } from "@itwin/appui-react";
import type { TreeNodeItem } from "@itwin/components-react";
import { Id64 } from "@itwin/core-bentley";
import type { AnyAction, Store } from "redux";
import { combineReducers } from "redux";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { ECInstancesNodeKey, InstanceKey, Ruleset } from "@itwin/presentation-common";
import { StandardNodeTypes } from "@itwin/presentation-common";
import ruleList from "./assets/RulesList.json";
import faker from "faker";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BreakdownTrees } from "../breakdown-trees-react";
import { TreeWithRulesetControllerBase } from "../Controllers/TreeWithRulesetControllerBase";
import type { Localization } from "@itwin/core-common";
import { configureStore } from "@reduxjs/toolkit";

function createAppStore(): Store {
  const rootReducer = combineReducers({
    FrameworkReducer,
  } as any);

  return configureStore({
    reducer: rootReducer,
    enhancers: (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__(),
  });
}

export class TestContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <div />;
  }
}

export class TestUtils {
  private static _uiFrameworkInitialized = false;
  public static store: Store<any, AnyAction>;

  public static get localization(): Localization {
    return IModelApp.localization;
  }

  public static async initializeUiFramework(imodel?: IModelConnection, _ruleSet: Ruleset = ruleList as Ruleset) {
    if (!TestUtils._uiFrameworkInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires
      this.store = createAppStore();
      await UiFramework.initialize(this.store);
      await BreakdownTrees.initialize(TestUtils.localization);
      // Set the iModelConnection in the Redux store
      if (imodel)
        UiFramework.setIModelConnection(imodel);
      TestUtils._uiFrameworkInitialized = true;
    }
    SyncUiEventDispatcher.setTimeoutPeriod(0); // disables non-immediate event processing.
  }

  public static terminateUiFramework() {
    UiFramework.terminate();
    BreakdownTrees.terminate();
    TestUtils._uiFrameworkInitialized = false;
  }
  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }
}

// /** mocks a tree with ruleset controller */
export class TreeWithRuleSetController extends TreeWithRulesetControllerBase {
  public createDataProvider() {
    return setupDataProvider(moq.Mock.ofType<IModelConnection>().object);
  }
}

/** mocks a functional node key */
export const createRandomECInstancesNodeKey = (pathFromRoot?: string[], className?: string, instanceKeys?: InstanceKey[]): ECInstancesNodeKey => {
  if (!instanceKeys)
    instanceKeys = [createRandomECInstanceKey(className)];
  return {
    type: StandardNodeTypes.ECInstancesNode,
    pathFromRoot: pathFromRoot || [faker.random.uuid(), faker.random.uuid()],
    instanceKeys,
    version: 1,
  };
};

/** mocks a functional Instance key */
export const createRandomECInstanceKey = (className: string = "RulesEngine:RuleElement"): InstanceKey => {
  return {
    className,
    id: Id64.fromLocalAndBriefcaseIds(faker.random.number(), faker.random.number()),
  };
};

/** mocks a random but functional Node */
export const createRandomECInstanceNode = (label?: string, key?: ECInstancesNodeKey, hasChildren?: boolean) => {
  if (!key)
    key = createRandomECInstancesNodeKey();
  return {
    key,
    id: key.pathFromRoot.join("/"),
    label: PropertyRecord.fromString(label || faker.random.words()),
    description: faker.lorem.sentence(),
    hasChildren: hasChildren || faker.random.boolean(),
    isSelectionDisabled: false,
    isEditable: false,
    isChecked: faker.random.boolean(),
    isExpanded: true,
    isCheckboxVisible: faker.random.boolean(),
    isCheckboxEnabled: faker.random.boolean(),
    autoExpand: true,
  };
};

/** mocks a data provider. */
export const setupDataProvider = (imodel: IModelConnection, nodes = [createRandomECInstanceNode()], testParentChildPair: boolean = false, numberOfChildren: number = 1) => {
  const rulesetId = ruleList.id;
  const rootNodes = () => nodes;
  const getNodeKey = (node: any) => node.key;
  // const getNodeKey = testParentChildPair ? (node: any) => (node as any)[PRESENTATION_TREE_NODE_KEY] : (node: any) => node.key;
  const getNodes = testParentChildPair ?
    async (parentNode?: TreeNodeItem) => {
      if (parentNode && parentNode.label.description === "Parent") {
        const children = [];
        for (let i = 0; i < numberOfChildren; i++) {
          const key = createRandomECInstancesNodeKey([parentNode.id]);
          children.push({ label: PropertyRecord.fromString(`Child${i}`), key, id: key.pathFromRoot.join("/"), hasChildren: false });
        }
        return children;
      }
      const rootKey = createRandomECInstancesNodeKey([], "RuleEngine:Tag");
      const roodNode = { label: PropertyRecord.fromString("Parent"), key: rootKey, id: rootKey.pathFromRoot.join("/"), hasChildren: true, autoExpand: true };
      return [roodNode];
    } : async (p: any) => p ? [] : rootNodes();

  const getNodesCount = testParentChildPair ? async (p: any) => p ? 1 : numberOfChildren : async (p: any) => (p ? 0 : rootNodes().length);

  const providerMock: IPresentationTreeDataProvider = {
    imodel,
    rulesetId,
    getNodesCount,
    getNodes,
    getNodeKey,
    getFilteredNodePaths: async () => [],
    dispose: () => { },
  };

  return providerMock;
};
