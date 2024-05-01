/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { CheckBoxInfo, HighlightableTreeNodeProps, ITreeImageLoader, PropertyValueRendererContext, TreeActions, TreeModel, TreeModelNode, TreeNodeItem, TreeNodeRendererProps, TreeRendererProps } from "@itwin/components-react";
import { HighlightingEngine, PropertyValueRendererManager, TreeRenderer } from "@itwin/components-react";
import type { FunctionIconInfo, TreeNodeFunctionIconInfoMapper } from "../FunctionalityProviders/TreeNodeFunctionIconMapper";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { NodeCheckboxProps, NodeCheckboxRenderProps } from "@itwin/core-react";
import { CheckBoxState, ContextMenuItem, GlobalContextMenu, ImageCheckBox, TreeNode } from "@itwin/core-react";
import type { VisibilityHandler } from "../EventHandlers/VisibilityHandler";
import styles from "./FunctionalTreeNodeRenderer.module.scss";
import { ToolbarItemKeys } from "../TreeNodeFunctionsToolbar";

/**
 * Creates Visibility tree renderer which renders nodes functions available.
 * @alpha
 */
export const useNodesWithFunctionsRenderer = (
  enableVisibility: boolean,
  itemsMapper: TreeNodeFunctionIconInfoMapper,
  visibilityHandler: VisibilityHandler | undefined,
  treeModel: TreeModel,
  selectedTreenodeCount: number,
  alterNodeLabel?: (node: TreeModelNode) => PropertyRecord
) => {
  // Creates node renderer which renders node with functions available.
  const nodeRenderer = React.useCallback((props: TreeNodeRendererProps) => (
    <TreeNodeWrapper
      treeActions={props.treeActions}
      treeModel={treeModel}
      node={props.node}
      itemsMapper={itemsMapper}
      alterNodeLabel={alterNodeLabel}
      highlightingProps={props.nodeHighlightProps}
      className={
        visibilityHandler === undefined ? undefined : "with-checkbox"
      }
      visibilityHandler={enableVisibility ? visibilityHandler : undefined}
      selectedTreenodeCount={selectedTreenodeCount}
    />
  ), [alterNodeLabel, enableVisibility, itemsMapper, selectedTreenodeCount, treeModel, visibilityHandler]
  );
  return React.useCallback(
    (props: TreeRendererProps) => (
      <TreeRenderer {...props} nodeRenderer={nodeRenderer} />
    ),
    [nodeRenderer]
  );
};

export interface TreeNodeWrapperProps extends TreeNodeRendererProps {
  node: TreeModelNode;
  treeActions: TreeActions;
  treeModel: TreeModel;
  itemsMapper: TreeNodeFunctionIconInfoMapper;
  alterNodeLabel?: (node: TreeModelNode) => PropertyRecord;
  highlightingProps?: HighlightableTreeNodeProps;
  imageLoader?: ITreeImageLoader;
  visibilityHandler: VisibilityHandler | undefined;
  selectedTreenodeCount: number;
}

export interface CheckboxWrapperProps extends NodeCheckboxRenderProps {
  visibilityHandler: VisibilityHandler | undefined;
  node: TreeNodeItem;
}

export const visibilityTreeNodeCheckboxRenderer = (props: NodeCheckboxRenderProps) => {
  let checked: boolean | undefined = props.checked;
  let imageOff: string = "icon-visibility-hide-2";
  if (props.indeterminate) {
    checked = false;
    imageOff = "icon-visibility";
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
export class TreeNodeWrapper extends React.Component<TreeNodeWrapperProps, { rowContextMenu?: React.ReactNode }> {
  constructor(props: TreeNodeWrapperProps) {
    super(props);
    this.state = {
      rowContextMenu: null,
    };
    this._onRowContextMenu = this._onRowContextMenu.bind(this);
  }

  private async _onRowContextMenu(event: any) {
    event.preventDefault();
    event.persist();
    const renderedContextMenu = await this._renderRowContextMenu(this.props.node, this.props.treeModel, this.props.selectedTreenodeCount, event.clientX, event.clientY);
    this.setState({
      rowContextMenu: renderedContextMenu,
    });
  }

  private async getContextMenu(node: TreeModelNode, treeModel: TreeModel, selectedTreenodeCount: number) {
    const items: React.ReactNode[] = [];
    const nodeFunctionIcons: FunctionIconInfo[] = await this.props.itemsMapper.getFunctionIconInfosFor(node);
    nodeFunctionIcons.forEach((info: FunctionIconInfo) => {
      if (selectedTreenodeCount > 1 && info.key === ToolbarItemKeys.zoom) {
        info.disabled = true;
      }
      items.push(
        <ContextMenuItem
          key={info.key}
          name={info.label}
          disabled={info.disabled}
          icon={info.toolbarIcon}
          onSelect={async () => { this._hideContextMenu(); await info.functionalityProvider.performAction([node], treeModel); }}
        >
          {info.label}
        </ContextMenuItem>,
      );
    });
    return items.reverse();
  }

  private async _renderRowContextMenu(node: TreeModelNode, treeModel: TreeModel, selectedTreenodeCount: number, x: number, y: number) {
    const contextMenu = await this.getContextMenu(node, treeModel, selectedTreenodeCount);
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
  };

  public render() {
    const node = this.props.node;
    const treeActions = this.props.treeActions;
    const visibilityHandler = this.props.visibilityHandler;
    async function onExpansionToggle() {
      if (node.isExpanded)
        treeActions.onNodeCollapsed(node.id);
      else {
        if (visibilityHandler && (node.checkbox.state === CheckBoxState.On || node.checkbox.state === CheckBoxState.Off)) {
          await visibilityHandler.cacheChildNodeVisibility(node.item, node.checkbox.state === CheckBoxState.On ? true : false);
        }
        treeActions.onNodeExpanded(node.id);
      }
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

    const label = (<div className={styles.treeNodeLabel}>{PropertyValueRendererManager.defaultManager.render(nodeLabel, labelRendererContext)}</div>);

    const createCheckboxProps = (checkboxInfo: CheckBoxInfo): NodeCheckboxProps => ({
      state: checkboxInfo.state,
      tooltip: checkboxInfo.tooltip,
      isDisabled: checkboxInfo.isDisabled,
      onClick: (newState: any) => this.props.treeActions.onNodeCheckboxClicked(this.props.node.id, newState),
    });

    return (
      <div className={styles.treeNodeWrapper} data-testid="nodeLoaded" onContextMenu={this._onRowContextMenu}>
        <div className={styles.treeNode}>
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
            checkboxProps={visibilityHandler ? createCheckboxProps(this.props.node.checkbox) : undefined}
            className={this.props.className}
            renderOverrides={visibilityHandler ? { renderCheckbox: visibilityTreeNodeCheckboxRenderer } : undefined}
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
