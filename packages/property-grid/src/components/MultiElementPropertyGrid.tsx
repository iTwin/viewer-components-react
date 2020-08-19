/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import "./MultiElementPropertyGrid.scss";
import { Presentation } from "@bentley/presentation-frontend";

import { PropertyGrid, PropertyGridProps } from "./PropertyGrid";
import * as React from "react";
import { animated, Transition } from "react-spring/renderprops";
import { ElementList } from "./ElementList";
import { InstanceKey, KeySet } from "@bentley/presentation-common";
import { PropertyDataProvider } from "../api/PropertyGridDataProvider";
import { ConfigurableCreateInfo, WidgetControl } from "@bentley/ui-framework";

enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

interface MultiElementPropertyGridState {
  content: MultiElementPropertyContent;
  mainPropertyGrid: JSX.Element;
  list: JSX.Element;
  singlePropertyGrid?: JSX.Element;
  animationForward: boolean;
}

/**
 * Property grid with the ability to inspect selected elements
 * and let user inspect a single elements properties
 */
export class MultiElementPropertyGrid extends React.Component<
  PropertyGridProps,
  MultiElementPropertyGridState
> {
  constructor(props: PropertyGridProps) {
    super(props);

    this.state = {
      content: MultiElementPropertyContent.PropertyGrid,
      mainPropertyGrid: this._renderMainPropertyGrid(),
      list: this._renderList(),
      animationForward: true,
    };
  }

  /** Set the element list as our current content */
  private _onOpenList = () => {
    this.setState({
      content: MultiElementPropertyContent.ElementList,
      animationForward: true,
    });
  };

  /** Render main property grid with the info button if needed */
  private _renderMainPropertyGrid = () => {
    const moreThanOneElement =
      Presentation.selection.getSelection(this.props.iModelConnection)
        .instanceKeysCount > 1;

    const onInfoButton = moreThanOneElement ? this._onOpenList : undefined;
    return <PropertyGrid {...this.props} onInfoButton={onInfoButton} />;
  };

  /** Go back to property grid as the main content view */
  private _onCloseList = () => {
    this.setState({
      content: MultiElementPropertyContent.PropertyGrid,
      animationForward: false,
    });
  };

  /** Set the single property grid as content and the instance key */
  private _onSelectElement = (instanceKey: InstanceKey) => {
    this.setState({
      content: MultiElementPropertyContent.SingleElementPropertyGrid,
      singlePropertyGrid: this._renderSinglePropertyGrid(instanceKey),
      animationForward: true,
    });
  };

  /** Renders element selection list to inspect properties */
  private _renderList = () => {
    const instanceKeyMap = Presentation.selection.getSelection(
      this.props.iModelConnection
    ).instanceKeys;

    const instanceKeys: InstanceKey[] = [];
    instanceKeyMap.forEach((ids: Set<string>, className: string) => {
      ids.forEach((id: string) => {
        instanceKeys.push({
          id,
          className,
        });
      });
    });

    return (
      <ElementList
        iModelConnection={this.props.iModelConnection}
        instanceKeys={instanceKeys}
        onBack={this._onCloseList}
        onSelect={this._onSelectElement}
        rootClassName={this.props.rootClassName}
      />
    );
  };

  /** Closes the single element property grid */
  private _onCloseSinglePropertyGrid = () => {
    this.setState({
      content: MultiElementPropertyContent.ElementList,
      animationForward: false,
    });
  };

  /** Render single selection property grid */
  private _renderSinglePropertyGrid = (instanceKey: InstanceKey) => {
    const dataProvider = new PropertyDataProvider(
      this.props.iModelConnection,
      this.props.rulesetId,
      this.props.enableFavoriteProperties
    );
    // Set inspected instance as the key
    dataProvider.keys = new KeySet([instanceKey]);
    return (
      <PropertyGrid
        {...this.props}
        dataProvider={dataProvider}
        onBackButton={this._onCloseSinglePropertyGrid}
        disableUnifiedSelection={true}
      />
    );
  };

  /** Render component using react-spring transition component */
  public render() {
    const items = [this.state.mainPropertyGrid, this.state.list];
    if (this.state.singlePropertyGrid) {
      items.push(this.state.singlePropertyGrid);
    }

    const fromAnim = this.state.animationForward
      ? "translate(100%,0)"
      : "translate(-100%,0)";
    const leaveAnim = !this.state.animationForward
      ? "translate(100%,0)"
      : "translate(-100%,0)";

    return (
      <div className="property-grid-react-transition-container">
        <Transition
          items={this.state.content as number}
          config={{ duration: 500 }}
          from={{ transform: fromAnim }}
          enter={{ transform: "translate(0,0)" }}
          leave={{ transform: leaveAnim }}
        >
          {(index) => (style) => (
            <animated.div
              className="property-grid-react-animated-tab"
              style={style}
            >
              {items[index]}
            </animated.div>
          )}
        </Transition>
      </div>
    );
  }
}

export class MultiElementPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = (
      <MultiElementPropertyGrid
        orientation={options.orientation}
        isOrientationFixed={options.isOrientationFixed}
        enableCopyingPropertyText={options.enableCopyingPropertyText}
        enableFavoriteProperties={options.enableFavoriteProperties}
        iModelConnection={options.iModelConnection}
        projectId={options.projectId}
        debugLog={options.debugLog}
        additionalContextMenuOptions={options.additionalContextMenuOptions}
        rootClassName={options.rootClassName}
        featureTracking={options.featureTracking}
        rulesetId={options.rulesetId}
      />
    );
  }
}
