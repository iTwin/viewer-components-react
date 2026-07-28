# @itwin/geo-tools-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The geo-tools-react provides various React components and iTwin.js tools to support GIS workflows.

## Usage

### What to add in your iTwin AppUI based application

With a few short lines, you can add the Geo Address Search tool to your app.

### Call GeoTools.initialize() **_before_** making use of the providers

```ts
import { GeoTools } from "@itwin/geo-tools-react";
...
await GeoTools.initialize(IModelApp.localization);
```

### Register Provider

```ts
import { UiItemsManager } from "@itwin/appui-abstract";
import { GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
...
UiItemsManager.register(new GeoToolsAddressSearchProvider());
```
