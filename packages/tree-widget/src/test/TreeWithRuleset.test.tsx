/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import * as React from "react";
import { Provider } from "react-redux";
import { mount, shallow } from "enzyme";
import { IModelApp, NoRenderApp, IModelConnection, SelectionSet } from "@bentley/imodeljs-frontend";
import { BeEvent } from "@bentley/bentleyjs-core";
import { ControlledTreeWrapper } from "../components/trees/TreeWithRuleset";
import Rules from "../components/rulesets/SpatialBreakdown.json";
import { TestUtils, TreeWithRuleSetController, setupDataProvider } from "./Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import { Ruleset, HierarchyUpdateInfo } from "@bentley/presentation-common";
import { PresentationManager, RulesetManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { TreeNodeFunctionIconInfoMapper } from "../components/trees/FunctionalityProviders";
import { assert } from "chai";
// import { TreeNodeWrapper } from "../components/trees/NodeRenderers/FunctionalTreeNodeRenderer";
// import { PropertyValueRendererManager, TreeActions, TreeModel, TreeModelNode } from "@bentley/ui-components";
// import sinon from "sinon";

describe("TreeWithRuleset Component tests.", () => {

  const connection = moq.Mock.ofType<IModelConnection>();
  const controller = moq.Mock.ofType<TreeWithRuleSetController>();
  const shutdownIModelApp = () => {
    if (IModelApp.initialized)
      IModelApp.shutdown();
  };
  before(async () => {
    // This is required by our I18n module (specifically the i18next package).
    // (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires
    shutdownIModelApp();
    NoRenderApp.startup();
    Presentation.terminate();
    Presentation.initialize();

    const selectionSet = moq.Mock.ofType<SelectionSet>();
    selectionSet.setup((x) => x.elements).returns(() => new Set([]));
    connection.setup((x) => x.selectionSet).returns(() => selectionSet.object);
    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.i18n.registerNamespace("TreeWidget");
    controller.setup((x) => x.createDataProvider()).returns(() => setupDataProvider(connection.object));

    function mockStorage() {
      var storage: any = {};
      return {
        setItem: function (key: any, value: any) {
          storage[key] = value || '';
        },
        getItem: function (key: any) {
          return storage[key];
        },
        removeItem: function (key: any) {
          delete storage[key];
        },
        get length() {
          return Object.keys(storage).length;
        },
        key: function (i: any) {
          var keys = Object.keys(storage);
          return keys[i] || null;
        }
      };
    }
    (global as any).sessionStorage = mockStorage();
  });


  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();

  let onHierarchyUpdateEvent: BeEvent<(args: { ruleset: Ruleset, updateInfo: HierarchyUpdateInfo }) => void>;
  beforeEach(async () => {
    onHierarchyUpdateEvent = new BeEvent();
    rulesetVariablesManagerMock.reset();
    presentationManagerMock.reset();
    presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => onHierarchyUpdateEvent);
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
    rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => new BeEvent());
    Presentation.setPresentationManager(presentationManagerMock.object);
    await Presentation.initialize();
  });

  afterEach(() => {
    Presentation.terminate();
  });

  after(() => {
    (global as any).sessionStorage = undefined;
    TestUtils.terminateUiFramework();
    Presentation.terminate();
    shutdownIModelApp();
  });



  it("TreeWithRuleset renders correctly", () => {
    const dataProvider = setupDataProvider(connection.object);
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const wrapper = (
      <Provider store={TestUtils.store}>
        <ControlledTreeWrapper
          dataProvider={dataProvider}
          setIsDisplayGuids={(_display: boolean) => { }}
          iModel={connection.object}
          displayGuids={true}
          loadedRuleset={Rules as Ruleset} treeNodeIconMapper={functionIconMapper}
          treeName="TreeWithRulesetTest" optionItems={[]} searchTools={true} enableVisibility={false}
        />
      </Provider>
    );
    shallow(wrapper).should.matchSnapshot();
  });

  it("TreeWithRuleset renders correctly with visibility", () => {
    const dataProvider = setupDataProvider(connection.object);
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const wrapper = (
      <Provider store={TestUtils.store}>
        <ControlledTreeWrapper
          dataProvider={dataProvider}
          setIsDisplayGuids={(_display: boolean) => { }}
          iModel={connection.object}
          displayGuids={true}
          loadedRuleset={Rules as Ruleset} treeNodeIconMapper={functionIconMapper}
          treeName="TreeWithRulesetTest" optionItems={[]} searchTools={true} enableVisibility={true}
        />
      </Provider>
    );
    shallow(wrapper).should.matchSnapshot();
  });

  it("TreeWithRuleset renders correctly with children", () => {
    const dataProvider = setupDataProvider(connection.object);
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const wrapper = (
      <Provider store={TestUtils.store}>
        <ControlledTreeWrapper
          dataProvider={setupDataProvider(connection.object)}
          setIsDisplayGuids={(_display: boolean) => { }}
          iModel={connection.object}
          displayGuids={true}
          loadedRuleset={Rules as Ruleset} treeNodeIconMapper={functionIconMapper}
          treeName="TreeWithRulesetTest" optionItems={[]} searchTools={true}
          enableVisibility={false}
        />
      </Provider>
    );
    const mountedWrapper = mount(
      wrapper,
    );
    assert(mountedWrapper.exists(".custom-tree-content"), "should contain the custom-tree-content div");
    assert(mountedWrapper.exists(".custom-tree-toolbar"), "should contain the custom-tree-toolbar div");
    assert(mountedWrapper.exists(".custom-tree-container"), "should contain the custom-tree-container div");
    assert(mountedWrapper.exists(".custom-tree-toolbar"), "should contain the custom-tree-toolbar div");
    assert(mountedWrapper.exists("SearchBar"), "should contain the SearchBar component");
    assert(mountedWrapper.exists("SearchBox"), "should contain the SearchBox component");
    assert(mountedWrapper.exists("ControlledTree"), "should contain the ControlledTree component");
  });

});
