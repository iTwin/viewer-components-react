# iModel.js React Hooks

### Description

React hooks for low-overhead and idiomatic imodeljs usage in React.

Currently, the `useMarker` and `useFeatureOverrides` hooks.

## useMarker

```tsx
import React from "react";
import { IModelJsViewProvider, useMarker } from "@bentley/imodeljs-react-hooks";
import mySvgUrl from "my.svg";
import { Point2d } from "@bentley/geometry-core";

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

| Property   | Type                                      | Description                                                     | Default                                         |
| ---------- | ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| viewFilter | `((vp: Viewport) => boolean) | undefined` | Filter which vps marker decorations are allowed to be drawn in. | Draw markers in all vps that can be invalidated |

### `useMarker(options: UseMarkerOptions): void`

The options come from the fields of the
`@bentley/imodeljs-frontend`'s Marker class, see its [documentation](https://www.imodeljs.org/reference/imodeljs-frontend/views/marker/?term=marker).

There are however, a few deviations:

| Name in Marker | Type in Marker | Name in useMarker | Type in useMarker                             | Note                                                                                                                                                               |
| -------------- | -------------- | ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| \_scaleFactor  | `Range1dProps` | scaleFactor       | `Range1dProps | undefined`                    | \_scaleFactor as an option, so you can set it without subclassing (since it's protected)                                                                           |
| \_isHilited    | `boolean`      | isHilited         | `boolean | undefined`                         | \_isHilited as an option, so you can set it without subclassing (since it's protected)                                                                             |
| \_hiliteColor  | `ColorDef`     | hiliteColor       | `ColorDef | undefined`                        | \_hiliteColor as an option, so you can set it without subclassing (since it's protected)                                                                           |
| image          | `boolean`      | image             | `string | MarkerImage | Promise<MarkerImage>` | replacement for `Marker.setImage` and `Marker.setImageUrl`, accepts urls, loaded images, and promises to images and invalidates the view when the promise resolves |
| N/A            | N/A            | jsxElement        | `React.ReactElement | undefined`              | like htmlElement, but the JSX Element will create the htmlElement for you (used to override the htmlElement)                                                       |

### How it works

The `IModelJsViewProvider` connects to the IModelApp singleton and allows the hooks to manipulate decorator state in react which is then reflected into the imodel viewport.

## useFeatureOverrides

```tsx
import React, {useState} from "react";
import { FeatureOverrideReactProvider, useFeatureOverrides } from "@bentley/imodeljs-react-hooks";
import { FeatureSymbology } from "@bentley/imodeljs-frontend";
import { RgbColor } from "@bentley/imodeljs-common";
import { myAppState, C } from "./appState";

const A = () => {
  useFeatureOverrides({
    overrider: (overrides, viewport) => {
      overrides.overrideModel(myAppState.imodelconn.id, FeatureSymbology.Appearance.fromJSON({
        rgb: new RgbColor(250,0,0),
        transparent: 0.5,
      }), true);
    }
  }, []);
  return null;
};

const B = () => {
  const [isHovered, setIsHovered] = useState(false);
  useFeatureOverrides({
    overrider: (overrides, viewport) => {
      if (isHovered)
        overrides.overrideElement(myAppState.selectedElementId, FeatureSymbology.Appearance.fromJSON({
          rgb: new RgbColor(0,0,250),
          transparency: 0,
        }), true);
    }
  }, [isHovered]);
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{height: "40px", width: "40px"}}
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
| completeOverride | `boolean | undefined`                                                 | whether to skip previous components in the component tree and go straight to this one, useful for performance savings when you're overriding everything and allowing earlier components to add overrides would be redundant. |

### `FeatureOverrideReactProvider`

| Property   | Type                                            | Description                                                                  | Default                           |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| viewFilter | `((viewport: Viewport) => boolean) | undefined` | A predicate function which filters which viewports to apply the overrides in | apply overrides in every viewport |

## Maintainers

- [Mike Belousov](mailto:Mike.Belousov@bentley.com)
- [Arun George](mailto:Arun.George@bentley.com)

## Planned

- `useTool` hook so your tools can take advantage of changes with react state just like `useMarker` does
