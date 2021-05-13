/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RegisteredRuleset, Ruleset } from "@bentley/presentation-common";
import {
  IPresentationTreeDataProvider,
  usePresentationTreeNodeLoader,
  useUnifiedSelectionTreeEventHandler,
  PresentationTreeDataProvider,
} from "@bentley/presentation-components";
import {
  useVisibleTreeNodes,
  SelectionMode,
  ControlledTree,
} from "@bentley/ui-components";
import { Presentation } from "@bentley/presentation-frontend";
import "./TreeWithRulesetTree.scss";
import { connectIModelConnection } from "@bentley/ui-framework";
import { IModelConnection } from "@bentley/imodeljs-frontend";

export interface ControlledTreeProps {
  iModel: IModelConnection;
  dataProvider: IPresentationTreeDataProvider;
  rulesetId: string;
  pageSize?: number;
}

export interface TreeProps {
  imodel: IModelConnection;
  ruleSet: Ruleset;
  dataProvider: IPresentationTreeDataProvider;
}

export interface TreeState {
  initialized: false;
  dataProvider?: IPresentationTreeDataProvider;
}

export abstract class TreeWithRuleset<
  T extends TreeProps,
  S extends TreeState
  > extends React.Component<T, S> {
  private _ruleset?: RegisteredRuleset;
  /** @internal */
  public async componentDidMount() {
    await this._setRuleSet();
  }

  public async componentDidUpdate(prevProps: any) {
    if (this.props.ruleSet !== prevProps.ruleSet) {
      this.removeRuleset();
      await this._setRuleSet();
    }
  }

  public componentWillUnmount() {
    this.removeRuleset();
  }

  private removeRuleset() {
    if (this._ruleset)
      Presentation.presentation.rulesets().remove(this._ruleset); // tslint:disable-line:no-floating-promises
  }

  private _setRuleSet = async () => {
    return Presentation.presentation
      .rulesets()
      .add(this.props.ruleSet) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        this._ruleset = ruleset;
        const dataProvider = this.props.dataProvider;
        this.setState({ dataProvider });
      });
  };
}

export class SimpleTreeWithRuleset extends TreeWithRuleset<
  TreeProps,
  TreeState
> {
  constructor(props: TreeProps) {
    super(props);
    this.state = {
      initialized: false,
    };
  }

  public render() {
    const dataProvider = this.state
      .dataProvider as PresentationTreeDataProvider;
    if (!dataProvider) return <div />;
    else {
      return (
        <div className="spatial-tree">
          <ControlledTreeWrapper
            rulesetId={this.props.ruleSet.id}
            iModel={this.props.imodel}
            dataProvider={dataProvider}
            pageSize={(dataProvider as PresentationTreeDataProvider).pagingSize}
          />
        </div>
      );
    }
  }
}

// tslint:disable-next-line:variable-name naming-convention
export const ControlledTreeWrapper: React.FC<ControlledTreeProps> = (
  props: ControlledTreeProps
) => {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: props.rulesetId,
    preloadingEnabled: false,
    pagingSize: props.pageSize || 20,
    dataProvider: props.dataProvider,
  });
  nodeLoader.dataProvider;
  const modelSource = nodeLoader.modelSource;
  const unifiedSelectionEventHandler = useUnifiedSelectionTreeEventHandler({
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
  });

  const visibleNodes = useVisibleTreeNodes(modelSource);

  return (
    <ControlledTree
      visibleNodes={visibleNodes}
      nodeLoader={nodeLoader}
      treeEvents={unifiedSelectionEventHandler}
      selectionMode={SelectionMode.Extended}
    />
  );
};

export const ConnectedSimpleTreeWithRuleset = connectIModelConnection(
  null,
  null
)(SimpleTreeWithRuleset); // tslint:disable-line
