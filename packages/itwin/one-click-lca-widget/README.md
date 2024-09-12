# @itwin/one-click-lca-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The One Click LCA widget is a UI component for iTwin Viewer applications that simplifies how users (and developers) interface with the [Carbon Calculation One Click LCA APIs](https://developer.bentley.com/apis/carbon-calculation/overview/).
The one-click-lca-react package provides a UiProvider class, `OneClickLCAProvider`, which can be passed into the `uiProviders` prop of the iTwin Viewer's `<Viewer />` component.

## Getting Started

This is not a standalone UI and requires a parent iTwin Viewer application to work as intended.
A guide on how to create a basic iTwin Viewer application can be found [here](https://www.itwinjs.org/learning/tutorials/develop-web-viewer).
This package provides a viewer _widget_. Documentation on how to add a widget to your application can be found [here](https://developer.bentley.com/tutorials/itwin-viewer-hello-world/#2-your-first-ui-widget).

## Permissions and Scopes

The SPA client used by your iTwin viewer must have the `itwin-platform` scope.

Users must have the `imodels_read` and `insights_view` [permissions](https://developer.bentley.com/apis/carbon-calculation/operations/create-oneclicklca-job/#authorization) assigned at either the Project or iModel level. Additional instruction on how to create roles and assign permissions can be found in the [iTwin Platform Projects API documentation](https://developer.bentley.com/apis/projects/tutorials/).

## Sample usage

```tsx
import { OneClickLCAProvider } from "@itwin/one-click-lca-react";

<Viewer
  ...
  uiProviders={[new OneClickLCAProvider()]}
/>
```
