/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { EC3ConfigPropsWithCallbacks } from "./EC3/EC3Config";
import type { Route } from "./EC3Widget";

export type EC3RouterProps = Omit<EC3ConfigPropsWithCallbacks, "iTwinId" | "clientId"> & {
  currentRoute: Route;
  navigateTo: (getNextRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
};
