/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Provider } from "react-redux";
import { mount, shallow } from "enzyme";
import { IModelApp, IModelConnection, NoRenderApp, SelectionSet } from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import Rules from "../assets/SpatialBreakdown.json";
import { setupDataProvider, TestUtils, TreeWithRuleSetController } from "./Utils";
import * as moq from "typemoq";
import { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import { IModelHierarchyChangeEventArgs, Presentation, PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import { assert } from "chai";
import { PropertyValueRendererManager, TreeActions, TreeModel, TreeModelNode } from "@itwin/components-react";
import sinon from "sinon";
import { TreeNodeFunctionIconInfoMapper } from "../Views/FunctionalityProviders/TreeNodeFunctionIconMapper";
import { ControlledTreeWrapper } from "../Views/TreeWithRuleset";
import { TreeNodeWrapper } from "../Views/NodeRenderers/FunctionalTreeNodeRenderer";
import { ClassificationsTree } from "../Views/ClassificationsTree";
import { ComponentIndex } from "../Views/ComponentIndex";
import { SpatialContainmentTree } from "../Views/SpatialContainmentTree";

describe("TreeComponent tests.", () => {

  const connection = moq.Mock.ofType<IModelConnection>();
  const controller = moq.Mock.ofType<TreeWithRuleSetController>();
  const shutdownIModelApp = async () => {
    Presentation.terminate();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  };
  before(async () => {
    await shutdownIModelApp();
    await NoRenderApp.startup();
    try {
      await Presentation.initialize();
    } catch (error) {
    }

    const selectionSet = moq.Mock.ofType<SelectionSet>();
    selectionSet.setup((x) => x.elements).returns(() => new Set([]));
    connection.setup((x) => x.selectionSet).returns(() => selectionSet.object);
    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.localization.registerNamespace("BreakdownTrees");
    controller.setup((x) => x.createDataProvider()).returns(() => setupDataProvider(connection.object));

    onHierarchyUpdateEvent = new BeEvent();
    presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => onHierarchyUpdateEvent);
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
    Presentation.setPresentationManager(presentationManagerMock.object);
  });


  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const registeredRuleSetMock = moq.Mock.ofType<RegisteredRuleset>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();

  let onHierarchyUpdateEvent: BeEvent<(args: IModelHierarchyChangeEventArgs) => void>;
  beforeEach(async () => {
    rulesetVariablesManagerMock.reset();
    rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => new BeEvent());
  });

  after(() => {
    (global as any).sessionStorage = undefined;
    TestUtils.terminateUiFramework();
    try {
      Presentation.terminate();
    } catch (error) { }
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
          dataProvider={dataProvider}
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
    assert(mountedWrapper.exists("SearchBar"), "should contain the SearchBar component");
    assert(mountedWrapper.exists("SearchBox"), "should contain the SearchBox component");
    assert(mountedWrapper.exists("ControlledTree"), "should contain the ControlledTree component");
  });

  it("TreeNodeWrapper renders correctly", () => {
    const node = moq.Mock.ofType<TreeModelNode>();
    const treeModel = moq.Mock.ofType<TreeModel>();
    const treeAction = moq.Mock.ofType<TreeActions>();
    const dataProvider = setupDataProvider(connection.object);
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const reactNode = moq.Mock.ofType<React.ReactNode>();
    const propertyValueRenderStub = sinon.stub(PropertyValueRendererManager.defaultManager, "render").returns(reactNode.object);

    const wrapper = (
      <TreeNodeWrapper node={node.object} treeActions={treeAction.object} itemsMapper={functionIconMapper} visibilityHandler={undefined} treeModel={treeModel.object}
        selectedTreenodeCount={0} />
    );
    mount(wrapper).should.matchSnapshot();
    reactNode.reset();
    propertyValueRenderStub.restore();
  });
  it("ClassificationsTree renders correctly with children", () => {
    rulesetManagerMock.setup((x) => x.add(moq.It.isAny())).returns(async () => registeredRuleSetMock.object);
    const wrapper = (
      <ClassificationsTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }} />
    );
    mount(wrapper).should.matchSnapshot();
  });

  it("ComponentIndex renders correctly with children", () => {
    const wrapper = (
      <ComponentIndex iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }} />
    );
    mount(wrapper).should.matchSnapshot();
  });
  it("SpatialContainmentTree renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={false} groupByDiscipline={false} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    mount(wrapper).should.matchSnapshot();
  });

  it("SpatialContainmentTree by Type renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={true} groupByDiscipline={false} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    mount(wrapper).should.matchSnapshot(true);
  });

  it("SpatialContainmentTree by Discipline renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={false} groupByDiscipline={true} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    mount(wrapper).should.matchSnapshot();
  });

  it("SpatialContainmentTree by Type and Discipline renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={true} groupByDiscipline={true} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    mount(wrapper).should.matchSnapshot();
  });

});
