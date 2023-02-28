/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { DEFAULT_PROPERTY_GRID_RULESET, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { PropertyGrid } from "./PropertyGrid";
import "../customUI/GroupQueryBuilderCustomUI.scss";
import { PropertyGridWrapperContext } from "../context/PropertyGridWrapperContext";
import { QueryBuilder } from "../QueryBuilder";
import type { KeySet } from "@itwin/presentation-common";
import type { IModelConnection } from "@itwin/core-frontend";

interface PropertyGridWrapperState {
  dataProvider?: PresentationPropertyDataProvider;
}

interface PropertyProps {
  keys: KeySet;
  imodel?: IModelConnection;
}

/* This approach uses PresentationPropertyDataProvider to all the work of querying the backend and
   providing the content to the PropertyGrid component. */
export class PropertyGridWrapper extends React.Component<
PropertyProps,
PropertyGridWrapperState
> {
  static override contextType = PropertyGridWrapperContext;
  constructor(props: PropertyProps | Readonly<PropertyProps>) {
    super(props);
    this.state = {};
  }

  private createPropertyDataProvider = (keys: KeySet, imodel: IModelConnection): PresentationPropertyDataProvider => {
    const dataProvider = new PresentationPropertyDataProvider({
      imodel,
      ruleset: DEFAULT_PROPERTY_GRID_RULESET,
    });
    dataProvider.keys = keys;
    dataProvider.isNestedPropertyCategoryGroupingEnabled = true;
    return dataProvider;
  }

  private createDataProvider() {
    if (!this.props.imodel || this.props.keys.isEmpty) {
      this.setState({ dataProvider: undefined });
      return;
    }

    const dataProvider = this.createPropertyDataProvider(
      this.props.keys,
      this.props.imodel
    );
    this.context.setQueryBuilder(new QueryBuilder(dataProvider));

    this.setState({ dataProvider });
  }

  public override componentDidMount() {
    this.createDataProvider();
  }

  public override componentDidUpdate(prevProps: PropertyProps) {
    if (prevProps.keys === this.props.keys) {
      return;
    }

    this.createDataProvider();
  }

  public override render() {
    const dataProvider = this.state.dataProvider;
    return (
      <>
        {dataProvider && <PropertyGrid dataProvider={dataProvider} />}
        {!dataProvider && (
          <div className="gmw-select-element-hint">
            <span>Select an element to see its properties.</span>
          </div>
        )}
      </>
    );
  }
}
