/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { vi } from "vitest";
import { faker } from "@faker-js/faker";
import { GroupingMappingCustomUIType, Groups } from "../grouping-mapping-widget";
import type { GroupMinimalList, IGroupsClient, IMappingsClient, Mapping } from "@itwin/insights-client";
import * as moq from "typemoq";
import type { IModelConnection, ViewManager } from "@itwin/core-frontend";
import type { ContextCustomUIProps, GroupingCustomUIProps, GroupingMappingCustomUI } from "../grouping-mapping-widget";
import userEvent from "@testing-library/user-event";
import { render, screen, waitForElementToBeRemoved, within } from "../test/test-utils";

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
  extractionEnabled: false,
  _links: {
    iModel: {
      href: "",
    },
  },
};

const groupsFactory = (): GroupMinimalList => ({
  groups: Array.from({ length: faker.datatype.number({ min: 3, max: 5 }) }, (_, index) => ({
    id: `${faker.datatype.uuid()}`,
    groupName: `mOcKgRoUp${index}`,
    description: `mOcKgRoUpDeScRiPtIoN${index}`,
    query: `mOcKgRoUpQuErY${index}`,
    _links: {
      iModel: {
        href: "",
      },
      mapping: {
        href: "",
      },
    },
  })),
  _links: {
    next: undefined,
    self: {
      href: "",
    },
  },
});

const connectionMock = moq.Mock.ofType<IModelConnection>();
const viewManagerMock = moq.Mock.ofType<ViewManager>();
const mappingClientMock = moq.Mock.ofType<IMappingsClient>();
const groupsClientMock = moq.Mock.ofType<IGroupsClient>();

vi.mock("@itwin/appui-react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@itwin/appui-react");
  return {
    ...actual,
    useActiveIModelConnection: () => connectionMock.object,
  };
});

vi.mock("@itwin/core-frontend", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@itwin/core-frontend");
  return {
    ...actual,
    IModelApp: {
      viewManager: {},
    },
  };
});

vi.mock("../components/context/MappingClientContext", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../components/context/MappingClientContext");
  return {
    ...actual,
    useMappingClient: () => mappingClientMock.object,
  };
});

vi.mock("../components/context/GroupsClientContext", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../components/context/GroupsClientContext");
  return {
    ...actual,
    useGroupsClient: () => groupsClientMock.object,
  };
});

vi.mock("../common/utils", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../common/utils");
  return {
    ...actual,
    enableExperimentalFeatures: vi.fn,
  };
});

const mockGroups = groupsFactory();

