/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  CheckBoxInfo, HighlightableTreeNodeProps, HighlightingEngine, PropertyValueRendererContext, PropertyValueRendererManager,
  TreeActions, TreeModel, TreeModelNode,
  TreeNodeRendererProps, TreeRenderer, TreeRendererProps, ITreeImageLoader, TreeNodeItem
} from "@bentley/ui-components";
import { FunctionIconInfo, TreeNodeFunctionIconInfoMapper } from "../FunctionalityProviders";
import { PropertyRecord } from "@bentley/ui-abstract";
import { ContextMenuItem, GlobalContextMenu, ImageCheckBox, NodeCheckboxProps, NodeCheckboxRenderProps, TreeNode } from "@bentley/ui-core";
import { VisibilityHandler, ExtendedVisibilityStatus } from "../EventHandlers/VisibilityHandler";
import "../TreeWithRulesetTree.scss";

/**
 * Creates Visibility tree renderer which renders nodes functions available.
 * @alpha
 */
export const useNodesWithFunctionsRenderer = (itemsMapper: TreeNodeFunctionIconInfoMapper, visibilityHandler: VisibilityHandler | undefined, treeModel: TreeModel, alterNodeLabel?: (node: TreeModelNode) => PropertyRecord) => {
  const nodeRenderer = React.useCallback(createFunctionalTreeNodeRenderer(itemsMapper, visibilityHandler, treeModel, alterNodeLabel), [itemsMapper, alterNodeLabel]);
  return React.useCallback((props: TreeRendererProps) => (
    <TreeRenderer
      {...props}
      nodeRenderer={nodeRenderer}
    />
  ), [nodeRenderer]);
};


/**
 * Creates node renderer which renders node with functions available.
 * @alpha
 */
export const createFunctionalTreeNodeRenderer = (itemsMapper: TreeNodeFunctionIconInfoMapper, visibilityHandler: VisibilityHandler | undefined, treeModel: TreeModel, alterNodeLabel?: (node: TreeModelNode) => PropertyRecord) => {
  return (props: TreeNodeRendererProps) => (
    <TreeNodeWrapper
      treeActions={props.treeActions}
      treeModel={treeModel}
      node={props.node}
      itemsMapper={itemsMapper}
      alterNodeLabel={alterNodeLabel}
      highlightingProps={props.nodeHighlightProps}
      className={visibilityHandler === undefined ? undefined : "with-checkbox"}
      visibilityHandler={visibilityHandler}
    />
  );
};

export interface TreeNodeWrapperProps extends TreeNodeRendererProps {
  node: TreeModelNode;
  treeActions: TreeActions;
  treeModel: TreeModel;
  itemsMapper: TreeNodeFunctionIconInfoMapper;
  alterNodeLabel?: (node: TreeModelNode) => PropertyRecord;
  highlightingProps?: HighlightableTreeNodeProps;
  /** Image loader used to load icon. */
  imageLoader?: ITreeImageLoader;
  visibilityHandler: VisibilityHandler | undefined;
}

export interface CheckboxWrapperProps extends NodeCheckboxRenderProps {
  visibilityHandler: VisibilityHandler | undefined;
  node: TreeNodeItem;
}

// tslint:disable-next-line:variable-name
export const CheckBoxWrapper = (props: CheckboxWrapperProps) => {
  const [visibilityStatus, setVisibilityStatus] = React.useState<ExtendedVisibilityStatus | undefined>(undefined);

  React.useEffect(() => {
    if (!props.visibilityHandler) {
      return;
    }

    props.visibilityHandler.onNodeVisibilityAffected.addListener((affectedNodeIds: string[]) => {
      if (affectedNodeIds.indexOf(props.node.id) !== -1) {
        const status = { isDisplayed: props.checked === false ? false : true, isChildVisible: false };
        setVisibilityStatus(status);
      }
    });

    const computeVisibilityStatusOfParents = () => {
      if (props.visibilityHandler) {
        props.visibilityHandler.getNodeVisibilityStatus(props.node).then((status) => {
          if (visibilityStatus ?.isChildVisible !== status.isChildVisible || visibilityStatus ?.isDisplayed !== status.isDisplayed) //if status changed, we need to re-render this checkbox
            setVisibilityStatus(status);
        });
      }
    };

    return props.visibilityHandler.onParentsVisibilityAffected.addListener((affectedNodeIds: string[]) => {
      if (affectedNodeIds.indexOf(props.node.id) !== -1) {
        computeVisibilityStatusOfParents();
      }
    });
  }, [props.visibilityHandler, props.node, visibilityStatus]);

  if (props.visibilityHandler) {
    props.visibilityHandler.getNodeVisibilityStatus(props.node).then((status) => {
      if (visibilityStatus ?.isChildVisible !== status.isChildVisible || visibilityStatus ?.isDisplayed !== status.isDisplayed) //if status changed, we need to re-render this checkbox
        setVisibilityStatus(status);
    });
  }

  if (visibilityStatus === undefined)
    return null;

  let checked: boolean = true;
  let imageOff: string = "icon-visibility-hide-2";
  if (visibilityStatus) {
    if (!visibilityStatus.isDisplayed) {
      checked = false;
    } else if (!visibilityStatus.isChildVisible) {
      checked = false;
      imageOff = "icon-visibility";
    } else {
      checked = true;
    }
  }
  return <ImageCheckBox
    checked={checked}
    disabled={props.disabled}
    imageOn="icon-visibility"
    imageOff={imageOff}
    onClick={props.onChange}
    tooltip={props.title}
  />;
};

