/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import type {
  IPresentationTreeDataProvider,
  PresentationTreeDataProvider,
} from "@itwin/presentation-components";
import {
  usePresentationTreeNodeLoader,
  useUnifiedSelectionTreeEventHandler,
} from "@itwin/presentation-components";
import {
  ControlledTree,
  SelectionMode,
  useTreeModel,
} from "@itwin/components-react";
import { Presentation } from "@itwin/presentation-frontend";
import "./TreeWithRulesetTree.scss";
import type { IModelConnection } from "@itwin/core-frontend";
import { AutoSizer } from "./AutoSizer";

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
    if (this._ruleset) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.rulesets().remove(this._ruleset);
    }
  }

  private _setRuleSet = async () => {
    return Presentation.presentation
      .rulesets()
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      .add(this.props.ruleSet)
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
            pageSize={dataProvider.pagingSize}
          />
        </div>
      );
    }
  }
}

export const ControlledTreeWrapper: React.FC<ControlledTreeProps> = (
  props: ControlledTreeProps
) => {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: props.rulesetId,
    pagingSize: props.pageSize || 20,
  });

  const modelSource = nodeLoader.modelSource;
  const unifiedSelectionEventHandler = useUnifiedSelectionTreeEventHandler({
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
  });

  const treeModel = useTreeModel(modelSource);

  return (
    <AutoSizer>
      {({ width, height }) => (
        <ControlledTree
          model={treeModel}
          nodeLoader={nodeLoader}
          eventsHandler={unifiedSelectionEventHandler}
          selectionMode={SelectionMode.Extended}
          width={width}
          height={height}
        />
      )}
    </AutoSizer>
  );
};

