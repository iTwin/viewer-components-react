/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { KeySet } from "@itwin/presentation-common";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";

import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import type { FavoritePropertiesManager, SelectionManager, SelectionScopesManager  } from "@itwin/presentation-frontend";

export function createPropertyRecord(value: PropertyValue, description: Partial<PropertyDescription>, ) {
  const propertyDescription: PropertyDescription = {
    displayLabel: "Test Property",
    name: "test-prop",
    typename: "string",
    ...description,
  };
  return new PropertyRecord(value, propertyDescription);
}

export function stubSelectionManager() {
  const selectionManagerStub = {
    selectionChange: new SelectionChangeEvent(),
    getSelectionLevels: createFunctionStub<SelectionManager["getSelectionLevels"]>().returns([0]),
    getSelection: createFunctionStub<SelectionManager["getSelection"]>().returns(new KeySet()),
    replaceSelection: createFunctionStub<SelectionManager["replaceSelection"]>(),
    scopes: {
      computeSelection: createFunctionStub<SelectionScopesManager["computeSelection"]>().resolves(new KeySet()),
    },
  };

  sinon.stub(Presentation, "selection").get(() => selectionManagerStub);
  return selectionManagerStub;
}

export function stubFavoriteProperties() {
  const favoritePropertiesStub = {
    onFavoritesChanged: new BeEvent<() => void>(),
    has: createFunctionStub<FavoritePropertiesManager["has"]>().returns(false),
    add: createFunctionStub<FavoritePropertiesManager["add"]>(),
    remove: createFunctionStub<FavoritePropertiesManager["remove"]>(),
  };

  sinon.stub(Presentation, "favoriteProperties").get(() => favoritePropertiesStub);

  return favoritePropertiesStub;
}

export function stubPresentation() {
  const presentationStub = {
    onIModelContentChanged: new BeEvent(),
    rulesets: () => ({
      onRulesetModified: new BeEvent(),
    }),
    vars: () => ({
      onVariableChanged: new BeEvent(),
    }),
  };

  sinon.stub(Presentation, "presentation").get(() => presentationStub);
  return presentationStub;
}

export function createFunctionStub<TFunc extends (...args: any) => any>() {
  return sinon.stub<Parameters<TFunc>, ReturnType<TFunc>>();
}

export function createResolvablePromise<T>() {
  let resolveFn: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {resolveFn = resolve;});
  return {
    promise,
    resolve: async (value: T) => {
      resolveFn(value);
      await new Promise((resolve) => setTimeout(resolve));
    },
  };
}
