/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render as rtlRender } from "@testing-library/react";
import { ApiContext } from "../widget/context/ApiContext";
import type { AnyAction, Store } from "redux";
import { combineReducers, createStore } from "redux";
import { FrameworkReducer, SyncUiEventDispatcher, UiFramework } from "@itwin/appui-react";
import type { Localization } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { ReportsConfigWidget } from "../ReportsConfigWidget";
import userEvent from "@testing-library/user-event";
import { REPORTS_CONFIG_BASE_URL } from "../widget/ReportsConfigUiProvider";

export const mockAccessToken = "Bearer eyJhbGci";

interface WrapperProps {
  children?: React.ReactNode;
}

function render(ui: React.ReactElement, { ...options } = {}) {
  const Wrapper = ({ children }: WrapperProps) => (
    <ApiContext.Provider value={{ accessToken: mockAccessToken, baseUrl: REPORTS_CONFIG_BASE_URL }}>{children}</ApiContext.Provider>
  );

  return {
    user: userEvent.setup(),
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from "@testing-library/react";
// override React Testing Library's render with our own
export { render };

function createAppStore(): Store {
  const rootReducer = combineReducers({
    FrameworkReducer, // eslint-disable-line @typescript-eslint/naming-convention
  } as any);

  return createStore(rootReducer,
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());
}

export class TestUtils {
  private static _uiFrameworkInitialized = false;
  public static store: Store<any, AnyAction>;

  public static get localization(): Localization {
    return IModelApp.localization;
  }

  public static async initializeUiFramework(imodel?: IModelConnection) {
    if (!TestUtils._uiFrameworkInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires
      this.store = createAppStore();

      await UiFramework.initialize(this.store);
      // Set the iModelConnection in the Redux store
      if (imodel)
        UiFramework.setIModelConnection(imodel);
      TestUtils._uiFrameworkInitialized = true;
    }
    SyncUiEventDispatcher.setTimeoutPeriod(0); // disables non-immediate event processing.
  }

  public static terminateUiFramework() {
    ReportsConfigWidget.terminate();
    TestUtils._uiFrameworkInitialized = false;
  }
}

export const deferred = async () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
