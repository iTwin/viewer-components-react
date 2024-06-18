# Test Viewer App

This application provides test environment for developers working on widgets for ITwin applications.

## Development

Prior to running this app, you will need to [configure environment variables](#environment-variables).

### Running app

`npm start`

### Running app with workspace packages hot reloading

`npm run start:dev`

By default `pnpm` symlinks dependencies to the modules directory. But this causes problems if workspace package `devDependencies` and app `dependencies` have different versions of the same package. To avoid this problem workspace packages should be [injected](https://pnpm.io/package_json#dependenciesmetainjected) into app. However, this breaks hot reloading feature.

In order to restore hot reloading for workspace packages [`linkWorkspaceDeps.js`](./scripts/linkWorkspaceDeps.js) script was added. It sets up watcher for changes in workspace package output and copies changed files to app `node_modules`.

### Enabling/disabling widgets

This app has ability to enable/disable predefined widgets through environment variable. [`IMJS_ENABLED_WIDGETS`](.env.template) variable can be used to specify a list of widgets that should be added to viewer. Widgets supported by this variable are configured in [`UiProvidersConfig.ts`](./src/UiProvidersConfig.ts#L46).

## Environment Variables

Prior to running the app, you will need to add OIDC client configuration to the variables in the .env file:

```
# ---- Authorization Client Settings ----
IMJS_AUTH_CLIENT_CLIENT_ID=""
IMJS_AUTH_CLIENT_REDIRECT_URI = "http://localhost:3000/signin-callback"
IMJS_AUTH_CLIENT_LOGOUT_URI = "http://localhost:3000"
IMJS_AUTH_CLIENT_SCOPES = "imodelaccess:read imodels:read realitydata:read"
```

- You can generate a [test client](https://developer.bentley.com/tutorials/web-application-quick-start/#2-register-an-application) to get started.

- Scopes expected by the viewer are:

  - **Visualization**: `imodelaccess:read`
  - **iModels**: `imodels:read`
  - **Reality Data**: `realitydata:read`

- The application will use the path of the redirect URI to handle the redirection, it must simply match what is defined in your client.

- When you are ready to build a production application, [register here](https://developer.bentley.com/register/).

You should also add a valid iTwinId and iModelId for your user in the this file:

```
# ---- Test ids ----
IMJS_ITWIN_ID = ""
IMJS_IMODEL_ID = ""
```

- For the IMJS_ITWIN_ID variable, you can use the id of one of your existing Projects or Assets. You can obtain their ids via the [Administration REST APIs](https://developer.bentley.com/api-groups/administration/api-reference/).

- For the IMJS_IMODEL_ID variable, use the id of an iModel that belongs to the iTwin that you specified in the IMJS_ITWIN_ID variable. You can obtain iModel ids via the [Data Management REST APIs](https://developer.bentley.com/api-groups/data-management/apis/imodels/operations/get-project-or-asset-imodels/).

- Alternatively, you can [generate a test iModel](https://developer.bentley.com/tutorials/web-application-quick-start/#3-create-an-imodel) to get started without an existing iModel.

- If at any time you wish to change the iModel that you are viewing, you can change the values of the iTwinId or iModelId query parameters in the url (i.e. localhost:3000?iTwinId=myNewITwinId&iModelId=myNewIModelId)
