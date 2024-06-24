/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type {
  EC3ConfigPropsWithCallbacks,
  EC3ConfigPropsWithDefaultReport,
  EC3ConfigPropsWithGetEC3AccessToken,
  EC3ConfigPropsWithRedirectUri,
} from "./EC3/EC3Config";

export type EC3WidgetProps = EC3ConfigPropsWithCallbacks &
  (Omit<EC3ConfigPropsWithRedirectUri, "iTwinId"> | Omit<EC3ConfigPropsWithGetEC3AccessToken, "iTwinId"> | Omit<EC3ConfigPropsWithDefaultReport, "iTwinId">);
