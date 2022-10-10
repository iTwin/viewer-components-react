/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { mockAccessToken, mockMappingClient, render, screen, TestUtils, waitForElementToBeRemoved, within } from "./test-utils";
import { faker } from "@faker-js/faker";
import { Groupings } from "../grouping-mapping-widget";
import type { GroupCollection, Mapping } from "@itwin/insights-client";
import * as moq from "typemoq";
import type { IModelConnection, SelectionSet, SelectionSetEvent} from "@itwin/core-frontend";
import { NoRenderApp } from "@itwin/core-frontend";
import type { SelectionManager, SelectionScopesManager } from "@itwin/presentation-frontend";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import type { ContextCustomUIProps, GroupingCustomUIProps, GroupingMappingCustomUI} from "../grouping-mapping-widget";
import { GroupingMappingCustomUIType } from "../grouping-mapping-widget";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();
const mockMappingId = faker.datatype.uuid();
const mockMapping: Mapping = {
  id: mockMappingId,
  mappingName: "mOcKmApPiNg1",
  description: "mOcKmApPiNgDeScRiPtIoN1",
  createdBy: faker.random.alpha(),
  createdOn: faker.date.past().toDateString(),
  modifiedBy: faker.random.alpha(),
  modifiedOn: faker.date.past().toDateString(),
  extractionEnabled:false,
  _links: {
    imodel: {
      href: "",
    },
  },
};

const groupsFactory = (): GroupCollection => ({
  groups: Array.from(
    { length: faker.datatype.number({ min: 3, max: 5 }) },
    (_, index) => ({
      id: `${faker.datatype.uuid()}`,
      groupName: `mOcKgRoUp${index}`,
      description: `mOcKgRoUpDeScRiPtIoN${index}`,
      query: `mOcKgRoUpQuErY${index}`,
      _links: {
        imodel: {
          href: "",
        },
        mapping: {
          href: "",
        },
      },
    })
  ),
  _links: {
    next: undefined,
    self: {
      href: "",
    },
  },
});

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

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
  connectionMock.setup((x) => x.iModelId).returns(() => mockIModelId);
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
});

