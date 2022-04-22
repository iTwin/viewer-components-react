/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, TestUtils } from "../test/test-utils";
import { Reports } from "../widget/components/Reports";
import * as moq from "typemoq"
import { IModelApp, IModelConnection, NoRenderApp, SelectionSet, SelectionSetEvent } from "@itwin/core-frontend";
import { BeEvent } from "@itwin/core-bentley";
import { Presentation } from "@itwin/presentation-frontend";

const connection = moq.Mock.ofType<IModelConnection>();

describe("Reports Component", function () {

  beforeAll(async () => {
    // await NoRenderApp.startup();
    const selectionSetMock = moq.Mock.ofType<SelectionSet>();
    const onChangeMock = moq.Mock.ofType<BeEvent<(ev: SelectionSetEvent) => void>>();
    connection.setup((c) => c.selectionSet).returns(() => selectionSetMock.object);
    selectionSetMock.setup((ss) => ss.onChanged).returns(() => onChangeMock.object);
    await TestUtils.initializeUiFramework();
    await IModelApp.localization.registerNamespace("ReportsConfigWidget");

  });

  it("component renders", function () {
    render(<Reports />);

    screen.debug()
  });
});
