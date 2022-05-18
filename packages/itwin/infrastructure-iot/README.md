# @itwin/infrastructure-iot-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The infrastructure-iot-react package provides pre-built UI components and data services to integrate Infrastructure IoT real-time sensor data into an iTwin application.

The package aims to provide all functionality out-of-the-box to reduce the amount of integration code and speed up development.

## Prerequisites

To fully use this package, an existing IoT project with some configured sensors is required.

You can access the Bentley Infrastructure IoT portal at [https://app.sensemetrics.com](https://app.sensemetrics.com) to set up your IoT project and configure your sensors. Please see the Bentley Infrastructure IoT [help center](https://support.infrastructureiot.com/hc/en-us/articles/208406836-Overview) for additional support and information.

## Required permissions and scopes

The application used by your iTwin viewer must have the `users:read` scope enabled for this package to work correctly, in addition to a list of standard scopes required by all iTwin applications.

Please see the iTwin Platform [developer documentation](https://developer.bentley.com/apis/) for instructions on how to configure scopes for your iTwin applications.

## Usage

### What to add in your iTwin application

You can initialize this package in the `src/App.tsx` file, which also initializes the iTwin Viewer React component.

There are three things that you need to do:

* Initialize the `InfrastructureIotConfigService` after the iModel is connected and a view is opened
* Register the `InfrastructureIotItemsProvider` in the Viewer component
* Register the `InfrastructureIotToolAdmin` in the Viewer component

Example of this is provided below:

```ts
import {
  InfrastructureIotConfigService,
  InfrastructureIotItemsProvider,
  InfrastructureIotToolAdmin
} from "./iot-extension/PublicApi";

...

const onIModelConnected = () => {
  IModelApp.viewManager.onViewOpen.addOnce(async () => {
    await InfrastructureIotConfigService.initialize();
  });
};

return (
  <Viewer
    ...
    onIModelConnected={onIModelConnected}
    uiProviders={[new InfrastructureIotItemsProvider()]}
    toolAdmin={InfrastructureIotToolAdmin}
  />
);
```

### Supplying configuration parameters to InfrastructureIotConfigService

When initializing the `InfrastructureIotConfigService` with the `initialize()` method, you can supply an optional configuration object with the following properties:

* **environment**: Can be either `production` (default) or `development`, and controls which Infrastructure IoT portal environment the package should connect to
* **enableLogging**: Can be `true` or `false` (default). If enabled, will print verbose logging in the browser console, for debugging and troubleshooting

### Widgets, markers and decorations provided by package

After initializing this package as described above, the following pre-built UI components will be automatically added to your iTwin application:

#### InfrastructureIotDeviceConfigurationWidget Widget

* Added to the `DefaultFrontstage`, in the `StagePanelLocation.Right` position (right sidebar widget location)
* Provides a user interface for selecting IoT sensors to display in the iTwin UI, as well as configuring sensor display options

#### InfrastructureIotDeviceDataWidget Widget

* Added to the `DefaultFrontstage`, in the `StagePanelLocation.Right` position (right sidebar widget location)
* Provides a user interface for viewing detailed sensor metadata, alerts and recent readings for the selected sensor
* Provides a user interface for performing alert actions, such as acknowledging, snoozing or disabling them
* Provides a user interface for selecting which data points should be displayed for each sensor

#### InfrastructureIotDeviceGraphWidget Widget

* Added to the `DefaultFrontstage`, in the `StagePanelLocation.Bottom` position (bottom full-width widget location)
* Provides a user interface for viewing selected sensor data as a time series graph, with configurable date ranges

#### IoT Sensor Markers

* When the *Markers* display style is selected in the `InfrastructureIotDeviceConfigurationWidget` widget, a marker will appear for each selected IoT sensor in the iTwin UI, placed over the element associated with the sensor
* Each marker will be color-coded based on its sensor's alert status
* You can hoover over each marker to view a tooltip with sensor information and data points

#### IoT Sensor Element Decorators

* When the *Elements* display style is selected in the `InfrastructureIotDeviceConfigurationWidget` widget, each element that has an associated IoT sensor will be color-coded based on its sensor's alert status
* The tooltips for these elements will be overridden from their default ones to show sensor information and data points