export class TreeNodeWrapper extends React.Component<TreeNodeWrapperProps, { rowContextMenu?: React.ReactNode; }> {
  constructor(props: any) {
    super(props);
    this.state = {
      rowContextMenu: null,
    };
    this._onRowContextMenu = this._onRowContextMenu.bind(this);
  }

  private async _onRowContextMenu(event: any) {
    event.preventDefault();
    event.persist();
    const renderedContextMenu = await this._renderRowContextMenu(this.props.node, this.props.treeModel, event!.clientX, event!.clientY);
    this.setState({
      rowContextMenu: renderedContextMenu,
    });
  }

  private async getContextMenu(node: TreeModelNode, treeModel: TreeModel) {
    const items: React.ReactNode[] = [];
    let nodeFunctionIcons: FunctionIconInfo[] = await this.props.itemsMapper.getFunctionIconInfosFor(node);
    nodeFunctionIcons.forEach((info: FunctionIconInfo) => {
      items.push(
        <ContextMenuItem
          key={info.key}
          name={info.label}
          disabled={info.disabled}
          onSelect={() => { this._hideContextMenu(); info.functionalityProvider.performAction(node, treeModel); }}
        >
          {info.label}
        </ContextMenuItem>,
      );
    });
    return items;
  }

  private async _renderRowContextMenu(node: TreeModelNode, treeModel: TreeModel, x: number, y: number) {
    const contextMenu = await this.getContextMenu(node, treeModel);
    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={this._hideContextMenu}
        x={x}
        y={y}
      >
        {contextMenu}
      </GlobalContextMenu>
    );
  }

  private _hideContextMenu = () => {
    this.setState({ rowContextMenu: undefined });
  }

  public render() {
    const node = this.props.node;
    const treeActions = this.props.treeActions;
    function onExpansionToggle() {
      if (node.isExpanded)
        treeActions.onNodeCollapsed(node.id);
      else
        treeActions.onNodeExpanded(node.id);
    }
    let nodeLabel = node.label;
    if (this.props.alterNodeLabel) {
      nodeLabel = this.props.alterNodeLabel(node);
    }
    // Highlight while filtering
    const highlightProps = this.props.highlightingProps;
    const highlightCallback = highlightProps
      ? (text: string) => HighlightingEngine.renderNodeLabel(text, highlightProps)
      : undefined;

    const labelRendererContext: PropertyValueRendererContext = {
      textHighlighter: highlightCallback,
    };

    const label = (<div className="components-tree-node-content">{PropertyValueRendererManager.defaultManager.render(nodeLabel, labelRendererContext)}</div>);

    const createCheckboxProps = (checkboxInfo: CheckBoxInfo): NodeCheckboxProps => ({
      state: checkboxInfo.state,
      tooltip: checkboxInfo.tooltip,
      isDisabled: checkboxInfo.isDisabled,
      onClick: (newState: any) => this.props.treeActions.onNodeCheckboxClicked(this.props.node.id, newState),
    });

    let checkboxRenderer;
    if (this.props.visibilityHandler) {
      checkboxRenderer = ((props: NodeCheckboxRenderProps) => {
        return <CheckBoxWrapper visibilityHandler={this.props.visibilityHandler} node={node.item} checked={props.checked} disabled={props.disabled} onChange={props.onChange} onClick={props.onClick} />;
      });
    }

    return (
      <div className="tree-item-wrapper" data-testid="nodeLoaded" onContextMenu={this._onRowContextMenu}>
        <div className="tree-item">
          <TreeNode
            key={node.id}
            level={node.depth}
            label={label}
            onClickExpansionToggle={onExpansionToggle}
            isExpanded={node.isExpanded}
            isSelected={node.isSelected}
            isLoading={node.isLoading}
            isLeaf={node.numChildren === 0}
            onClick={(event) => { treeActions.onNodeClicked(node.id, event); }}
            onMouseDown={() => treeActions.onNodeMouseDown(node.id)}
            onMouseMove={() => treeActions.onNodeMouseMove(node.id)}
            checkboxProps={this.props.visibilityHandler === undefined ? undefined : createCheckboxProps(this.props.node.checkbox)}
            className={this.props.className}
            renderOverrides={{ renderCheckbox: checkboxRenderer }}
          >
          </TreeNode>
        </div>
        <div>
          {this.state.rowContextMenu}
        </div>
      </div>
    );
  }
}
