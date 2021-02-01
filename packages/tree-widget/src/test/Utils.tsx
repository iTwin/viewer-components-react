/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/



import * as React from "react";
import { TreeWidget } from "../TreeWidget";
import { I18N } from "@bentley/imodeljs-i18n";
import * as moq from "typemoq";
import {
  UiFramework, ToolSettingsManager, SyncUiEventDispatcher,
  ContentControl, ConfigurableCreateInfo,
  FrameworkReducer,
} from "@bentley/ui-framework";
import { UiComponents, TreeNodeItem } from "@bentley/ui-components";
import { UiCore } from "@bentley/ui-core";
import { Id64 } from "@bentley/bentleyjs-core";
import { createStore, combineReducers, Store, AnyAction } from "redux";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECInstancesNodeKey, InstanceKey, StandardNodeTypes } from "@bentley/presentation-common";
import ruleList from "./assets/RulesList.json";
import faker from "faker";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { PropertyRecord } from "@bentley/ui-abstract";
import { getPropertyRecordAsString } from "@bentley/ui-components/lib/ui-components/common/getPropertyRecordAsString";

function createAppStore(): Store {
  const rootReducer = combineReducers({
    FrameworkReducer,
  } as any);

  return createStore(rootReducer,
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());
}

export class TestContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <div />;
  }
}

// tslint:disable-next-line:variable-name

export class TestUtils {
  private static _i18n?: I18N;
  private static _uiFrameworkInitialized = false;
  public static store: Store<any, AnyAction>;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      // const port = process.debugPort;
      TestUtils._i18n = new I18N();
    }
    return TestUtils._i18n;
  }

  public static async initializeUiFramework(imodel?: IModelConnection, testAlternateKey = false) {
    if (!TestUtils._uiFrameworkInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires
      this.store = createAppStore();

      if (testAlternateKey)
        await UiFramework.initialize(this.store, TestUtils.i18n, "testDifferentFrameworkKey");
      else
        await UiFramework.initialize(this.store, TestUtils.i18n);
      await UiComponents.initialize(TestUtils.i18n);
      await UiCore.initialize(TestUtils.i18n);
      await TreeWidget.initialize(TestUtils.i18n);
      // Set the iModelConnection in the Redux store
      if (imodel)
        UiFramework.setIModelConnection(imodel);
      // this.store.dispatch(BuildingUIComponentsActions.setRuleSet(ruleSet));
      TestUtils._uiFrameworkInitialized = true;
    }
    ToolSettingsManager.clearToolSettingsData();
    SyncUiEventDispatcher.setTimeoutPeriod(0); // disables non-immediate event processing.
  }

  public static terminateUiFramework() {
    UiCore.terminate();
    UiComponents.terminate();
    UiFramework.terminate();
    TreeWidget.terminate();
    TestUtils._uiFrameworkInitialized = false;
  }


  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }

}

/** mocks a tree with ruleset controller */
export class TreeWithRuleSetController {
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
  };
};

// /** mocks a functional Instance key */
export const createRandomECInstanceKey = (className: string = "RulesEngine:RuleElement"): InstanceKey => {
  return {
    className,
    id: Id64.fromLocalAndBriefcaseIds(faker.random.number(), faker.random.number()),
  };
};

// /** mocks a random but functional Node */
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
  //const getNodeKey = testParentChildPair ? (node: any) => (node as any)[PRESENTATION_TREE_NODE_KEY] : (node: any) => node.key;
  const getNodes = testParentChildPair ?
    async (parentNode?: TreeNodeItem) => {
      if (parentNode && getPropertyRecordAsString(parentNode.label) === "Parent") {
        const children = [];
        for (let i = 0; i < numberOfChildren; i++) {
          const key = createRandomECInstancesNodeKey([parentNode.id]);
          children.push({ label: PropertyRecord.fromString("Child" + i), key, id: key.pathFromRoot.join("/"), hasChildren: false });
        }
        return children;
      }
      const rootKey = createRandomECInstancesNodeKey([], "RuleEngine:Tag");
      const roodNode = { label: PropertyRecord.fromString("Parent"), key: rootKey, id: rootKey.pathFromRoot.join("/"), hasChildren: true, autoExpand: true };
      return [roodNode];
    } : async (p: any) => p ? [] : rootNodes!();

  const getNodesCount = testParentChildPair ? async (p: any) => p ? 1 : numberOfChildren : async (p: any) => (p ? 0 : rootNodes().length);

  const providerMock: IPresentationTreeDataProvider = {
    imodel: imodel,
    rulesetId,
    getNodesCount,
    getNodes,
    getNodeKey,
    getFilteredNodePaths: async () => [],
    loadHierarchy: async () => { },
    dispose: () => { },
  };

  return providerMock;
};

/** @internal */
export const PRESENTATION_TREE_NODE_KEY = "__presentation-components/key";


