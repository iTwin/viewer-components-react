# @bentley/tree-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The tree-widget-react package provides a UiProvider class - `TreeWidgetUiItemsProvider` - which can be passed into the `uiProviders` prop of the iTwin Viewer's `<Viewer />` component to provide access to the following features:

- Spatial Containment Tree

- Models Tree

- Categories Tree

The package also provides the widget controller class - `TreeWidgetControl` - as well as the underlying component - `TreeWidgetComponent` - which you can wrap within your own custom UiProvider and pass in your own custom trees to display.

## Sample usage

Initializing `TreeWidget` before using the `TreeWidgetUiItemsProvider` is **required**

```ts
const handleOnIModelAppInit = async () => {
    await TreeWidget.initialize(IModelApp.i18n);
  };

<Viewer
  ...
  onIModelAppInit={handleOnIModelAppInit}
  uiProviders={[new TreeWidgetUiItemsProvider(props)]}
/>
```
