# @bentley\markup-frontstage-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The markup-frontstage-react provides the Markup Frontstage for adding, editing, deleting markup elements in iModel.js application.

## MarkupFrontstageProvider

FrontstageProvider object that requires ViewState, IModelConnection, Editable boolean flag whether or not the markup elements are editable, ConfigurableUiControlContructor, Svg string as optional, ViewElementDictionary with 9 zone layouts to be added in the frontstage as optional, EmphasizeElementsProps as optional to instantiate. It's onAddMarkupEvent allows to raise event on adding markup, onstopMarkupEvent allows to raise event on stopping markup. Additionally there's onCloseAsync and onSaveAsync properties to be called to close the Frontstage and Save the Markup data respectively.

## MarkupSettingsPanel

It is the flyover component used to set colors, width, opacity of the markup element by MarkupFrontstage Provider.

## MarkupToolWdiget

It is the vertical toolbar component placed at left top corner of nine-zone UI in MarkupFrontstage, it includes select, drawing tools like ( rectangle, circle, polygon, line, cloud, sketch, arrow), distance to create markup elements on MarkupFrontstage.

## SavedView

It is an object that stores camera settings, view flags, and markup.

### Usage Requirements

1. Ensure @bentley/markup-frontstage-react is specified as a dependency in host application's package.json.

2. Add MarkupFrontstage using FrontstageManager either by setActiveFrontstageDef, or addFrontstageFrovider or openNestedFrontstageDef. Example for adding as openNestedFrontstage provided below.

#### This frontstage example assumes all necessary framework such as UiFramework, UiCore has already been initialized.

```ts
MakrupFrontstage.initialize(new I18N());
const markupFrontstageProvider = new MarkupFrontstageProvider(
  viewState,
  imodelConnection,
  isEditable,
  ConfigurableUiControlContructor,
  svg,
  viewElementDictionary,
  emphasizedElementsProps
);
markupFrontstageProvider.onAddMarkupEvent.addListener(
  (args: AddMarkupEventArgs) => {
    // execute callback handler here to add markup.
  }
);
markupFrontstageProvider.onStopMarkupEvent.addListener(() => {
  // execute callback handler here to stop markup.
});
const markupFrontstageDef = markupFrontstageProvider.initializeDef();
FronstageManager.openNestedFrontstage(markupFrontstageDef);
```
