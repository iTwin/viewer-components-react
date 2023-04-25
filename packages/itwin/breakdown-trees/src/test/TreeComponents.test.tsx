/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Provider } from "react-redux";
import { mount, shallow } from "enzyme";
import type { IModelConnection, ScreenViewport, SelectionSet, ViewState } from "@itwin/core-frontend";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import Rules from "../assets/SpatialBreakdown.json";
import type { TreeWithRuleSetController } from "./Utils";
import { setupDataProvider, TestUtils } from "./Utils";
import * as moq from "typemoq";
import type { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import type { IModelHierarchyChangeEventArgs, PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import type { HighlightableTreeNodeProps, TreeActions, TreeModel, TreeModelNode } from "@itwin/components-react";
import { PropertyValueRendererManager } from "@itwin/components-react";
import sinon from "sinon";
import { TreeNodeFunctionIconInfoMapper } from "../Views/FunctionalityProviders/TreeNodeFunctionIconMapper";
import { ControlledTreeWrapper } from "../Views/TreeWithRuleset";
import { TreeNodeWrapper } from "../Views/NodeRenderers/FunctionalTreeNodeRenderer";
import { ClassificationsTree } from "../Views/ClassificationsTree";
import { ComponentIndex } from "../Views/ComponentIndex";
import { SpatialContainmentTree } from "../Views/SpatialContainmentTree";
import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";

describe("TreeComponent tests.", () => {

  const connection = moq.Mock.ofType<IModelConnection>();
  const controller = moq.Mock.ofType<TreeWithRuleSetController>();
  before(async () => {
    await NoRenderApp.startup();
    try {
      await Presentation.initialize();
    } catch (error) {
    }

    const selectionSet = moq.Mock.ofType<SelectionSet>();
    selectionSet.setup((x) => x.elements).returns(() => new Set([]));
    connection.setup((x) => x.selectionSet).returns(() => selectionSet.object);
    await TestUtils.initializeUiFramework(connection.object);
    await IModelApp.localization.registerNamespace("BreakdownTrees");
    controller.setup((x) => x.createDataProvider()).returns(() => setupDataProvider(connection.object));

    onHierarchyUpdateEvent = new BeEvent();
    presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => onHierarchyUpdateEvent);
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
    Presentation.setPresentationManager(presentationManagerMock.object);

    const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
    const viewStateMock = moq.Mock.ofType<ViewState>();
    viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);
    selectedViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
    await IModelApp.viewManager.setSelectedView(selectedViewMock.object);
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

  after(async () => {
    (global as any).sessionStorage = undefined;
    TestUtils.terminateUiFramework();
    try {
      Presentation.terminate();
      await IModelApp.shutdown();
    } catch (error) { }
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

  it("TreeNodeWrapper renders correctly", () => {
    const node = moq.Mock.ofType<TreeModelNode>();
    const highlightProps: HighlightableTreeNodeProps = { searchText: "tree" };
    const propertyRecord = PropertyRecord.fromString("TreeNodeWrapper");
    node.setup((x) => x.depth).returns(() => 1);
    node.setup((x) => x.id).returns(() => "TreeNodeWrapper");
    node.setup((x) => x.label).returns(() => propertyRecord);
    const treeModel = moq.Mock.ofType<TreeModel>();
    const treeAction = moq.Mock.ofType<TreeActions>();
    const dataProvider = setupDataProvider(connection.object);
    const functionIconMapper = new TreeNodeFunctionIconInfoMapper(dataProvider);
    const reactNode = moq.Mock.ofType<React.ReactNode>();
    const propertyValueRenderStub = sinon.stub(PropertyValueRendererManager.defaultManager, "render").returns(reactNode.object);

    const wrapper = (
      <TreeNodeWrapper node={node.object} treeActions={treeAction.object} itemsMapper={functionIconMapper} visibilityHandler={undefined} treeModel={treeModel.object}
        selectedTreenodeCount={0} highlightingProps={highlightProps} />
    );
    mount(wrapper).should.matchSnapshot();
    reactNode.reset();
    propertyValueRenderStub.restore();
  });
  it("ClassificationsTree renders correctly with children", () => {
    rulesetManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registeredRuleSetMock.object);
    const wrapper = (
      <ClassificationsTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }} />
    );
    expect(wrapper).matchSnapshot();
  });

  it("ComponentIndex renders correctly with children", () => {
    const wrapper = (
      <ComponentIndex iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }} />
    );
    expect(wrapper).matchSnapshot();
  });
  it("SpatialContainmentTree renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={false} groupByDiscipline={false} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    expect(wrapper).matchSnapshot();
  });

  it("SpatialContainmentTree by Type renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={true} groupByDiscipline={false} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    expect(wrapper).matchSnapshot();
  });

  it("SpatialContainmentTree by Discipline renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={false} groupByDiscipline={true} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    expect(wrapper).matchSnapshot();
  });

  it("SpatialContainmentTree by Type and Discipline renders correctly with children", () => {
    const wrapper = (
      <SpatialContainmentTree iModel={connection.object} displayGuids={false} setIsDisplayGuids={(_displayGuids: boolean) => { }}
        groupByType={true} groupByDiscipline={true} setGroupByType={(_groupByType: boolean) => { }} setGroupByDiscipline={(_groupByDiscipline: boolean) => { }} />
    );
    expect(wrapper).matchSnapshot();
  });

});
