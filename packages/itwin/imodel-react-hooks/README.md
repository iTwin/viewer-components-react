# iModel.js React Hooks

### Description

React hooks for low-overhead and idiomatic imodeljs usage in React where appropriate.

Currently, the [`useMarker`](#useMarker), and [`useFeatureOverrides`](#useFeatureOverrides) hooks.

## When and when not to use hooks

React's hooks are fun, and often great, but they require you to deal with state in a scope that will
be thrown away, to which references would be mostly memory leaks and bugs. Because of this, you need
to stabilize your functions (useCallback), keep track of dependencies manually, etc. And because of this,
you cannot define a class with access to React state easily (in a functional component). Although this
package did at one point have a hook for using a class directly in a functional component, managing references
to outer state requires patterns that thrash prototype chain access caches in modern JS engines and are pretty much a bad
idea. So it must be said:

**_if you are using a class that needs access to state in React, prefer a class component_**.

Michael Belousov wrote [an article](https://medium.com/imodeljs/provider-local-class-pattern-dc44bab33144) on the iModel.js community
blog going further in depth than that.

The hooks in this package are either for simple use cases with boilerplate reduction ([`useMarker`](#useMarker)),
or places where you aren't dealing directly with a dedicated class instance ([`useFeatureOverrides`](#useFeatureOverrides)).
Otherwise, try this pattern for integrating any class into your React state:

```tsx
import React, { useContext } from "react";
import { UserContext, UserContextType } from "./MyApplicationsContexts";
import { PrimitiveTool, BeButtonEvent } from "@itwin/core-frontend";

const ToolProvider = () => {
  const userContext = useContext(UserContext);
  return <InnerToolProvider userContext={userContext} />;
};

class InnerToolProvider extends React.Component<{
  userContext: UserContextType;
}> {
  MyTool = (() => {
    const componentThis = this;
    return class MyTool extends PrimitiveTool {
      static toolId = "myTool";

      onDataButtonDown(ev: BeButtonEvent) {
        const user = componentThis.props.userContext.name;
        console.log(`${user} pressed here: ${ev.point}`);
        return Promise.resolve(EventHandled.Yes);
      }
    };
  })();

  componentWillMount() {
    IModelApp.tools.register(this.MyTool);
  }
  componentWillUnmount() {
    IModelApp.tools.unRegister(this.MyTool.toolId);
  }
  render() {
    return null;
  }
}
```

The above works with inheritance, be it in or out of react state, abstract classes, etc. Tools,
heavy-duty markers, and other iModel.js subclass-style APIs should prefer this technique.

## useMarker

```tsx
import React from "react";
import { IModelJsViewProvider, useMarker } from "@itwin/imodel-react-hooks";
import mySvgUrl from "my.svg";
import { Point2d } from "@itwin/core-geometry";

const MyPin = (props) => {
  const [clicked, setClicked] = React.useState(false);

  useMarker({
    worldLocation: props.position,
    image: mySvgUrl,
    isHilited: clicked,
    imageSize: Point2d.create(10, 10),
    size: Point2d.create(10, 10),
    onMouseButton: () => {
      setClicked((prev) => !prev);
      return true;
    },
  });

  return <span>{props.name}</span>;
};

const MyApp = (props) => {
  const [pins, setPins] = React.useState([]);

  React.useEffect(() => {
    fetchPins().then((resp) => setPins(resp.data));
  }, []);

  return (
    <IModelJsViewProvider>
      <YourConfiguredIModelJsView />
      <Sidebar>
        {pins.map((pinProps) => (
          <MyPin {...pinProps} />
        ))}
      </Sidebar>
    </IModelJsViewProvider>
  );
};
```

IModelJsViewProvider allows descendent components to use the useMarker hook, which draws a marker with the given options,
which follow the imodeljs Marker API with minor tweaks. View invalidation is handled for you efficiently; you can pass promises
to images, and the view will be invalidated for you after it resolved.
You can also pass JSX expressions to useMarker's `jsxElement` option and it
will be rendered by react and update correctly.

See examples in the [Recipes](recipes) folder.

### `IModelJsViewProvider`

| Property   | Type                                       | Description                                                     | Default                                         |
| ---------- | ------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------- |
| viewFilter | `((vp: Viewport) => boolean) \| undefined` | Filter which vps marker decorations are allowed to be drawn in. | Draw markers in all vps that can be invalidated |

### `useMarker(options: UseMarkerOptions): void`

The options come from the fields of the
`@bentley/imodeljs-frontend`'s Marker class, see its [documentation](https://www.imodeljs.org/reference/imodeljs-frontend/views/marker/?term=marker).

There are however, a few deviations:

| Name in Marker | Type in Marker | Name in useMarker | Type in useMarker                                       | Note                                                                                                                                                               |
| -------------- | -------------- | ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| \_scaleFactor  | `Range1dProps` | scaleFactor       | `Range1dProps \| undefined`                             | \_scaleFactor as an option, so you can set it without subclassing (since it's protected)                                                                           |
| \_isHilited    | `boolean`      | isHilited         | `boolean \| undefined`                                  | \_isHilited as an option, so you can set it without subclassing (since it's protected)                                                                             |
| \_hiliteColor  | `ColorDef`     | hiliteColor       | `ColorDef \| undefined`                                 | \_hiliteColor as an option, so you can set it without subclassing (since it's protected)                                                                           |
| image          | `boolean`      | image             | `string \| MarkerImage \| Promise<MarkerImage>`         | replacement for `Marker.setImage` and `Marker.setImageUrl`, accepts urls, loaded images, and promises to images and invalidates the view when the promise resolves |
| N/A            | N/A            | jsxElement        | `React.ReactElement \| undefined`                       | like htmlElement, but the JSX Element will create the htmlElement for you (used to override the htmlElement)                                                       |
| size           | `Point2d`      | size              | `Point2d \| {x: number, y: number} \| [number, number]` | for simpler code, useMarker can convert json point representations (arrays or objects containing an `x` and `y` prop) for you.                                     |
| imageSize      | `Point2d`      | imageSize         | `Point2d \| {x: number, y: number} \| [number, number]` | for simpler code, useMarker can convert json point representations (arrays or objects containing an `x` and `y` prop) for you.                                     |
| imageOffset    | `Point2d`      | imageOffset       | `Point2d \| {x: number, y: number} \| [number, number]` | for simpler code, useMarker can convert json point representations (arrays or objects containing an `x` and `y` prop) for you.                                     |

### How it works

The `IModelJsViewProvider` connects to the IModelApp singleton and allows the hooks to manipulate decorator state in react which is then reflected into the imodel viewport.

## useFeatureOverrides

```tsx
import React, { useState } from "react";
import {
  FeatureOverrideReactProvider,
  useFeatureOverrides,
} from "@itwin/imodel-react-hooks";
import { FeatureSymbology } from "@itwin/core-frontend";
import { RgbColor } from "@bentley/imodeljs-common";
import { myAppState, C } from "./appState";

const A = () => {
  useFeatureOverrides(
    {
      overrider: (overrides, viewport) => {
        overrides.overrideModel(
          myAppState.imodelconn.id,
          FeatureSymbology.Appearance.fromJSON({
            rgb: new RgbColor(250, 0, 0),
            transparent: 0.5,
          }),
          true
        );
      },
    },
    []
  );
  return null;
};

const B = () => {
  const [isHovered, setIsHovered] = useState(false);
  useFeatureOverrides(
    {
      overrider: (overrides, viewport) => {
        if (isHovered)
          overrides.overrideElement(
            myAppState.selectedElementId,
            FeatureSymbology.Appearance.fromJSON({
              rgb: new RgbColor(0, 0, 250),
              transparency: 0,
            }),
            true
          );
      },
    },
    [isHovered]
  );
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ height: "40px", width: "40px" }}
    />
  );
};

const MyApp = (props) => (
  <FeatureOverrideReactProvider>
    <A>
      <B />
      <C />
    </A>
  </FeatureOverrideReactProvider>
);
```

`FeatureOverrideReactProvider` allows descendent components to set cascading feature overrides in viewports, and
the overrides are executed in tree order of the components, so in the above example, overrides from `C` override `B`, which
overrides `A`. The `overrider` property of `UseFeatureOverrides` is an analog for `FeatureOverrideProvider.addFeatureOverrides` which you
would implement when adding your own vanilla JavaScript IModelJS FeatureOverrideProvider. This hook is useful for when you want multiple
components to be able to control one `FeatureOverrideProvider` in cooperation, or when you don't want to manage notifying the viewport to
refresh overrides yourself when you can do it on react state changes.

There are no recipes for this hook yet, but there is room for one to be contributed.

### `useFeatureOverrides(options: UseFeatureOverridesOpts, deps: any[]): void`

| Option           | Type                                                                  | Note                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| overrider        | `(overrides: FeatureSymbology.Overrides, viewport: Viewport) => void` | the code to run in the `FeatureOverrideProvider.addFeatureOverrides` function for this component                                                                                                                             |
| completeOverride | `boolean \| undefined`                                                | whether to skip previous components in the component tree and go straight to this one, useful for performance savings when you're overriding everything and allowing earlier components to add overrides would be redundant. |

### `FeatureOverrideReactProvider`

| Property   | Type                                             | Description                                                                  | Default                           |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------- |
| viewFilter | `((viewport: Viewport) => boolean) \| undefined` | A predicate function which filters which viewports to apply the overrides in | apply overrides in every viewport |
