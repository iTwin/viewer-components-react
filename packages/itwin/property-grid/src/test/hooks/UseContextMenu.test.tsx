/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { Field, PropertyValueFormat as PresentationPropertyValueFormat } from "@itwin/presentation-common";
import { FavoritePropertiesScope } from "@itwin/presentation-frontend";
import { render, waitFor } from "@testing-library/react";
import userEvents from "@testing-library/user-event";
import * as webUtilities from "../../api/WebUtilities";
import {
  createAddFavoritePropertyItemProvider, createCopyPropertyTextItemProvider, createRemoveFavoritePropertyItemProvider, useContextMenu,
} from "../../hooks/UseContextMenu";
import { PropertyGridManager } from "../../PropertyGridManager";
import { createFunctionStub, createPropertyRecord, stubFavoriteProperties } from "../TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { MouseEvent } from "react";
import type { ContextMenuItemDefinition, UseContentMenuProps } from "../../hooks/UseContextMenu";

describe("useContextMenu", () => {
  const imodel = {} as IModelConnection;
  const record = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "test-prop", displayLabel: "Test Prop" });
  const dataProvider = {
    getFieldByPropertyDescription: createFunctionStub<PresentationPropertyDataProvider["getFieldByPropertyDescription"]>(),
  };

  function TestComponent(props: UseContentMenuProps) {
    const { renderContextMenu, onPropertyContextMenu } = useContextMenu(props);
    return <>
      <div>Outside</div>
      <button onClick={async () => onPropertyContextMenu({ event: { clientX: 10, clientY: 10, persist: () => {} } as unknown as MouseEvent, propertyRecord: record })}>Open Menu</button>
      {renderContextMenu()}
    </>;
  }

  it("opens context menu", async () => {
    const contextMenuItem: ContextMenuItemDefinition = {
      key: "test-item",
      label: "Test Item",
      execute: async () => {},
    };

    const { getByText } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItemProviders={[() => contextMenuItem]}
      />
    );

    const openButton = await waitFor(() => getByText("Open Menu"));
    await userEvents.click(openButton);

    await waitFor(() => getByText("Test Item"));
  });

  it("doesn't open context menu if there are no items", async () => {
    const { getByText, queryByRole } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
      />
    );

    const openButton = await waitFor(() => getByText("Open Menu"));
    await userEvents.click(openButton);

    expect(queryByRole("menu")).to.be.null;
  });

  it("closes context menu when item is clicked", async () => {
    const executeStub = sinon.stub();
    const contextMenuItem: ContextMenuItemDefinition = {
      key: "test-item",
      label: "Test Item",
      execute: executeStub,
    };

    const { getByText, queryByText } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItemProviders={[() => contextMenuItem]}
      />
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await userEvents.click(openButton);

    // find item
    const item = await waitFor(() => getByText("Test Item"));

    // click item
    await userEvents.click(item);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
    expect(executeStub).to.be.calledOnce;
  });

  it("closes context menu when `Esc` is clicked", async () => {
    const contextMenuItem: ContextMenuItemDefinition = {
      key: "test-item",
      label: "Test Item",
      execute: async () => {},
    };

    const { getByText, queryByText } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItemProviders={[() => contextMenuItem]}
      />
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await userEvents.click(openButton);

    // find item
    await waitFor(() => getByText("Test Item"));

    // click item
    await userEvents.keyboard("{Escape}");

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
  });

  it("closes context menu when outside element is clicked", async () => {
    const contextMenuItem: ContextMenuItemDefinition = {
      key: "test-item",
      label: "Test Item",
      execute: async () => {},
    };

    const { getByText, queryByText } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItemProviders={[() => contextMenuItem]}
      />
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await userEvents.click(openButton);

    // find item
    await waitFor(() => getByText("Test Item"));

    // click outside element
    const outsideElement = getByText("Outside");
    await userEvents.click(outsideElement);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
  });
});

