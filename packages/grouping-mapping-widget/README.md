# @itwin/grouping-mapping-widget

Copyright © Bentley Systems, Incorporated. All rights reserved.

The Grouping Mapping widget is a UI component for iTwin Viewer applications that simplifies how users (and developers) interface with the [Reporting Platform APIs](https://developer.bentley.com/apis/insights/overview/).

The grouping-mapping-widget package provides a UiProvider class - `GroupingMappingProvider` - which can be passed into the `uiProviders` prop of the iTwin Viewer's `<Viewer />` component.

## Getting Started

This is not a standalone UI and requires a parent iTwin Viewer application to work as intended.
A guide on how to create a basic iTwin Viewer application can be found here: <https://www.itwinjs.org/learning/tutorials/develop-web-viewer/>.

This package provides a viewer 'widget'. Documentation on how to add a widget to your application can be found here: <https://developer.bentley.com/tutorials/itwin-viewer-hello-world/#2-your-first-ui-widget>.

## Sample usage

```tsx
import { GroupingMappingProvider } from "@itwin/grouping-mapping-widget";

<Viewer
  ...
  uiProviders={[new GroupingMappingProvider()]}
/>
```
