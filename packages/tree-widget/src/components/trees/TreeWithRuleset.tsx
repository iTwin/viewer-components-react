/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import {
  IPresentationTreeDataProvider,
  usePresentationTreeNodeLoader,
  useUnifiedSelectionTreeEventHandler,
  PresentationTreeDataProvider,
} from "@itwin/presentation-components";
import {
  SelectionMode,
  ControlledTree,
  useTreeModel,
} from "@itwin/components-react";
import { Presentation } from "@itwin/presentation-frontend";
import "./TreeWithRulesetTree.scss";
import { connectIModelConnection } from "@itwin/appui-react";
import { IModelConnection } from "@itwin/core-frontend";
import { useResizeDetector } from "react-resize-detector";

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
    pagingSize: props.pageSize || 20,
  });

  const modelSource = nodeLoader.modelSource;
  const unifiedSelectionEventHandler = useUnifiedSelectionTreeEventHandler({
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
  });
  const { width, height, ref } = useResizeDetector();

  const treeModel = useTreeModel(modelSource);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {width && height && (
        <ControlledTree
          model={treeModel}
          nodeLoader={nodeLoader}
          eventsHandler={unifiedSelectionEventHandler}
          selectionMode={SelectionMode.Extended}
          width={width}
          height={height}
        />
      )}
    </div>
  );
};

export const ConnectedSimpleTreeWithRuleset = connectIModelConnection(
  null,
  null
)(SimpleTreeWithRuleset); // tslint:disable-line
