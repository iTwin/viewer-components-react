# @bentley/imodel-content-tree

Copyright © Bentley Systems, Incorporated. All rights reserved.

The imodel-content-tree package provides an `IModelContentTree` component which displays a hierarchy with content of a given `IModelConnection`.

## Resulting hierarchy

- Root Subject
  - Child Subjects
    - Target Model
      - Spatial Categories of top-assemblies in the Model (if model is a GeometricModel3d)
        - Top-assemblies in the model and category
          - Child elements of the assembly
      - Drawing Categories of top-assemblies in the Model (if model is a GeometricModel2d)
        - Top-assemblies in the model and category
          - Child elements of the assembly
      - Top-assemblies in the Model (if model is neither GeometricModel3d nor GeometricModel2d)
        - Child elements of the assembly

In addition, for every modeled element we show content of the model as children for the element's node.

More details about Subjects and Models can be found here:
- https://www.imodeljs.org/bis/intro/information-hierarchy/
- https://www.imodeljs.org/bis/intro/organizing-models-and-elements/

More details about the hierarchy can be found in the [presentation ruleset JSON file](./src/components/Hierarchy.json).

## Pre-requisites

The component uses `PresentationTreeDataProvider` for creating the hierarchy. This means it has the following pre-requisites:

- Backend must support Presentation RPC protocol
- Frontend must [initialize Presentation frontend](https://www.imodeljs.org/learning/presentation/setup/#frontend)

## Sample usage

### IModelContentTreeProps

The only required prop for the component is the `iModel` whose content we want the tree to display. Additional props of a `div` element are also supported: `className`, `style`, etc. These attributes are assigned to a `div` that wraps the tree.

```ts
export interface IModelContentTreeProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "children"> {
  iModel: IModelConnection;
}
```
### Example

```ts
import * as React from "react";
import { IModelContentTree } from "@bentley/imodel-content-tree";
import { IModelConnection } from "@bentley/imodeljs-frontend";

interface MyComponentProps {
  iModel: IModelConnection;
}

function MyComponent(props: MyComponentProps) {
  return <IModelContentTree
    iModel={props.iModel}
    className="my-component-tree"
  />;
};
```
