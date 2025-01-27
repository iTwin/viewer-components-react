/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { Field, PropertyValueFormat as PresentationPropertyValueFormat } from "@itwin/presentation-common";
import { FavoritePropertiesScope } from "@itwin/presentation-frontend";
import * as webUtilities from "../../property-grid-react/api/WebUtilities.js";
import {
  AddFavoritePropertyContextMenuItem,
  CopyPropertyTextContextMenuItem,
  PropertyGridContextMenuItem,
  RemoveFavoritePropertyContextMenuItem,
  useContextMenu,
} from "../../property-grid-react/hooks/UseContextMenu.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { createFunctionStub, createPropertyRecord, render, stubFavoriteProperties, waitFor } from "../TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { MouseEvent } from "react";
import type { ContextMenuItemProps, UseContentMenuProps } from "../../property-grid-react/hooks/UseContextMenu.js";

describe("useContextMenu", () => {
  const imodel = {} as IModelConnection;
  const record = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "test-prop", displayLabel: "Test Prop" });
  const dataProvider = {
    getFieldByPropertyDescription: createFunctionStub<PresentationPropertyDataProvider["getFieldByPropertyDescription"]>(),
  };

  function TestComponent(props: UseContentMenuProps) {
    const { renderContextMenu, onPropertyContextMenu } = useContextMenu(props);
    return (
      <>
        <div>Outside</div>
        <button
          onClick={async () =>
            onPropertyContextMenu({ event: { clientX: 10, clientY: 10, persist: () => {} } as unknown as MouseEvent, propertyRecord: record })
          }
        >
          Open Menu
        </button>
        {renderContextMenu()}
      </>
    );
  }

  it("opens context menu", async () => {
    const { getByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[() => <div>Test Item</div>]}
      />,
    );

    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    await waitFor(() => getByText("Test Item"));
  });

  it("doesn't open context menu if there are no items", async () => {
    const { getByText, queryByRole, user } = render(
      <TestComponent imodel={imodel} dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider} />,
    );

    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    expect(queryByRole("menu")).to.be.null;
  });

  it("closes context menu when item is clicked", async () => {
    const selectStub = sinon.stub();
    const { getByText, queryByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[
          () => (
            <PropertyGridContextMenuItem id="test-item" onSelect={selectStub}>
              Test Item
            </PropertyGridContextMenuItem>
          ),
        ]}
      />,
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    // find item
    const item = await waitFor(() => getByText("Test Item"));

    // click item
    await user.click(item);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
    expect(selectStub).to.be.calledOnce;
  });

  it("closes context menu when `Esc` is clicked", async () => {
    const { getByText, queryByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[() => <div>Test Item</div>]}
      />,
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    // find item
    await waitFor(() => getByText("Test Item"));

    // simulate "escape" press
    await user.keyboard("{Escape}");

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
  });

  it("closes context menu when outside element is clicked", async () => {
    const { getByText, queryByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[() => <div>Test Item</div>]}
      />,
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    // find item
    await waitFor(() => getByText("Test Item"));

    // click outside element
    const outsideElement = getByText("Outside");
    await user.click(outsideElement);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).to.be.null);
  });

  describe("feature usage reporting", () => {
    it("reports when context menu opens", async () => {
      const onFeatureUsedSpy = sinon.spy();
      const { getByText, user } = render(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <TestComponent
            imodel={imodel}
            dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
            contextMenuItems={[() => <div>Test Item</div>]}
          />
        </TelemetryContextProvider>,
      );

      const openButton = await waitFor(() => getByText("Open Menu"));
      await user.click(openButton);

      await waitFor(() => getByText("Test Item"));
      expect(onFeatureUsedSpy).to.be.calledOnceWith("context-menu");
    });
  });
});