describe("Groupings View with default UIs", () => {
  it("List all groups and click on add group and edit group buttons", async () => {
    // Arange
    const mockGroups = groupsFactory();
    const mockedAccessToken = await mockAccessToken();
    mockMappingClient
      .setup(async (x) => x.getGroups(mockedAccessToken, mockIModelId, mockMappingId))
      .returns(async () => mockGroups.groups);

    // Act
    const { user } = render(<Groupings mapping={mockMapping} goBack={jest.fn()} />);
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert
    const addButton = screen.getAllByTestId("gmw-add-group-button");
    expect(addButton).toHaveLength(1);

    // Click on 'Add Group' button
    await user.click(addButton[0]);

    // Should have three menu items
    const addSelection = screen.getAllByTestId("gmw-add-0");
    expect(addSelection).toHaveLength(1);
    const addSearch = screen.getAllByTestId("gmw-add-1");
    expect(addSearch).toHaveLength(1);
    const addManual = screen.getAllByTestId("gmw-add-2");
    expect(addManual).toHaveLength(1);

    // Should have the right group number
    const horizontalTiles = screen.getAllByTestId("gmw-horizontal-tile");
    expect(horizontalTiles).toHaveLength(mockGroups.groups.length);

    horizontalTiles.forEach((horizontalTile, index) => {
      const groupTile = within(horizontalTile);
      expect(
        groupTile.getByText(
          mockGroups.groups[index].groupName
        )
      ).toBeInTheDocument();
      expect(
        groupTile.getByText(
          mockGroups.groups[index].description ?? ""
        )
      ).toBeInTheDocument();
    });

    // Click on first group more icon
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    await user.click(moreButton[0]);

    // Should have 3 context menu items
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(3);
    expect(contextMenuItems[0]).toHaveTextContent("Edit");
    expect(contextMenuItems[1]).toHaveTextContent("Properties");
    expect(contextMenuItems[2]).toHaveTextContent("Remove");

    // Hover on 'Edit'
    await user.hover(contextMenuItems[0]);

    // Should have 3 sub menu items
    const editSelection = screen.getAllByTestId(`gmw-edit-0`);
    expect(editSelection).toHaveLength(1);
    const editSearch = screen.getAllByTestId(`gmw-edit-1`);
    expect(editSearch).toHaveLength(1);
    const editManual = screen.getAllByTestId(`gmw-edit-2`);
    expect(editManual).toHaveLength(1);
  });

  it("Set up grouping custom UI - should replace default grouping methods", async () => {
    // Arange
    const mockGroups = groupsFactory();
    const mockedAccessToken = await mockAccessToken();
    mockMappingClient
      .setup(async (x) => x.getGroups(mockedAccessToken, mockIModelId, mockMappingId))
      .returns(async () => mockGroups.groups);
    const mockedUIComponent = (_props: GroupingCustomUIProps) => React.createElement("div");
    const mockGroupingUI: GroupingMappingCustomUI = {
      type: GroupingMappingCustomUIType.Grouping,
      name: "mOcKgRoUpInGuI",
      displayLabel: "Mock Grouping UI",
      uiComponent: mockedUIComponent,
    };

    // Act
    const { user } = render(<Groupings mapping={mockMapping} goBack={jest.fn()} />, [mockGroupingUI]);
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert
    const addButton = screen.getAllByTestId("gmw-add-group-button");
    expect(addButton).toHaveLength(1);

    // Click on 'Add Group' button
    await user.click(addButton[0]);

    // Should have exactly 1 add method with given configuration
    const addCustom = screen.getAllByTestId("gmw-add-0");
    expect(addCustom).toHaveLength(1);
    expect(addCustom[0]).toHaveTextContent(mockGroupingUI.displayLabel);

    // Each group should have a more icon button
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);
    expect(moreButton.length).toBeGreaterThan(0);

    // Click on first more icon
    await user.click(moreButton[0]);

    // Should have 3 context menu items without context configuration
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(3);
    expect(contextMenuItems[0]).toHaveTextContent("Edit");

    // Hover on 'Edit'
    await user.hover(contextMenuItems[0]);

    // Should have exactly 1 sub menu item
    const editCustom = screen.getAllByTestId(`gmw-edit-0`);
    expect(editCustom).toHaveLength(1);
    expect(editCustom[0]).toHaveTextContent(mockGroupingUI.displayLabel);

    // Click on the edit custom UI
    await user.click(editCustom[0]);

    const groupName = screen.getAllByText(mockGroups.groups[0].groupName);
    expect(groupName).toHaveLength(1);
  });

  it("Set up context custom UI - should have default grouping methods and add context menu", async () => {
    // Arange
    const mockGroups = groupsFactory();
    const mockedAccessToken = await mockAccessToken();
    mockMappingClient
      .setup(async (x) => x.getGroups(mockedAccessToken, mockIModelId, mockMappingId))
      .returns(async () => mockGroups.groups);
    const mockedUIComponent = (_props: ContextCustomUIProps) => React.createElement("div");
    const mockContextUI: GroupingMappingCustomUI = {
      type: GroupingMappingCustomUIType.Context,
      name: "mOcKgRoUpInGuI",
      displayLabel: "Mock Grouping UI",
      uiComponent: mockedUIComponent,
    };

    // Act
    const { user } = render(<Groupings mapping={mockMapping} goBack={jest.fn()} />, [mockContextUI]);
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert
    const addButton = screen.getAllByTestId("gmw-add-group-button");
    expect(addButton).toHaveLength(1);

    // Click on 'Add Group' button
    await user.click(addButton[0]);

    // Should have three menu items
    const addSelection = screen.getAllByTestId("gmw-add-0");
    expect(addSelection).toHaveLength(1);
    const addSearch = screen.getAllByTestId("gmw-add-1");
    expect(addSearch).toHaveLength(1);
    const addManual = screen.getAllByTestId("gmw-add-2");
    expect(addManual).toHaveLength(1);

    // Should have the right group number
    const horizontalTiles = screen.getAllByTestId("gmw-horizontal-tile");
    expect(horizontalTiles).toHaveLength(mockGroups.groups.length);

    // Click on first group more icon
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    await user.click(moreButton[0]);

    // Should have 4 context menu items
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(4);
    expect(contextMenuItems[0]).toHaveTextContent("Edit");
    expect(contextMenuItems[1]).toHaveTextContent("Properties");
    expect(contextMenuItems[2]).toHaveTextContent("Remove");
    expect(contextMenuItems[3]).toHaveTextContent(mockContextUI.displayLabel);

    // Click on the context ui
    await user.click(contextMenuItems[3]);
  });

  it("Set up both grouping and context custom UI", async () => {
    // Arange
    const mockGroups = groupsFactory();
    const mockedAccessToken = await mockAccessToken();
    mockMappingClient
      .setup(async (x) => x.getGroups(mockedAccessToken, mockIModelId, mockMappingId))
      .returns(async () => mockGroups.groups);
    const mockedGroupingUIComponent = (_props: GroupingCustomUIProps) => React.createElement("div");
    const mockedContextUIComponent = (_props: ContextCustomUIProps) => React.createElement("div");
    const mockGroupingUI: GroupingMappingCustomUI = {
      type: GroupingMappingCustomUIType.Grouping,
      name: "mOcKgRoUpInGuI",
      displayLabel: "Mock Grouping UI",
      uiComponent: mockedGroupingUIComponent,
    };
    const mockContextUI: GroupingMappingCustomUI = {
      type: GroupingMappingCustomUIType.Context,
      name: "mOcKgRoUpInGuI",
      displayLabel: "Mock Grouping UI",
      uiComponent: mockedContextUIComponent,
    };

    // Act
    const { user } = render(<Groupings mapping={mockMapping} goBack={jest.fn()} />, [mockContextUI, mockGroupingUI]);
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert
    const addButton = screen.getAllByTestId("gmw-add-group-button");
    expect(addButton).toHaveLength(1);

    // Click on 'Add Group' button
    await user.click(addButton[0]);

    // Should have exactly 1 add method with given configuration
    const addCustom = screen.getAllByTestId("gmw-add-0");
    expect(addCustom).toHaveLength(1);
    expect(addCustom[0]).toHaveTextContent(mockGroupingUI.displayLabel);

    // Check the group tile number
    const horizontalTiles = screen.getAllByTestId("gmw-horizontal-tile");
    expect(horizontalTiles).toHaveLength(mockGroups.groups.length);

    // Click on first group more icon
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    await user.click(moreButton[0]);

    // Should have 4 context menu items
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(4);
    expect(contextMenuItems[0]).toHaveTextContent("Edit");
    expect(contextMenuItems[1]).toHaveTextContent("Properties");
    expect(contextMenuItems[2]).toHaveTextContent("Remove");
    expect(contextMenuItems[3]).toHaveTextContent(mockContextUI.displayLabel);

    // Click on the context ui
    await user.click(contextMenuItems[3]);
  });
});
