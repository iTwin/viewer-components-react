# @itwin/ec3-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The EC3 widget is a UI component for iTwin Viewer applications that simplifies how users (and developers) interface with the [Carbon Calculation EC3 APIs](https://developer.bentley.com/apis/carbon-calculation/overview/).
The ec3-widget-react package provides a UiProvider class, `EC3Provider`, which can be passed into the `uiProviders` prop of the iTwin Viewer's `<Viewer />` component.

## Getting Started

This is not a standalone UI and requires a parent iTwin Viewer application to work as intended.
A guide on how to create a basic iTwin Viewer application can be found [here](https://www.itwinjs.org/learning/tutorials/develop-web-viewer).
This package provides a viewer _widget_. Documentation on how to add a widget to your application can be found [here](https://developer.bentley.com/tutorials/itwin-viewer-hello-world/#2-your-first-ui-widget).

## Permissions and Scopes

The SPA client used by your iTwin viewer application must have allowed scopes `insights:read` and `insights:write`, found under the Reporting & Insights category.
Users must have the `carbon_calculate` and `insights_view` [permissions](https://developer.bentley.com/apis/carbon-calculation/operations/create-oneclicklca-job/#authorization) assigned at either the Project or iModel level. Additional instruction on how to create roles and assign permissions can be found in the [iTwin Platform Projects API documentation](https://developer.bentley.com/apis/projects/tutorials/).

## Sample usage

You first need to create an OAuth application in https://buildingtransparency.org/ec3/manage-apps/developers.
Add the EC3Provider to UI providers using your Client Id and Redirect URI in App.tsx.

```tsx
import { EC3Provider } from "@itwin/ec3-widget-react";
...

const overridenStrings = new Map()
  .set("defaultStringKey","customLocalizedString");

await EC3Widget.initialize({
  localization: IModelApp.localization,
  // this is an optional parameter to override the default strings
  localizationOverrides: overridenStrings
  });

<Viewer
  ...
  uiProviders={[
    new EC3Provider({
      clientId: "...",
      redirectUri: "...",
    }),
  ]}
/>
```

Then handle the redirect using the following code in Index.tsx.

```tsx
import { handleEC3AuthCallback } from "@itwin/ec3-widget-react";

} else if (window.location.pathname === "/callback") {
  handleEC3AuthCallback({
    clientId: "...",
    redirectUri: ".../callback",
  });
} else {
```
