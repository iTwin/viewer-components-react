/*---------------------------------------------------------------------------------------------
 * Copyright (c) 2019 - present Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Ruleset } from "@bentley/presentation-common";
import { SimpleTreeWithRuleset } from "./TreeWithRuleset";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTreeDataProvider } from "@bentley/presentation-components";
import classificationRules from "../rulesets/ClassificationSystems.json";
import { connectIModelConnection } from "@bentley/ui-framework";

export interface ClassificationsTreeProps {
  iModel: IModelConnection;
}

export class ClassificationsTree extends React.Component<
  ClassificationsTreeProps
> {
  public render() {
    const dataProvider = new PresentationTreeDataProvider({
      imodel: this.props.iModel,
      ruleset: classificationRules.id,
    });
    dataProvider.pagingSize = 20; // paging size is now needed for the controlled tree.
    return (
      <SimpleTreeWithRuleset
        imodel={this.props.iModel}
        ruleSet={classificationRules as Ruleset}
        dataProvider={dataProvider}
      />
    );
  }
}

export const ConnectedClassificationsTree = connectIModelConnection(
  null,
  null
)(ClassificationsTree); // tslint:disable-line
