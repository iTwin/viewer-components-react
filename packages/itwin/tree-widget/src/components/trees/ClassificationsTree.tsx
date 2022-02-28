/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { Ruleset } from "@itwin/presentation-common";
import { SimpleTreeWithRuleset } from "./TreeWithRuleset";
import type { IModelConnection } from "@itwin/core-frontend";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import classificationRules from "../rulesets/ClassificationSystems.json";

export interface ClassificationsTreeComponentProps {
  iModel: IModelConnection;
}

export function ClassificationsTreeComponent(
  props: ClassificationsTreeComponentProps
) {
  const dataProvider = new PresentationTreeDataProvider({
    imodel: props.iModel,
    ruleset: classificationRules.id,
    pagingSize: 20,
  });

  return (
    <SimpleTreeWithRuleset
      imodel={props.iModel}
      ruleSet={classificationRules as Ruleset}
      dataProvider={dataProvider}
    />
  );
}
