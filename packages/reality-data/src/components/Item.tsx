/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/

import "./Item.scss";
import * as React from "react";
import Highlighter from "react-highlight-words";
import {
  BackgroundMapType,
  SpatialClassificationProps,
} from "@bentley/imodeljs-common";
import {
  ContextRealityModelState,
  IModelApp,
  ScreenViewport,
  SpatialViewState,
} from "@bentley/imodeljs-frontend";
import { RelativePosition as Position } from "@bentley/ui-abstract";
import { ModalDialogManager } from "@bentley/ui-framework";
import { AppContext } from "../reality-data-react";
import { ClassifierMenuItem } from "./ClassifierMenuItem";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from "./ContextMenu";
import { CreateClassificationDialog } from "./CreateClassificationDialog";
import { AttachedRealityModel, Entry } from "../api/Entry";
import RealityData from "../api/RealityData";

/** Props for an Item component */
export interface ItemProps {
  appContext: AppContext;
  highlightWords?: string[];
  item: Entry;
  onVisibilityChange: () => void;
}

interface ItemState {
  showMapTypes: boolean;
  mapType: BackgroundMapType;
  showContextMenu: boolean;
}

/** Props for an Item component */
export class Item extends React.Component<ItemProps, ItemState> {
  private _optionsElement: HTMLElement | null = null;

  constructor(props: ItemProps) {
    super(props);

    this.state = {
      showMapTypes: false,
      mapType: BackgroundMapType.Aerial,
      showContextMenu: false,
    };
  }

  /**
   * Update classifier data for unattached reality data item in viewport.
   * @param item  RealityDataEntry to enable display for.
   */
  public static updateRealityDataClassifiers(
    vp: ScreenViewport,
    entry: Entry,
    editItemName = "",
    replaceAllClassifiers = false
  ) {
    const view = vp.view as SpatialViewState;

    if (entry.model instanceof AttachedRealityModel) {
      return;
    }

    const existingRealityModels: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel(
      (modelState: ContextRealityModelState) =>
        existingRealityModels.push(modelState)
    );
    let foundIndex = -1;
    const found = existingRealityModels.find((model, index) => {
      if (model.url === entry.model.url) {
        foundIndex = index;
        return true;
      }
      return false;
    });

    if (found && found.classifiers && !replaceAllClassifiers) {
      let activeClassifier: SpatialClassificationProps.Classifier | undefined;

      if (entry.classifiers && entry.classifiers.length > 0) {
        entry.classifiers.forEach(
          (updatedClassifier: SpatialClassificationProps.Properties) => {
            let matchingClassifier:
              | SpatialClassificationProps.Classifier
              | undefined;
            if (updatedClassifier.isActive)
              activeClassifier = updatedClassifier;

            Array.from(found.classifiers!).forEach((storedClassifier) => {
              if (editItemName === storedClassifier.name) {
                matchingClassifier = storedClassifier;
                storedClassifier.name = updatedClassifier.name;
                storedClassifier.expand = updatedClassifier.expand;
                storedClassifier.flags = updatedClassifier.flags;
                storedClassifier.modelId = updatedClassifier.modelId;
              }
            });

            if (!matchingClassifier) found.classifiers!.push(updatedClassifier);
          }
        );
        found.classifiers!.active = activeClassifier;
      }
      vp.invalidateScene();
      return;
    }

    const props = {
      tilesetUrl: entry.model.url,
      name: entry.name ? entry.name : entry.model.name,
      description: entry.description,
      classifiers: entry.classifiers ? entry.classifiers : [],
    };

    // For situations where we are removing classifiers just remove and reattach latest set of classifiers.
    if (found) view.displayStyle.detachRealityModelByIndex(foundIndex);
    view.displayStyle.attachRealityModel(props);
    vp.invalidateScene();
  }

  private _onToggle = () => {
    this.props.onVisibilityChange();
  };

  private _onShowContextMenu = (event: any) => {
    event.stopPropagation();
    const showContextMenu = !this.state.showContextMenu;
    this.setState({ showContextMenu });
  };

  private _onCloseContextMenu = () => {
    this.setState({ showContextMenu: false });
  };

  private _onClassificationChange = (index: number) => {
    const entry = this.props.item;
    if (entry.classifiers && entry.classifiers.length) {
      // toggle the selected classifier and set isActive off for all other classifiers
      for (let i = 0; i < entry.classifiers.length; i++) {
        entry.classifiers[i].isActive =
          i !== index ? false : !entry.classifiers[i].isActive;
      }
    }

    const vp = IModelApp.viewManager.selectedView;
    if (vp) Item.updateRealityDataClassifiers(vp, entry);

    this.setState({ showContextMenu: false });
  };

