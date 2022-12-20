/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as moq from "typemoq";
import deepEqual from "deep-equal";
import { UiFramework } from "@itwin/appui-react";
import { TreeWidget } from "../TreeWidget";
import type { PresentationManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import { BeEvent } from "@itwin/core-bentley";
import type { VariableValue } from "@itwin/presentation-common";

export class TestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (TestUtils._initialized)
      return;

    await UiFramework.initialize(undefined);
    await TreeWidget.initialize();
    TestUtils._initialized = true;
  }

  public static terminate() {
    UiFramework.terminate();
    TreeWidget.terminate();
    TestUtils._initialized = false;
  }
}

/** typemoq matcher for deep equality */
export const deepEquals = <T>(expected: T) => {
  return moq.It.is((actual: T) => deepEqual(actual, expected));
};

export const mockPresentationManager = () => {
  const onRulesetVariableChanged = new BeEvent<(variableId: string, prevValue: VariableValue, currValue: VariableValue) => void>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => onRulesetVariableChanged);

  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);

  return {
    rulesetVariablesManager: rulesetVariablesManagerMock,
    presentationManager: presentationManagerMock,
  };
};

export async function flushAsyncOperations() {
  return new Promise((resolve) => setTimeout(resolve));
}
