/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/



import * as React from "react";
import { Provider } from "react-redux";
import { mount } from "enzyme";
import { IModelApp, NoRenderApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { BeEvent } from "@bentley/bentleyjs-core";
import { TestUtils, TreeWithRuleSetController, setupDataProvider } from "./Utils";
import { Presentation } from "@bentley/presentation-frontend";
import * as moq from "typemoq";
import { PresentationManager, RulesetManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { ClassificationsTree } from "../components/trees/ClassificationsTree";

describe("TreeWithRuleset Component tests.", () => {

  const connection = moq.Mock.ofType<IModelConnection>();
  const controller = moq.Mock.ofType<TreeWithRuleSetController>();
  const shutdownIModelApp = () => {
    if (IModelApp.initialized)
      IModelApp.shutdown();
  };
  before(async () => {
    shutdownIModelApp();
    NoRenderApp.startup();
    Presentation.terminate();
    Presentation.initialize();
    await TestUtils.initializeUiFramework(connection.object);
    IModelApp.i18n.registerNamespace("TreeWidget");
    controller.setup((x) => x.createDataProvider()).returns(() => setupDataProvider(connection.object));
  });


  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();

  beforeEach(async () => {
    rulesetVariablesManagerMock.reset();
    presentationManagerMock.reset();
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
    TestUtils.terminateUiFramework();
    Presentation.terminate();
    shutdownIModelApp();
  });

  it("ClassificationsTree renders correctly with children", () => {
    const wrapper = (
      <Provider store={TestUtils.store}>
        <ClassificationsTree iModel={connection.object} displayGuids={true} setIsDisplayGuids={(_display: boolean) => { }} enableVisibility={false} />
      </Provider>
    );
    mount(wrapper).should.matchSnapshot();
  });

  it("ClassificationsTree renders correctly with visibility", () => {
    const wrapper = (
      <Provider store={TestUtils.store}>
        <ClassificationsTree iModel={connection.object} displayGuids={true} setIsDisplayGuids={(_display: boolean) => { }} enableVisibility={true} />
      </Provider>
    );
    mount(wrapper).should.matchSnapshot();
  });
});