describe("Groups View", () => {
  beforeEach(async () => {
    connectionMock.setup((x) => x.iModelId).returns(() => mockIModelId);
    connectionMock.setup((x) => x.iTwinId).returns(() => mockITwinId);

    groupsClientMock.setup(async (x) => x.getGroups(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => Promise.resolve(mockGroups));
  });

  afterEach(() => {
    connectionMock.reset();
    mappingClientMock.reset();
    viewManagerMock.reset();
  });

  it("List all groups", async () => {
    // Arange

    // Act
    const user = userEvent.setup();
    render(
      <Groups
        mapping={mockMapping}
        onClickAddGroup={vi.fn()}
        onClickGroupModify={vi.fn()}
        onClickGroupTitle={vi.fn}
        onClickRenderContextCustomUI={vi.fn()}
      />,
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert

    // Should have the correct random mockGroups.groups count listed
    const horizontalTiles = screen.getAllByTestId("group-list-item");
    expect(horizontalTiles).toHaveLength(mockGroups.groups.length);

    horizontalTiles.forEach((horizontalTile, index) => {
      const groupTile = within(horizontalTile);
      expect(groupTile.getByText(mockGroups.groups[index].groupName)).toBeInTheDocument();
      expect(groupTile.getByText(mockGroups.groups[index].description ?? "")).toBeInTheDocument();
    });

    // Click on first group more icon
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    await user.click(moreButton[0]);

    // Should only have the permanent delete context item.
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(1);
    expect(contextMenuItems[0]).toHaveTextContent("common.remove");
  });

  it("Set up grouping custom UI", async () => {
    // Arange
    const mockedUIComponent = (_props: GroupingCustomUIProps) => React.createElement("div");
    const mockGroupingUI: GroupingMappingCustomUI = {
      type: GroupingMappingCustomUIType.Grouping,
      name: "mOcKgRoUpInGuI",
      displayLabel: "Mock Grouping UI",
      uiComponent: mockedUIComponent,
    };

    const groupingMappingCustomUIMock = [mockGroupingUI];

    // Act
    const { user } = render(
      <Groups
        mapping={mockMapping}
        onClickAddGroup={vi.fn()}
        onClickGroupModify={vi.fn()}
        onClickGroupTitle={vi.fn}
        onClickRenderContextCustomUI={vi.fn()}
      />,
      groupingMappingCustomUIMock,
    );

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

    // Should have 2 context menu items
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(2);
    expect(contextMenuItems[0]).toHaveTextContent("common.edit");

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

  it("Set up context custom UI - should have add context menu", async () => {
    // Arange
    const mockedUIComponent = (_props: ContextCustomUIProps) => React.createElement("div");
    const mockContextUI: GroupingMappingCustomUI = {
      type: GroupingMappingCustomUIType.Context,
      name: "mOcKgRoUpInGuI",
      displayLabel: "Mock Grouping UI",
      uiComponent: mockedUIComponent,
    };

    const groupingMappingCustomUIMock = [mockContextUI];
    const onClickRenderContextCustomUIMock = vi.fn();

    // Act
    const { user } = render(
      <Groups
        mapping={mockMapping}
        onClickAddGroup={vi.fn()}
        onClickGroupModify={vi.fn()}
        onClickGroupTitle={vi.fn}
        onClickRenderContextCustomUI={onClickRenderContextCustomUIMock}
      />,
      groupingMappingCustomUIMock,
    );

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert

    // Should have the right group number
    const horizontalTiles = screen.getAllByTestId("group-list-item");
    expect(horizontalTiles).toHaveLength(mockGroups.groups.length);

    // Click on first group more icon
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    await user.click(moreButton[0]);

    // Should have 2 context menu items
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(2);
    expect(contextMenuItems[0]).toHaveTextContent(mockContextUI.displayLabel);
    expect(contextMenuItems[1]).toHaveTextContent("common.remove");

    // Click on the context ui
    await user.click(contextMenuItems[0]);

    // Callback should have been called with correct parameters
    expect(onClickRenderContextCustomUIMock).toBeCalledWith(mockedUIComponent, mockGroups.groups[0], mockContextUI.displayLabel);
  });

  it("Set up both grouping and context custom UI", async () => {
    // Arange
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

    const groupingMappingCustomUIMock = [mockContextUI, mockGroupingUI];
    const onClickAddGroup = vi.fn();
    const onClickRenderContextCustomUIMock = vi.fn();

    // Act
    const { user } = render(
      <Groups
        mapping={mockMapping}
        onClickAddGroup={onClickAddGroup}
        onClickGroupModify={vi.fn()}
        onClickGroupTitle={vi.fn}
        onClickRenderContextCustomUI={onClickRenderContextCustomUIMock}
      />,
      groupingMappingCustomUIMock,
    );

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

    await user.click(addCustom[0]);

    // Callback should have been called with correct parameters
    expect(onClickAddGroup).toBeCalledWith(mockGroupingUI.name);

    // Check the group tile number
    const horizontalTiles = screen.getAllByTestId("group-list-item");
    expect(horizontalTiles).toHaveLength(mockGroups.groups.length);

    // Click on first group more icon
    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    await user.click(moreButton[0]);

    // Should have 3 context menu items
    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");

    expect(contextMenuItems).toHaveLength(3);
    expect(contextMenuItems[0]).toHaveTextContent("common.edit");
    expect(contextMenuItems[1]).toHaveTextContent(mockContextUI.displayLabel);
    expect(contextMenuItems[2]).toHaveTextContent("common.remove");

    // Click on the context ui
    await user.click(contextMenuItems[1]);

    // Callback should have been called with correct parameters
    expect(onClickRenderContextCustomUIMock).toBeCalledWith(mockedContextUIComponent, mockGroups.groups[0], mockContextUI.displayLabel);
  });
});
