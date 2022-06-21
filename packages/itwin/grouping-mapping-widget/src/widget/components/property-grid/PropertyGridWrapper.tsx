/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { PresentationPropertyDataProvider } from "@itwin/presentation-components";

import type { PropertyProps } from "../../../api/GroupQueryBuilderApi";
import { GroupQueryBuilderApi } from "../../../api/GroupQueryBuilderApi";
import { PropertyGrid } from "./PropertyGrid";
import "../GroupQueryBuilder.scss";
import { GroupQueryBuilderContext } from "../context/GroupQueryBuilderContext";

interface PropertyGridWrapperState {
  dataProvider?: PresentationPropertyDataProvider;
}

/* This approach uses PresentationPropertyDataProvider to all the work of querying the backend and
   providing the content to the PropertyGrid component. */
export class PropertyGridWrapperApp extends React.Component<
PropertyProps,
PropertyGridWrapperState
> {
  static override contextType = GroupQueryBuilderContext;
  constructor(props: PropertyProps | Readonly<PropertyProps>) {
    super(props);
    this.state = {};
  }

  private createDataProvider() {
    if (!this.props.imodel || this.props.keys.isEmpty) {
      this.setState({ dataProvider: undefined });
      return;
    }

    const dataProvider = GroupQueryBuilderApi.createPropertyDataProvider(
      this.props.keys,
      this.props.imodel
    );
    this.context.queryBuilder.dataProvider = dataProvider;

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
          <div className="select-element-hint">
            <span>Select an element to see its properties.</span>
          </div>
        )}
      </>
    );
  }
}
