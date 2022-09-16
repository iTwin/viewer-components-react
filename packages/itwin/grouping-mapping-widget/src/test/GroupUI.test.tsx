/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, TestUtils, waitForElementToBeRemoved } from "./test-utils";
import { faker } from "@faker-js/faker";
import type { GroupingMappingCustomUI} from "../grouping-mapping-widget";
import { Groupings } from "../grouping-mapping-widget";
import type { Group, Mapping } from "@itwin/insights-client";
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
const mockGroupId1 = faker.datatype.uuid();
const mockGroupId2 = faker.datatype.uuid();

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

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

const mockGroups: Group[] = [
  {
    id: mockGroupId1,
    groupName: "mOcKgRoUp1",
    description: "mOcKgRoUpDeScRiPtIoN1",
    query: faker.datatype.string(),
  },
  {
    id: mockGroupId2,
    groupName: "mOcKgRoUp2",
    description: "mOcKgRoUpDeScRiPtIoN2",
    query: faker.datatype.string(),
  },
];

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

describe("Groupings View", () => {
  it("List all groups", async () => {
    // Arange
    server.use(
      rest.get(
        `https://api.bentley.com/insights/reporting/datasources/imodels/${mockIModelId}/mappings/${mockMappingId}/groups`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
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
    const addButton = screen.getAllByTestId("add-group-button");
    expect(addButton).toHaveLength(1);

    await user.click(addButton[0]);

    const AddMenuItems = screen.getAllByTestId("menu-item");
    expect(AddMenuItems).toHaveLength(3);
    expect(AddMenuItems[0]).toHaveTextContent("Selection");
    expect(AddMenuItems[1]).toHaveTextContent("Query");
    expect(AddMenuItems[2]).toHaveTextContent("Manual");

    // Assert
    // const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    // expect(horizontalTiles).toHaveLength(mockGroups.length);

    // horizontalTiles.forEach((horizontalTile, index) => {
    //   const groupTile = within(horizontalTile);
    //   expect(
    //     groupTile.getByText(
    //       mockGroups[index].groupName
    //     )
    //   ).toBeInTheDocument();
    //   expect(
    //     groupTile.getByTitle(
    //       mockGroups[index].description ?? ""
    //     )
    //   ).toBeInTheDocument();
    // });
  });
});
