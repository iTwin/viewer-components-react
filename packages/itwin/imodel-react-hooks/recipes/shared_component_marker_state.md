# Sharing State between Markers and Components

Probably the biggest reason to use a Marker via a hook is to have easy access to component state in your marker.
Suppose you want to have [`bwc-react`](http://ux.bentley.com/)'s [`ExpandableBlock`](https://ux.bentley.com/bwc/components/expandable-block.html) component for
editing the properties of some "pin" in the view in your application. And you want the expandable block to open
when the marker is hovered, and the marker to be highlighted when the block is hovered.

With a traditional imodeljs Marker subclass, gluing the marker state to the component state is complicated. You'll need to construct the marker with a reference to the state dispatchers that you'll need.
You'll also need some stable accessors that return the current state (which is best done using a mutable ref from `useRef`), and you'll need to remove the marker on the component's unmount. Here is a minimal example.

```tsx
import React from "react";
import { Marker, Decorator, DecorateContext } from "@itwin/core-frontend";
import { Point3d, Point2d } from "@itwin/core-geometry";
import { ExpandableBlock, LabeledInput } from "@itwin/itwinui-react";
import myPinImageUrl from "pin_image.svg";

interface PinProps {
  worldLoc: Point3d;
  name: string;
  setName(newName: string): void;
}

interface ReactState {
  isExpanded: boolean;
  setIsExpanded(inVal: boolean): void;
  setIsHilited?(inVal: boolean): void;
}

class PinDecorator implements Decorator {
  public markers: Set<Marker> = new Set();
  decorate(context: DecorateContext) {
    this.markers.entries.forEach(m => m.addDecoration(context));
  }
}

class PinMarker extends Marker {
  private _reactCtx: React.RefObject<ReactState>;

  public constructor(
    worldLoc: XYAndZ,
    size: XAndY,
    reactContext: React.RefObject<ReactState>
  ) {
    super(worldLoc, size);
    this._reactCtx = reactContext;
    this._reactCtx.setIsHilited = (newVal) => (this._isHilited = newVal);
  }

  onMouseEnter(ev) {
    this._reactCtx.setIsExpanded(true);
    return super.onMouseEnter(ev);
  }

  onMouseLeave(ev) {
    this._reactCtx.setIsExpanded(true);
    return super.onMouseLeave(ev);
  }
}

const pinDecoratorInstance = new PinDecorator();
IModelApp.viewManager.addDecorator(pinDecoratorInstance);

const PinPropertyEditorBlock = (props: PinProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const markerRef = React.useRef<Marker>();

  const markerStateBridge = React.useRef<ReactState>({
    isExpanded,
    setIsExpanded,
  });

  // sync markerStateBridge
  React.useEffect(() => {
    markerStateBridge.current.isExpanded = isExpanded;
    // setIsExpanded is guaranteed by react to be stable so doesn't need to be synced
  }, [isExpanded])

  // add the actual marker
  React.useEffect(() => {
    const markerRef.current = new PinMarker(props.worldLoc, {x: 20, y: 20}, );
    pinDecoratorInstance.markers.add(markerRef.current);
    // delete on unmount
    return () => pinDecoratorInstance.markers.delete(markerRef.current);
  }, []);

  // note, this can be highly unperformant, either use useMarker or manually manage invalidation
  React.useEffect(() => {
    // invalidate view on renders
    const invalidate = () =>
      IModelApp?.viewManager.getFirstOpenView()?.invalidateDecorations();
    invalidate();
    // also invalidate on unmount
    return invalidate;
  });

  return (
    <div
      onMouseEnter={() => {
        setIsExpanded(true);
        markerStateBrige.current.setIsHilited?.(true);
      }}
      onMouseLeave={() => {
        setIsExpanded(false);
        markerStateBrige.current.setIsHilited?.(false);
      }}
    >
      <ExpandableBlock title={props.name} isExpanded={isExpanded}>
        <LabeledInput
          label={"Name"}
          value={props.name}
          onChange={(e) => props.setName(e.currentTarget.value)}
        />
      </ExpandableBlock>
    </div>
  );
};
```

That's a lot, and might be hard to understand. You've got a shared state bridge between
the component and its marker, and a bunch of boiler plate to get your marker into the decorator
system. It actually gets worse if we want React to re-render on changes to the marker.
We would need to add state in React, and have the marker send all changes of itself
to that React state. We won't be doing that here.

Instead, let's use a `useMarker`, and since it's in the component body,
we can reference all of our React state anywhere in the marker logic naturally.

```tsx
import React from "react";
import { useMarker } from "@itwin/imodel-react-hooks";
import { Point3d, Point2d } from "@itwin/core-geometry";
import { ExpandableBlock, LabeledInput } from "@itwin/itwinui-react";
import myPinImageUrl from "pin_image.svg";

interface PinProps {
  worldLoc: Point3d;
  name: string;
  setName(newName: string): void;
}

const PinPropertyEditorBlock = (props: PinProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  useMarker({
    worldLocation: props.worldLoc,
    image: myPinImageUrl,
    size: Point2d.create(30, 30),
    imageSize: Point2d.create(30, 30),
    isHilited: isExpanded,
    onMouseEnter: () => setIsExpanded(true),
    onMouseLeave: () => setIsExpanded(false),
  });

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <ExpandableBlock title={props.name} isExpanded={isExpanded}>
        <LabeledInput
          label={"Name"}
          value={props.name}
          onChange={(e) => props.setName(e.currentTarget.value)}
        />
      </ExpandableBlock>
    </div>
  );
};
```

Here, we no longer have the indirection, and it's much shorter.

#### Notes

One thing that is easier with traditional subclassing is accessing overridden methods.
This is because JavaScript has syntactic sugar for it while using classes, the `super` keyword.
With it, you can do something like:

```tsx
class MyMarker extends Marker {
  onMouseEnter(ev) {
    //set Expanded
    return super.onMouseEnter(ev);
  }
}
```

We provide a small `getSuper(this)` utility, which works like the `super` keyword.

```tsx
import { getSuper } from "@itwin/imodel-react-hooks";

useMarker({
  onMouseEnter() {
    getSuper(this).onMouseEnter();
  },
});
```

In a lot of cases where you need enough control to need `super`,
it's actually better to not reuse the overidden behavior and control it yourself. Such
as when controlling `isHilited`. Normally onMouseEnter will set the marker's protected `_isHilited`
value, but you can control it like this instead:

```tsx
const [isHilited, setIsHilited] = React.useState(false);

useMarker({
  isHilited,
  onMouseEnter: () => setIsHilited(true),
  onMouseLeave: () => setIsHilited(false),
});
```