describe("Default context menu item providers", () => {
  const imodel = {} as IModelConnection;
  const dataProvider = {} as IPresentationPropertyDataProvider;
  const record = createRecord();
  const field: Field = createField();

  let favoritesManager: ReturnType<typeof stubFavoriteProperties>;

  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);
    favoritesManager = stubFavoriteProperties();
  });

  after(() => {
    sinon.restore();
  });

  beforeEach(() => {
    favoritesManager.add.reset();
    favoritesManager.remove.reset();
    favoritesManager.has.reset();
  });

  [undefined, FavoritePropertiesScope.ITwin].map((scope) => {
    describe("createAddFavoritePropertyItemProvider", () => {
      it(`creates definiton for non-favorite property with ${getScopeName(scope)} scope`, async () => {
        favoritesManager.has.returns(false);

        const item = createAddFavoritePropertyItemProvider(scope)({ field, imodel, dataProvider, record });
        expect(item.hidden).to.be.false;
        expect(item.label).to.be.eq("context-menu.add-favorite.label");
        expect(item.title).to.be.eq("context-menu.add-favorite.description");

        await item.execute();
        expect(favoritesManager.add).to.be.calledOnceWith(field, imodel, scope ?? FavoritePropertiesScope.IModel);
      });

      it(`creates definiton for favorite property with ${getScopeName(scope)} scope`, async () => {
        favoritesManager.has.returns(true);

        const item = createAddFavoritePropertyItemProvider(scope)({ field, imodel, dataProvider, record });
        expect(item.hidden).to.be.true;
        expect(item.label).to.be.eq("context-menu.add-favorite.label");
        expect(item.title).to.be.eq("context-menu.add-favorite.description");
      });
    });

    describe("createRemoveFavoritePropertyItemProvider", () => {
      it(`creates definiton for non-favorite property with ${getScopeName(scope)} scope`, async () => {
        favoritesManager.has.returns(false);

        const item = createRemoveFavoritePropertyItemProvider(scope)({ field, imodel, dataProvider, record });
        expect(item.hidden).to.be.true;
        expect(item.label).to.be.eq("context-menu.remove-favorite.label");
        expect(item.title).to.be.eq("context-menu.remove-favorite.description");
      });

      it(`creates definiton for favorite property with ${getScopeName(scope)} scope`, async () => {
        favoritesManager.has.returns(true);

        const item = createRemoveFavoritePropertyItemProvider(scope)({ field, imodel, dataProvider, record });
        expect(item.hidden).to.be.false;
        expect(item.label).to.be.eq("context-menu.remove-favorite.label");
        expect(item.title).to.be.eq("context-menu.remove-favorite.description");

        await item.execute();
        expect(favoritesManager.remove).to.be.calledOnceWith(field, imodel, scope ?? FavoritePropertiesScope.IModel);
      });
    });
  });

  describe("createCopyPropertyTextItemProvider", () => {
    it(`creates definiton`, async () => {
      const copyStub = sinon.stub(webUtilities, "copyToClipboard");

      const item = createCopyPropertyTextItemProvider()({ field, imodel, dataProvider, record });
      expect(item.hidden).to.be.undefined;
      expect(item.label).to.be.eq("context-menu.copy-text.label");
      expect(item.title).to.be.eq("context-menu.copy-text.description");

      await item.execute();

      expect(copyStub).to.be.calledOnceWithExactly(record.description);
    });
  });
});

function getScopeName(scope: undefined | FavoritePropertiesScope) {
  if (scope === undefined) {
    return "default";
  }
  return "custom";
}

function createField() {
  return new Field(
    {
      name: "category",
      description: "",
      expand: false,
      label: "Category",
      priority: 0,
    },
    "test-field",
    "Test Field",
    {
      typeName: "string",
      valueFormat: PresentationPropertyValueFormat.Primitive,
    },
    false,
    0
  );
}

function createRecord() {
  const record = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "test-prop", displayLabel: "Test Prop" });
  record.description = "Test Prop Value";
  return record;
}
