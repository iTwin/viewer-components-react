/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import * as React from "react";
import { TreeWidget } from "../TreeWidget";
import { I18N } from "@bentley/imodeljs-i18n";
// import { RuleEditorControllerBase, RuleParameterDetails } from "../Controllers/RuleEditorControllerBase";
import * as moq from "typemoq";
import {
  UiFramework, ToolSettingsManager, SyncUiEventDispatcher,
  ConfigurableUiManager, ContentControl, ConfigurableCreateInfo,
  ContentLayoutProps,
  ContentGroupProps,
  FrameworkReducer,
} from "@bentley/ui-framework";
import { UiComponents, TreeNodeItem } from "@bentley/ui-components";
import { UiCore } from "@bentley/ui-core";
import { Id64 } from "@bentley/bentleyjs-core";
// import { BuildingUIComponentsReducer, BuildingUIComponentsActions } from "../Views/redux/buildingUIComponents-redux";
import { createStore, combineReducers, Store, AnyAction } from "redux";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset, ECInstancesNodeKey, InstanceKey, StandardNodeTypes, Node } from "@bentley/presentation-common";
import ruleList from "./assets/RulesList.json";
// import { TreeWithRulesetControllerBase } from "../Controllers/TreeWithRulesetControllerBase";
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
      TestUtils.defineContentGroups();
      TestUtils.defineContentLayouts();
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

  /** Define Content Layouts referenced by Frontstages.
   */
  public static defineContentLayouts() {
    const contentLayouts: ContentLayoutProps[] = TestUtils.getContentLayouts();
    ConfigurableUiManager.loadContentLayouts(contentLayouts);
  }

  private static getContentLayouts(): ContentLayoutProps[] {
    const fourQuadrants: ContentLayoutProps = {
      id: "FourQuadrants",
      descriptionKey: "SampleApp:ContentLayoutDef.FourQuadrants",
      priority: 1000,
      horizontalSplit: {
        id: "FourQuadrants.MainHorizontal",
        percentage: 0.50,
        top: { verticalSplit: { id: "FourQuadrants.TopVert", percentage: 0.50, left: 0, right: 1 } },
        bottom: { verticalSplit: { id: "FourQuadrants.BottomVert", percentage: 0.50, left: 2, right: 3 } },
      },
    };

    const singleContent: ContentLayoutProps = {
      id: "SingleContent",
      descriptionKey: "SampleApp:ContentLayoutDef.SingleContent",
      priority: 100,
    };

    const contentLayouts: ContentLayoutProps[] = [];
    // in order to pick out by number of views for convenience.
    contentLayouts.push(singleContent, fourQuadrants);
    return contentLayouts;
  }

  /** Define Content Groups referenced by Frontstages.
   */
  private static defineContentGroups() {

    const testContentGroup1: ContentGroupProps = {
      id: "TestContentGroup1",
      contents: [
        {
          classId: TestContentControl,
          applicationData: { label: "Content 1a", bgColor: "black" },
        },
        {
          classId: TestContentControl,
          applicationData: { label: "Content 2a", bgColor: "black" },
        },
        {
          classId: TestContentControl,
          applicationData: { label: "Content 3a", bgColor: "black" },
        },
        {
          classId: TestContentControl,
          applicationData: { label: "Content 4a", bgColor: "black" },
        },
      ],
    };

    const contentGroups: ContentGroupProps[] = [];
    contentGroups.push(testContentGroup1);
    ConfigurableUiManager.loadContentGroups(contentGroups);
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }

  /** Sleeps a specified number of milliseconds */
  public static sleep(milliseconds: number) {
    const start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds) {
        break;
      }
    }
  }

  /** Sleeps a specified number of milliseconds then flushes async operations */
  public static async tick(milliseconds: number) {
    TestUtils.sleep(milliseconds);
    await TestUtils.flushAsyncOperations();
  }

  public static createBubbledEvent(type: string, props = {}) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  }

}

export const storageMock = () => {
  const storage: { [key: string]: any } = {};
  return {
    setItem: (key: string, value: string) => {
      storage[key] = value || "";
    },
    getItem: (key: string) => {
      return key in storage ? storage[key] : null;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (i: number) => {
      const keys = Object.keys(storage);
      return keys[i] || null;
    },
  };
};

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

/** create node items in the same level and with the same parent. */
export const createTreeNodeItems = (nodes: ReadonlyArray<Readonly<Node>>, parentId?: string): any[] => {
  const list = new Array<any>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node, parentId));
  return list;
};

/** Node to TreeNodeItem */
export const createTreeNodeItem = (node: Readonly<Node>, parentId?: string): any => {
  const item: any = {
    id: [...node.key.pathFromRoot].reverse().join("/"),
    label: PropertyRecord.fromString(node.label.displayValue),
  };
  (item as any)[PRESENTATION_TREE_NODE_KEY] = node.key;
  if (parentId)
    item.parentId = parentId;
  if (node.description)
    item.description = node.description;
  if (node.hasChildren)
    item.hasChildren = true;
  item.autoExpand = true;
  if (node.imageId)
    item.icon = node.imageId;
  if (node.isCheckboxVisible) {
    item.isCheckboxVisible = true;
    if (!node.isCheckboxEnabled)
      item.isCheckboxDisabled = true;
  }
  if (node.extendedData)
    item.extendedData = node.extendedData;
  return item;
};

// export class MockRuleTreeController extends RuleTreeControllerBase {
//   private _nodes?: any[];
//   private _testParentChildPair?: boolean;
//   private _customRuleResults?: boolean[];
//   private _numOfChildren?: number;
//   constructor(nodes?: any[], testParentChildPair?: boolean, customRuleResults?: boolean[], numOfChildren?: number) {
//     super();
//     this._nodes = nodes;
//     this._testParentChildPair = testParentChildPair;
//     this._customRuleResults = customRuleResults;
//     this._numOfChildren = numOfChildren;
//   }

//   public createDataProvider(imodel: IModelConnection) {
//     return setupDataProvider(imodel, this._nodes, this._testParentChildPair, this._numOfChildren)!;
//   }

//   public editRules() { }

//   public executeRules(rules: string[]) {
//     const results: any = [];
//     if (this._customRuleResults && this._customRuleResults.length === rules.length) {
//       for (let i = 0; i < this._customRuleResults.length; i++)
//         results.push({ result: this._customRuleResults[i], ruleId: rules[i] });
//       return results;
//     }
//     rules.forEach((rule) => {
//       results.push({ result: true, ruleId: rule });
//     });
//     return results;
//   }

//   public async selectRelatedElementsForMultipleNodes() { }
//   public async selectRelatedElementsForSingleNode() { }
// }
/** Helper function to parse hex to rbg for mathing colors in tests. */
export function hexToRgb(hex: string) {
  hex = hex.slice(1); // remove #
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return r + ", " + g + ", " + b;
}
