/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, TestUtils, waitForElementToBeRemoved, within } from "./test-utils";
import { faker } from "@faker-js/faker";
import type { GroupingMappingCustomUI} from "../grouping-mapping-widget";
import { Groupings } from "../grouping-mapping-widget";
import type { GroupCollection, Mapping } from "@itwin/insights-client";
import * as moq from "typemoq";
import type { IModelConnection, SelectionSet, SelectionSetEvent} from "@itwin/core-frontend";
import { NoRenderApp } from "@itwin/core-frontend";
import type { SelectionManager, SelectionScopesManager } from "@itwin/presentation-frontend";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";
import { setupServer } from "msw/node";
import { rest } from "msw";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();
const mockMappingId = faker.datatype.uuid();

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

const groupsFactory = (): GroupCollection => ({
  groups: Array.from(
    { length: faker.datatype.number({ min: 3, max: 5 }) },
    (_, index) => ({
      id: `${faker.datatype.uuid()}`,
      groupName: `mOcKgRoUp${index}`,
      description: `mOcKgRoUpDeScRiPtIoN${index}`,
      query: `mOcKgRoUpQuErY${index}`,
      deleted: false,
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

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

const server = setupServer();

beforeAll(async () => {
  // This is required by the i18n module within iTwin.js
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires
  await NoRenderApp.startup();
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
  server.listen({
    onUnhandledRequest: "warn",
  });
  server.printHandlers();
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});

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

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

describe("Groupings View with default UIs", () => {
  it("List all groups and click on add group and edit group buttons", async () => {
    // Arange
    const mockGroups = groupsFactory();
    server.use(
      rest.get(
        `https://api.bentley.com/insights/reporting/datasources/imodels/${mockIModelId}/mappings/${mockMappingId}/groups`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(500),
            ctx.status(200),
            ctx.json(mockGroups)
          );
        }
      ),
    );
    const mockUIs = jest.mocked<GroupingMappingCustomUI[]>([]);

    // Act
    const { user } = render(<Groupings mapping={mockMapping} goBack={jest.fn()} />, mockUIs);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));

    // Assert
    const addButton = screen.getAllByTestId("gmw-add-group-button");
    expect(addButton).toHaveLength(1);

    // click 'Add Group'
    await user.click(addButton[0]);

    const AddMenuItems = screen.getAllByTestId("gmw-add-group-menu-item");
    expect(AddMenuItems).toHaveLength(3);
    expect(AddMenuItems[0]).toHaveTextContent("Selection");
    expect(AddMenuItems[1]).toHaveTextContent("Query");
    expect(AddMenuItems[2]).toHaveTextContent("Manual");

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

    const moreButton = screen.getAllByTestId("gmw-more-button");
    expect(moreButton).toHaveLength(mockGroups.groups.length);

    // click on first group more icon
    await user.click(moreButton[0]);

    const contextMenuItems = screen.getAllByTestId("gmw-context-menu-item");
    expect(contextMenuItems).toHaveLength(3);
    expect(contextMenuItems[0]).toHaveTextContent("Edit");
    expect(contextMenuItems[1]).toHaveTextContent("Properties");
    expect(contextMenuItems[2]).toHaveTextContent("Remove");

    // hover 'Edit'
    await user.hover(contextMenuItems[0]);

    const editMenuItems = screen.getAllByTestId("gmw-edit-menu-item");
    expect(editMenuItems).toHaveLength(3);
    expect(editMenuItems[0]).toHaveTextContent("Selection");
    expect(editMenuItems[1]).toHaveTextContent("Query");
    expect(editMenuItems[2]).toHaveTextContent("Manual");
  });
});
