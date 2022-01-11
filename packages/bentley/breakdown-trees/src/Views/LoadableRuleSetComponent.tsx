/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RegisteredRuleset, Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

export interface LoadedRulesetProps {
  loadedRuleset: Ruleset;
}

export interface LoadableRuleSetComponentProps {
  children: React.ReactElement<LoadedRulesetProps>;
  ruleSet: Ruleset;
}

export const LoadableRuleSetComponent: React.FC<LoadableRuleSetComponentProps> = (props: LoadableRuleSetComponentProps) => {
  const [registeredRuleset, setRegisteredRuleset] = React.useState<RegisteredRuleset | undefined>(undefined);

  React.useEffect(() => {
    Presentation.presentation.rulesets().add(props.ruleSet) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        setRegisteredRuleset(ruleset);
      }).catch();  //this is needed for mocha tests where rulesets.add seem to return undefined
  }, [props.ruleSet.id]);

  let childWithLoadedRuleset: React.ReactNode;

  if (React.isValidElement(props.children))
    childWithLoadedRuleset = React.useMemo(() => React.cloneElement(props.children, { loadedRuleset: registeredRuleset }), [registeredRuleset, props.children]);

  if (registeredRuleset === undefined)
    return (<div />);

  return (<>
    {childWithLoadedRuleset}
  </>);
}
