# @itwin/grouping-mapping-widget

Copyright © Bentley Systems, Incorporated. All rights reserved.
The Grouping Mapping widget is a UI component for iTwin Viewer applications that simplifies how users (and developers) interface with the [Reporting Platform APIs](https://developer.bentley.com/apis/insights/overview/).
The grouping-mapping-widget package provides a UiProvider class - `GroupingMappingProvider` - which can be passed into the `uiProviders` prop of the iTwin Viewer's `<Viewer />` component.

## Getting Started

This is not a standalone UI and requires a parent iTwin Viewer application to work as intended.
A guide on how to create a basic iTwin Viewer application can be found here: <https://www.itwinjs.org/learning/tutorials/develop-web-viewer/>.
This package provides a viewer 'widget'. Documentation on how to add a widget to your application can be found here: <https://developer.bentley.com/tutorials/itwin-viewer-hello-world/#2-your-first-ui-widget>.

## Permissions and Scopes

The SPA client used by your iTwin viewer must have these additional scopes:

- `insights:read`
- `insights:modify`
- `projects:read`

In addition, users must have the `imodels_read` and `imodels_write` [permissions](https://developer.bentley.com/apis/insights/operations/create-mapping/#authorization) assigned at either the Project or iModel level. Further instruction on how to create roles and assign permissions can be found in the [iTwin Platform Projects API documentation](https://developer.bentley.com/apis/projects/tutorials/).

## Sample usage

```tsx
import { GroupingMappingProvider } from "@itwin/grouping-mapping-widget";
<Viewer
  ...
  uiProviders={[new GroupingMappingProvider()]}
/>
```

## UI Configuration

We provide interface to define your own group creation method. You can use your own UI component to create/update query and visualize in the viewer accordingly.

Here is an example of custom extension component:

```tsx
const ProcessFuncExtension = ({
    updateQuery,
    isUpdating,
    resetView,
}: GroupExtensionProps) => {
  return ();
};
```

`updateQuery` is used to run the query and visualize results in the viewer. \
`isUpdating` keeps track of the status of query execution. \
`resetView` enables you to reset the viewer state.

To configure your own extension, you need to give it:

- a `name` as identifier
- a `displayLabel` which will show in the 'Add Group' dropdown list
- a `uiComponent` like above
- an optional `icon`

You can define your extension as following in the GroupingMappingProvider:

```tsx
new GroupingMappingProvider({
  extension: {
    extendsDefault: true,
    extensions: [
      {
        name: "ProcessFunc",
        displayLabel: "Process Functional",
        uiComponent: ProcessFuncExtension,
        icon: <SvgProcess />,
      },
    ],
  },
});
```

`extendsDefault` is used to configure if default extensions (Selection, Search and Manual) will be showed in widget.
