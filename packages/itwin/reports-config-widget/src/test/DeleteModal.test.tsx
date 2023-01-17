/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import faker from "@faker-js/faker";
import "@testing-library/jest-dom";
import type {
  IModelConnection,
  SelectionSet,
  SelectionSetEvent,
} from "@itwin/core-frontend";
import { NoRenderApp } from "@itwin/core-frontend";
import {
  render,
  screen,
  TestUtils,
} from "./test-utils";
import * as moq from "typemoq";
import type {
  SelectionManager,
  SelectionScopesManager,
} from "@itwin/presentation-frontend";
import {
  Presentation,
  SelectionChangeEvent,
} from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";
import DeleteModal from "../widget/components/DeleteModal";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import { EmptyLocalization } from "@itwin/core-common";

const mockITwinId = faker.datatype.uuid();
const mockIModelId1 = faker.datatype.uuid();

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

beforeAll(async () => {
  await NoRenderApp.startup({localization: new EmptyLocalization()});
  await Presentation.initialize();
  const selectionSet = moq.Mock.ofType<SelectionSet>();
  const onChanged = moq.Mock.ofType<BeEvent<(ev: SelectionSetEvent) => void>>();
  selectionSet.setup((x) => x.elements).returns(() => new Set([]));
  selectionSet.setup((x) => x.onChanged).returns(() => onChanged.object);
  connectionMock
    .setup((x) => x.selectionSet)
    .returns(() => selectionSet.object);
  connectionMock.setup((x) => x.iModelId).returns(() => mockIModelId1);
  connectionMock.setup((x) => x.iTwinId).returns(() => mockITwinId);

  selectionManagerMock
    .setup((x) => x.selectionChange)
    .returns(() => new SelectionChangeEvent());

  selectionScopesManagerMock
    .setup(async (x) => x.getSelectionScopes(connectionMock.object))
    .returns(async () => []);
  selectionManagerMock
    .setup((x) => x.scopes)
    .returns(() => selectionScopesManagerMock.object);

  Presentation.setSelectionManager(selectionManagerMock.object);
  await TestUtils.initializeUiFramework(connectionMock.object);
  await ReportsConfigWidget.initialize();
});

describe("Delete modal", () => {
  it("should render", () => {
    const { container } = render(
      <DeleteModal
        entityName="test"
        show={true}
        setShow={jest.fn()}
        onDelete={jest.fn()}
        refresh={jest.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("should call onDelete when delete button is clicked", async () => {
    const onDelete = jest.fn();
    const { user } = render(
      <DeleteModal
        entityName="test"
        show={true}
        setShow={jest.fn()}
        onDelete={onDelete}
        refresh={jest.fn()}
      />
    );
    const deleteButton = screen.getByRole("button", {
      name: /delete/i,
    });
    await user.click(deleteButton);
    expect(onDelete).toHaveBeenCalled();
  });

  it("should call setShow when cancel button is clicked", async () => {
    const setShow = jest.fn();
    const { user } = render(
      <DeleteModal
        entityName="test"
        show={true}
        setShow={setShow}
        onDelete={jest.fn()}
        refresh={jest.fn()}
      />
    );
    const cancelButton = screen.getByRole("button", {
      name: /cancel/i,
    });
    await user.click(cancelButton);
    expect(setShow).toHaveBeenCalled();
  });
});
