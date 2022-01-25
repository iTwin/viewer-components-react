/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

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
    Presentation.presentation.rulesets().add(props.ruleSet) // eslint-disable-line @typescript-eslint/no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        setRegisteredRuleset(ruleset);
      }).catch();  // this is needed for mocha tests where rulesets.add seem to return undefined
  }, [props.ruleSet]);

  const childWithLoadedRuleset: React.ReactNode = React.useMemo(() => {
    if (React.isValidElement(props.children))
      return React.cloneElement(props.children, { loadedRuleset: registeredRuleset });
    return <div />;
  },
  [registeredRuleset, props.children]);

  if (registeredRuleset === undefined)
    return (<div />);

  return (<>
    {childWithLoadedRuleset}
  </>);
};