  private _onCreateClicked = () => {
    this.setState(
      (_prevState) => ({
        showContextMenu: false,
      }),
      () => {
        ModalDialogManager.openDialog(
          <CreateClassificationDialog
            item={this.props.item}
            appContext={this.props.appContext}
          />
        );
      }
    );
  };

  private _onEditClassifier = (index: number) => {
    this.setState(
      (_prevState) => ({
        showContextMenu: false,
      }),
      () => {
        const entry = this.props.item;
        if (entry.classifiers && entry.classifiers.length > 0) {
          const classifier = entry.classifiers[index];
          ModalDialogManager.openDialog(
            <CreateClassificationDialog
              item={this.props.item}
              classifier={classifier}
              appContext={this.props.appContext}
            />
          );
        }
      }
    );
  };

  private _onDeleteClassifier = (index: number) => {
    const entry = this.props.item;
    if (
      entry.classifiers &&
      entry.classifiers.length > 0 &&
      index < entry.classifiers.length
    ) {
      entry.classifiers.splice(index, 1);
      const vp = IModelApp.viewManager.selectedView;
      if (vp) Item.updateRealityDataClassifiers(vp, entry, "", true); // pass true since we are deleting - we must replace classifier array since API does removing a classifier.
    }

    this.setState({ showContextMenu: false });
  };

  private _onNoClassifiersClick = (event: any) => {
    event.stopPropagation();
  };

  /** @hidden */
  public render() {
    const groupLabel = RealityData.translate("group") + ": ";
    const groupValue =
      this.props.item.group || RealityData.translate("notAvailable");
    const groupInfo = groupLabel + groupValue;
    const sizeLabel = RealityData.translate("size") + ": ";
    const sizeValue =
      this.props.item.size + " " + RealityData.translate("kilobytes") ||
      RealityData.translate("notAvailable");
    const sizeInfo = sizeLabel + sizeValue;
    const tooltip = groupInfo + "\n" + sizeInfo;
    const { showContextMenu } = this.state;
    const { item } = this.props;
    const classifiers = item.classifiers;

    const isClassificationEnabled = this.props.appContext.features
      .classification;
    return (
      <li
        className="reality-data-item"
        key={item.url}
        onClick={this._onToggle}
        title={tooltip}
      >
        <span
          className={
            item.enabled
              ? "icon icon-visibility"
              : "icon icon-visibility-hide-2"
          }
        />
        <a>
          <div className="reality-data-name">
            {this.props.highlightWords !== undefined ? (
              <Highlighter
                caseSensitive={false}
                searchWords={
                  this.props.highlightWords ? this.props.highlightWords : []
                }
                textToHighlight={item.name}
              />
            ) : (
              item.name
            )}
            {item.attached && <span>{RealityData.translate("attached")}</span>}
          </div>
          <span className="reality-data-description">{item.description}</span>
        </a>
        {isClassificationEnabled && !item.attached && item.enabled && (
          <>
            <span
              className="icon icon-more-2"
              onClick={this._onShowContextMenu}
              ref={(element) => {
                this._optionsElement = element;
              }}
            />
            <ContextMenu
              className="reality-data-menu"
              parent={this._optionsElement}
              isOpened={showContextMenu}
              onClickOutside={this._onCloseContextMenu.bind(this)}
              position={Position.BottomRight}
            >
              {classifiers &&
                classifiers.length > 0 &&
                classifiers.map(
                  (c: SpatialClassificationProps.Properties, index: number) => (
                    <ClassifierMenuItem
                      key={index}
                      appContext={this.props.appContext}
                      name={c.name}
                      checked={c.isActive}
                      onClick={this._onClassificationChange.bind(this, index)}
                      onEdit={this._onEditClassifier.bind(this, index)}
                      onDelete={this._onDeleteClassifier.bind(this, index)}
                    />
                  )
                )}
              {(!classifiers || 0 === classifiers.length) && (
                <div
                  className="reality-data-noclassifiers"
                  onClick={this._onNoClassifiersClick.bind(this)}
                >
                  <span>{RealityData.translate("noclassifiers")}</span>
                </div>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem
                name={RealityData.translate("create")}
                onClick={this._onCreateClicked}
              />
            </ContextMenu>
          </>
        )}
      </li>
    );
  }
}
