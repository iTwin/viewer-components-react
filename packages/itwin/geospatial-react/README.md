# @itwin/geospatial-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The geospatial-react package contains the GeoSpatialProvider component which provides a widget with two tabs:

- iModel that shows the current model's coordinate system information.
- Reality Data that shows the coordinate system information for the availabile reality datas and the ability to turn any of them on or off.

## Usage

### What to add in your application

With a few short lines, you can add the GeoSpatialProvider to your app.

### Register Provider

```ts
import { GeoSpatialProvider } from "@itwin/geospatial-react";
...
// @todo: better example code here
UiItemsManager.register(new GeoSpatialProvider(() => accessToken, rdClient));
```
