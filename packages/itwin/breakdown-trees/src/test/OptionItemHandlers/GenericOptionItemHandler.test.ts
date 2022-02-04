/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "mock-local-storage";
import { assert } from "chai";
import { GenericOptionItemHandler } from "../../Views/OptionItemHandlers";

(global as any).sessionStorage = window.sessionStorage;

describe("GenericOptionItemHandler", () => {
  const GENERIC_STORAGE_KEY = "generic-storage-key";

  before(async () => {
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("should get the value on init", async () => {
    let initialCondition = true;
    const setInitialValue = ((initialVal: boolean) => {
      sessionStorage.setItem(GENERIC_STORAGE_KEY, String(initialVal));
      initialCondition = initialVal;
    });
    const genericHandler = new GenericOptionItemHandler("tests", "generic handler", "anyicon", () => initialCondition, setInitialValue);
    genericHandler._setItemState(initialCondition);
    const returnValue = genericHandler.getIsActive();
    assert.isTrue(returnValue);
    assert.equal(sessionStorage.getItem(GENERIC_STORAGE_KEY), String(initialCondition));
  });

  it("should change the value when toggled", async () => {
    let initialCondition = true;
    const setInitialValue = ((initialVal: boolean) => {
      sessionStorage.setItem(GENERIC_STORAGE_KEY, String(initialVal));
      initialCondition = initialVal;
    });
    const genericHandler = new GenericOptionItemHandler("tests", "generic handler", "anyicon", () => initialCondition, setInitialValue);
    genericHandler._setItemState(initialCondition);
    genericHandler.toggle();
    const returnValue = genericHandler.getIsActive();
    assert.isFalse(returnValue);
    assert.equal(sessionStorage.getItem(GENERIC_STORAGE_KEY), "false");
  });
});
