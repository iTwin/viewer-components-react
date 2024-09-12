# @itwin/reports-config-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.
The Reports Config widget is a UI component for iTwin Viewer applications that simplifies how users (and developers) interface with the [Reporting Platform APIs](https://developer.bentley.com/apis/insights/overview/). This widget is one piece of the Reporting story that focuses on the configuration of Reports and the extraction thereof. It complements the [Grouping & Mapping Widget](https://www.npmjs.com/package/@itwin/grouping-mapping-widget).
The reports-config-widget-react package provides a UiProvider class - `ReportsConfigProvider` - which can be passed into the `uiProviders` prop of the iTwin Viewer's `<Viewer />` component.

## Getting Started

This is not a standalone UI and requires a parent iTwin Viewer application to work as intended.
A guide on how to create a basic iTwin Viewer application can be found here: <https://www.itwinjs.org/learning/tutorials/develop-web-viewer/>.
This package provides a viewer 'widget'. Documentation on how to add a widget to your application can be found here: <https://developer.bentley.com/tutorials/itwin-viewer-hello-world/#2-your-first-ui-widget>.

## Permissions and Scopes

The SPA client used by your iTwin viewer must have the `itwin-platform` scope.

In addition, users must have the `imodels_read` and `imodels_write` [permissions](https://developer.bentley.com/apis/insights/operations/create-mapping/#authorization) assigned at either the Project or iModel level. Further instruction on how to create roles and assign permissions can be found in the [iTwin Platform Projects API documentation](https://developer.bentley.com/apis/projects/tutorials/).

## Sample usage

### Call ReportsConfigWidget.initialize() **_before_** making use of the provider

```ts
import { ReportsConfigProvider, ReportsConfigWidget } from '@itwin/reports-config-widget-react'

...

await ReportsConfigWidget.initialize(IModelApp.localization);

<Viewer
  ...
  uiProviders={[new ReportsConfigProvider()]}
/>
```
