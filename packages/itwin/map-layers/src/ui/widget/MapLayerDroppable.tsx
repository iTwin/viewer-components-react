/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

// the following quiet warning caused by react-beautiful-dnd package
/* eslint-disable @typescript-eslint/unbound-method */

import "./MapLayerManager.scss";
import * as React from "react";
import type { DraggableChildrenFn, DroppableProvided, DroppableStateSnapshot } from "react-beautiful-dnd";
import { Draggable, Droppable } from "react-beautiful-dnd";
import { UiFramework } from "@itwin/appui-react";
import { assert } from "@itwin/core-bentley";
import type { SubLayerId } from "@itwin/core-common";
import { ImageMapLayerSettings } from "@itwin/core-common";
import type { MapLayerIndex, ScreenViewport } from "@itwin/core-frontend";
import { IModelApp, MapLayerImageryProviderStatus, MapTileTreeScaleRangeVisibility, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { Icon } from "@itwin/core-react";
import { Button, Checkbox } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";
import { AttachLayerButtonType, AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { MapLayerSettingsMenu } from "./MapLayerSettingsMenu";
import type { SourceState } from "./MapUrlDialog";
import { MapUrlDialog } from "./MapUrlDialog";
import { SubLayersPopupButton } from "./SubLayersPopupButton";

/** @internal */
interface MapLayerDroppableProps {
  isOverlay: boolean;
  layersList?: StyleMapLayerSettings[];
  mapLayerOptions?: MapLayerOptions;
  getContainerForClone: () => HTMLElement;
  activeViewport: ScreenViewport;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemEdited: () => void;
  disabled?: boolean;
}

const changeVisibilityByElementId = (element: Element | null, visible: boolean) => {
  if (element) {
    element.setAttribute("style", `visibility: ${visible ? "visible" : "hidden"}`);
  }
};

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerDroppable(props: MapLayerDroppableProps) {
  const containsLayer = props.layersList && props.layersList.length > 0;
  const droppableId = props.isOverlay ? "overlayMapLayers" : "backgroundMapLayers";
  const [toggleVisibility] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility"));
  const [requireAuthTooltip] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.RequireAuthTooltip"));
  const [noBackgroundMapsSpecifiedLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoBackgroundLayers"));
  const [noUnderlaysSpecifiedLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.NoOverlayLayers"));
  const [dropLayerLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.DropLayerLabel"));
  const [outOfRangeTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.layerOutOfRange"));

  const onSubLayerStateChange = (activeLayer: StyleMapLayerSettings, subLayerId: SubLayerId, isSelected: boolean) => {
    const mapLayerStyleIdx = props.activeViewport.displayStyle.findMapLayerIndexByNameAndSource(activeLayer.name, activeLayer.source, activeLayer.isOverlay);
    if (mapLayerStyleIdx !== -1 && activeLayer.subLayers) {
      props.activeViewport.displayStyle.changeMapSubLayerProps({ visible: isSelected }, subLayerId, {
        index: mapLayerStyleIdx,
        isOverlay: activeLayer.isOverlay,
      });
    }
  };

  const handleOk = React.useCallback(
    (index: MapLayerIndex, sourceState?: SourceState) => {
      UiFramework.dialogs.modal.close();

      const source = sourceState?.source;
      const vp = props?.activeViewport;
      if (vp === undefined || sourceState === undefined || source === undefined) {
        const error = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachMissingViewOrSource");
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceName: source?.name ?? "" });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        return;
      }

      const validation = sourceState.validation;

      // Layer is already attached,
      // This calls invalidateRenderPlan()
      vp.displayStyle.changeMapLayerProps({ subLayers: validation.subLayers }, index);
      vp.displayStyle.changeMapLayerCredentials(index, source.userName, source.password);

      // Either initial attach/initialize failed or the layer failed to load at least one tile
      // because of an invalid token; in both cases tile tree needs to be fully reset
      const provider = vp.getMapLayerImageryProvider(index);
      provider?.resetStatus();
      vp.resetMapLayer(index);

      props.onItemEdited();
    },
    [props],
  );

  const changeSettingsMenuVisibility = (event: React.MouseEvent<HTMLDivElement, MouseEvent>, visible: boolean) => {
    changeVisibilityByElementId(event.currentTarget.querySelector("#MapLayerSettingsMenuWrapper"), visible);
    changeVisibilityByElementId(event.currentTarget.querySelector("#MapLayerSettingsSubLayersMenu"), visible);
  };

  const renderItem: DraggableChildrenFn = (dragProvided, _, rubric) => {
    assert(props.layersList !== undefined);
    const activeLayer = props.layersList[rubric.source.index];
    const outOfRange = activeLayer.treeVisibility === MapTileTreeScaleRangeVisibility.Hidden;

    return (
      <div
        className="map-manager-source-item"
        data-id={rubric.source.index}
        key={activeLayer.name}
        {...dragProvided.draggableProps}
        ref={dragProvided.innerRef}
        onMouseEnter={(event) => changeSettingsMenuVisibility(event, true)}
        onMouseLeave={(event) => changeSettingsMenuVisibility(event, false)}
      >
        {/* Checkbox */}
        <Checkbox
          data-testid={"select-item-checkbox"}
          checked={activeLayer.selected}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            activeLayer.selected = event.target.checked;
            props.onItemSelected(props.isOverlay, rubric.source.index);
          }}
        ></Checkbox>
        {/* Visibility icon */}
        <Button
          disabled={props.disabled}
          size="small"
          styleType="borderless"
          className="map-manager-item-visibility map-manager-visibility-icon"
          title={toggleVisibility}
          onClick={() => {
            props.onItemVisibilityToggleClicked(activeLayer);
          }}
        >
          <Icon iconSpec={activeLayer.visible ? "icon-visibility" : "icon-visibility-hide-2"} />
        </Button>

        {/* Label */}
        <span
          className={props.disabled || outOfRange ? "map-manager-item-label-disabled" : "map-manager-item-label"}
          title={outOfRange ? outOfRangeTitle : undefined}
          {...dragProvided.dragHandleProps}
        >
          {activeLayer.name}
          {activeLayer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
            <Button
              disabled={props.disabled}
              size="small"
              styleType="borderless"
              onClick={() => {
                const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
                  activeLayer.name,
                  activeLayer.source,
                  activeLayer.isOverlay,
                );
                if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
                  const index = { index: indexInDisplayStyle, isOverlay: activeLayer.isOverlay };
                  const layer = props.activeViewport.displayStyle.mapLayerAtIndex(index);
                  if (layer instanceof ImageMapLayerSettings) {
                    UiFramework.dialogs.modal.open(
                      <MapUrlDialog
                        activeViewport={props.activeViewport}
                        isOverlay={props.isOverlay}
                        signInModeArgs={{ layer }}
                        onOkResult={(sourceState?: SourceState) => handleOk(index, sourceState)}
                        onCancelResult={() => {
                          UiFramework.dialogs.modal.close();
                        }}
                        mapLayerOptions={props.mapLayerOptions}
                      />,
                    );
                  }
                }
              }}
              title={requireAuthTooltip}
            >
              <Icon className="map-layer-source-item-warnMessage-icon" iconSpec="icon-status-warning" />
            </Button>
          )}
        </span>

        {/* SubLayersPopupButton */}
        <div id="MapLayerSettingsSubLayersMenu" style={{ visibility: "hidden" }} className="map-manager-item-sub-layer-container">
          {activeLayer.subLayers && activeLayer.subLayers.length > 1 && (
            <SubLayersPopupButton
              checkboxStyle="eye"
              expandMode="rootGroupOnly"
              subLayers={props.activeViewport ? activeLayer.subLayers : undefined}
              singleVisibleSubLayer={activeLayer.provider?.mutualExclusiveSubLayer}
              onSubLayerStateChange={(subLayerId: SubLayerId, isSelected: boolean) => {
                onSubLayerStateChange(activeLayer, subLayerId, isSelected);
              }}
            />
          )}
        </div>
        {activeLayer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
          <Button
            disabled={props.disabled}
            size="small"
            styleType="borderless"
            onClick={() => {
              const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
                activeLayer.name,
                activeLayer.source,
                activeLayer.isOverlay,
              );
              if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
                const index = { index: indexInDisplayStyle, isOverlay: activeLayer.isOverlay };
                const layer = props.activeViewport.displayStyle.mapLayerAtIndex(index);
                if (layer instanceof ImageMapLayerSettings) {
                  UiFramework.dialogs.modal.open(
                    <MapUrlDialog
                      activeViewport={props.activeViewport}
                      isOverlay={props.isOverlay}
                      signInModeArgs={{ layer }}
                      onOkResult={(sourceState?: SourceState) => handleOk(index, sourceState)}
                      onCancelResult={() => {
                        UiFramework.dialogs.modal.close();
                      }}
                      mapLayerOptions={props.mapLayerOptions}
                    />,
                  );
                }
              }
            }}
            title={requireAuthTooltip}
          >
            <Icon className="map-layer-source-item-warnMessage-icon" iconSpec="icon-status-warning" />
          </Button>
        )}
        <div id="MapLayerSettingsMenuWrapper" style={{ visibility: "hidden" }}>
          <MapLayerSettingsMenu
            activeViewport={props.activeViewport}
            mapLayerSettings={activeLayer}
            onMenuItemSelection={props.onMenuItemSelected}
            disabled={props.disabled}
          />
        </div>
      </div>
    );
  };

  function renderDraggableContent(snapshot: DroppableStateSnapshot): React.ReactNode {
    let node: React.ReactNode;
    if (containsLayer) {
      // Render a <Draggable>
      node = props.layersList?.map((mapLayerSettings, i) => (
        <Draggable isDragDisabled={props.disabled} key={mapLayerSettings.name} draggableId={mapLayerSettings.name} index={i}>
          {renderItem}
        </Draggable>
      ));
    } else {
      // Render a label that provide a 'Drop here' hint
      const label = props.isOverlay ? noUnderlaysSpecifiedLabel : noBackgroundMapsSpecifiedLabel;
      node = (
        <div title={label} className="map-manager-no-layers-container">
          {snapshot.isDraggingOver ? (
            <span className="map-manager-no-layers-label">{dropLayerLabel}</span>
          ) : (
            <>
              <span className="map-manager-no-layers-label">{label}</span>
              <AttachLayerPopupButton disabled={props.disabled} buttonType={AttachLayerButtonType.Blue} isOverlay={props.isOverlay} />
            </>
          )}
        </div>
      );
    }
    return node;
  }

  function renderDraggable(dropProvided: DroppableProvided, dropSnapshot: DroppableStateSnapshot): React.ReactElement<HTMLElement> {
    return (
      <div
        className={`map-manager-attachments${dropSnapshot.isDraggingOver && containsLayer ? " is-dragging-map-over" : ""}`}
        ref={dropProvided.innerRef}
        {...dropProvided.droppableProps}
      >
        {renderDraggableContent(dropSnapshot)}

        {/* We don't want a placeholder when displaying the 'Drop here' message
              Unfortunately, if don't add it, 'react-beautiful-dnd' show an error message in the console.
              So I simply make it hidden. See https://github.com/atlassian/react-beautiful-dnd/issues/518 */}
        <div style={containsLayer ? undefined : { display: "none" }}>{dropProvided.placeholder}</div>
      </div>
    );
  }

  return (
    <Droppable droppableId={droppableId} renderClone={renderItem} getContainerForClone={props.getContainerForClone as any}>
      {renderDraggable}
    </Droppable>
  );
}
