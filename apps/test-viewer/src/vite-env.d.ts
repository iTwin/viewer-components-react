/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly IMJS_GLOBAL_PROPS?: string;
  readonly IMJS_BUILD_MODE?: string;
  readonly IMJS_URL_PREFIX?: string;
  readonly IMJS_ITWIN_ID?: string;
  readonly IMJS_IMODEL_ID?: string;
  readonly IMJS_AUTH_CLIENT_CLIENT_ID: string;
  readonly IMJS_AUTH_CLIENT_SCOPES: string;
  readonly IMJS_AUTH_AUTHORITY: string;
  readonly IMJS_AUTH_CLIENT_REDIRECT_URI: string;
  readonly IMJS_AUTH_CLIENT_LOGOUT_URI: string;
  readonly IMJS_AUTH_ARCGIS_CLIENT_ID?: string;
  readonly IMJS_EC3_PORTAL_AUTH_CLIENT_ID?: string;
  readonly IMJS_EC3_PORTAL_AUTH_CLIENT_REDIRECT_URI?: string;
  readonly IMJS_BING_MAPS_KEY?: string;
  readonly IMJS_CESIUM_ION_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
