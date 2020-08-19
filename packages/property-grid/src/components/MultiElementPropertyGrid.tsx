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
    };
  }

  /** Set the element list as our current content */
  private _onOpenList = () => {
    this.setState({
      content: MultiElementPropertyContent.ElementList,
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
    });
  };

  /** Set the single property grid as content and the instance key */
  private _onSelectElement = (instanceKey: InstanceKey) => {
    this.setState({
      content: MultiElementPropertyContent.SingleElementPropertyGrid,
      singlePropertyGrid: this._renderSinglePropertyGrid(instanceKey),
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
    // TODO: Animations
    switch (this.state.content) {
      case MultiElementPropertyContent.PropertyGrid:
        return this.state.mainPropertyGrid;
      case MultiElementPropertyContent.ElementList:
        return this.state.list;
      case MultiElementPropertyContent.SingleElementPropertyGrid:
        return this.state.singlePropertyGrid;
    }
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
