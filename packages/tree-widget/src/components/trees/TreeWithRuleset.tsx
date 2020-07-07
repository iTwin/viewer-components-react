/*---------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 * Based on unified-navigator from Bentley.
 * See https://bentleycs.visualstudio.com/iModelTechnologies/_git/unified-navigator
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

/**
 * Properties for the [[ControlledSpatialContainmentTree]] component
 * @internal
 */
export interface ControlledTreeProps {
  iModel: IModelConnection;
  dataProvider: IPresentationTreeDataProvider;
  rulesetId: string;
  pageSize?: number;
}

/**
 * Properties for the [[TreeWithRulesetTree]] component
 * @alpha
 */
export interface TreeProps {
  imodel: IModelConnection;
  ruleSet: Ruleset;
  dataProvider: IPresentationTreeDataProvider;
}

/**
 * State for the [[TreeWithRuleset]] component
 * @alpha
 */
export interface TreeState {
  initialized: false;
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
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

  /** @internal */
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

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 * @internal
 */
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

  /** @internal */
  public render() {
    const dataProvider = this.state
      .dataProvider as PresentationTreeDataProvider;
    if (!dataProvider) return <div />;
    else {
      return (
        <div className="dr-spatial-tree">
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

/**
 * Controlled tree wrapper.
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 * @internal
 */
// tslint:disable-next-line:variable-name naming-convention
export const ControlledTreeWrapper: React.FC<ControlledTreeProps> = (
  props: ControlledTreeProps
) => {
  const nodeLoader = usePresentationTreeNodeLoader({
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
