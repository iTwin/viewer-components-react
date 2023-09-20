/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const crossEnv = require("cross-env");
const path = require("path").resolve(__dirname, "../../../../apps/test-viewer");
const watch = process.argv[2] && process.argv[2] === "--watch";
const scriptName = watch ? "start:dev" : "start:dev:no-watch";
const options = watch ? undefined : { shell: true };

crossEnv([
  'IMJS_DEMO_CLIENT=true',
  'IMJS_AUTH_CLIENT_REDIRECT_URI="http://localhost:3000/signin-callback"',
  'IMJS_AUTH_CLIENT_LOGOUT_URI="http://localhost:3000"',
  'IMJS_AUTH_CLIENT_SCOPES="imodelaccess:read imodels:read realitydata:read"',
  'IMJS_AUTH_AUTHORITY="https://ims.bentley.com"',
  'IMJS_ITWIN_ID="b27dc251-0e53-4a36-9a38-182fc309be07"',
  'IMJS_IMODEL_ID="f30566da-8fdf-4cba-b09a-fd39f5397ae6"',
  'SKIP_PREFLIGHT_CHECK=true',
  'USE_FAST_SASS=true',
  'USE_FULL_SOURCEMAP=true',
  'TRANSPILE_DEPS=false',
  'IMJS_ENABLED_WIDGETS="tree-widget"',
  `npm run ${scriptName} --prefix ${path}`,
], options);