describe("Default context menu items", () => {
  const imodel = {} as IModelConnection;
  const dataProvider = {} as IPresentationPropertyDataProvider;
  const record = createRecord();
  const field: Field = createField();

  let favoritesManager: ReturnType<typeof stubFavoriteProperties>;
  const itemProps: ContextMenuItemProps = {
    imodel,
    dataProvider,
    record,
    field,
  };

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
    favoritesManager.hasAsync.reset();
  });

  describe("AddFavoritePropertyContextMenuItem", () => {
    it("renders item with non-favorite property", () => {
      favoritesManager.hasAsync.resolves(false);
      const { queryByText } = render(<AddFavoritePropertyContextMenuItem {...itemProps} />);
      expect(queryByText("context-menu.add-favorite.label"));
    });

    it("renders nothing if property is favorite", () => {
      favoritesManager.hasAsync.resolves(true);
      const { container } = render(<AddFavoritePropertyContextMenuItem {...itemProps} />);
      expect(container.children).to.have.lengthOf(0);
    });

    it("calls `Presentation.favorites.add` with default scope", async () => {
      favoritesManager.hasAsync.resolves(false);
      const { getByText, user } = render(<AddFavoritePropertyContextMenuItem {...itemProps} />);
      const item = await waitFor(() => getByText("context-menu.add-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.add).to.be.calledOnceWith(field, imodel, FavoritePropertiesScope.IModel));
    });

    it("calls `Presentation.favorites.add` with specified scope", async () => {
      favoritesManager.hasAsync.resolves(false);
      const { getByText, user } = render(<AddFavoritePropertyContextMenuItem {...itemProps} scope={FavoritePropertiesScope.ITwin} />);
      const item = await waitFor(() => getByText("context-menu.add-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.add).to.be.calledOnceWith(field, imodel, FavoritePropertiesScope.ITwin));
    });

    it("calls custom `onSelect` handler", async () => {
      favoritesManager.hasAsync.resolves(false);
      const spy = sinon.spy();
      const { getByText, user } = render(<AddFavoritePropertyContextMenuItem {...itemProps} onSelect={spy} />);
      const item = await waitFor(() => getByText("context-menu.add-favorite.label"));
      await user.click(item);

      expect(spy).to.be.calledOnce;
    });
  });

  describe("RemoveFavoritePropertyContextMenuItem", () => {
    it("renders item with favorite property", async () => {
      favoritesManager.hasAsync.resolves(true);
      const { queryByText } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} />);
      await waitFor(() => expect(queryByText("context-menu.remove-favorite.label")));
    });

    it("renders nothing if property is not favorite", async () => {
      favoritesManager.hasAsync.resolves(false);
      const { container } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} />);
      await waitFor(() => expect(container.children).to.have.lengthOf(0));
    });

    it("calls `Presentation.favorites.remove` with default scope", async () => {
      favoritesManager.hasAsync.resolves(true);
      const { getByText, user } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} />);
      const item = await waitFor(() => getByText("context-menu.remove-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.remove).to.be.calledOnceWith(field, imodel, FavoritePropertiesScope.IModel));
    });

    it("calls `Presentation.favorites.remove` with specified scope", async () => {
      favoritesManager.hasAsync.resolves(true);
      const { getByText, user } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} scope={FavoritePropertiesScope.ITwin} />);
      const item = await waitFor(() => getByText("context-menu.remove-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.remove).to.be.calledOnceWith(field, imodel, FavoritePropertiesScope.ITwin));
    });

    it("calls custom `onSelect` handler", async () => {
      favoritesManager.hasAsync.resolves(true);
      const spy = sinon.spy();
      const { getByText, user } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} onSelect={spy} />);
      const item = await waitFor(() => getByText("context-menu.remove-favorite.label"));
      await user.click(item);

      expect(spy).to.be.calledOnce;
    });
  });

  describe("CopyPropertyTextContextMenuItem", () => {
    it("renders item", () => {
      const { queryByText } = render(<CopyPropertyTextContextMenuItem {...itemProps} />);
      expect(queryByText("context-menu.copy-text.label"));
    });

    it("copies text when clicked", async () => {
      const copyStub = sinon.stub(webUtilities, "copyToClipboard");
      const { getByText, user } = render(<CopyPropertyTextContextMenuItem {...itemProps} />);
      const item = getByText("context-menu.copy-text.label");

      await user.click(item);

      expect(copyStub).to.be.calledOnceWithExactly(record.description);
    });

    it("calls custom `onSelect` handler", async () => {
      const spy = sinon.stub();
      const { getByText, user } = render(<CopyPropertyTextContextMenuItem {...itemProps} onSelect={spy} />);
      const item = getByText("context-menu.copy-text.label");

      await user.click(item);

      expect(spy).to.be.calledOnce;
    });
  });
});

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
    0,
  );
}

function createRecord() {
  const record = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "test-prop", displayLabel: "Test Prop" });
  record.description = "Test Prop Value";
  return record;
}
