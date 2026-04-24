import type { MapLayerIndex, ScreenViewport } from "@itwin/core-frontend";
import { MapLayerImageryProviderStatus, MapTileTreeScaleRangeVisibility } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../../Interfaces";
import { MapUrlDialog, type SourceState } from "./MapUrlDialog";
import { ImageMapLayerSettings, type SubLayerId } from "@itwin/core-common";
import type { useSortable } from "@dnd-kit/react/sortable";
import { Checkbox, IconButton } from "@itwin/itwinui-react";
import { SvgStatusWarning, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { UiFramework } from "@itwin/appui-react";
import { SubLayersPopupButton } from "./SubLayersPopupButton";
import { MapLayerSettingsMenu } from "./MapLayerSettingsMenu";

interface MapLayerItemProps {
  id: string;
  activeLayer: StyleMapLayerSettings;
  activeViewport: ScreenViewport;
  disabled?: boolean;
  handleOk: (index: MapLayerIndex, sourceState?: SourceState) => void;
  index: number;
  isOverlay: boolean;
  mapLayerOptions?: MapLayerOptions;
  onItemSelected: (isOverlay: boolean, index: number) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  onSubLayerStateChange: (activeLayer: StyleMapLayerSettings, subLayerId: SubLayerId, isSelected: boolean) => void;
  outOfRangeTitle: string;
  requireAuthTooltip: string;
  sortable: ReturnType<typeof useSortable>;
  toggleVisibility: string;
}

export function MapLayerItem(props: MapLayerItemProps) {
  const outOfRange = props.activeLayer.treeVisibility === MapTileTreeScaleRangeVisibility.Hidden;

  return (
    <div
      className="map-manager-source-item"
      data-id={props.index}
      ref={props.sortable.ref}
      style={{
        zIndex: props.sortable.isDragging ? 1 : undefined,
        boxShadow: props.sortable.isDragging ? "10px 5px 5px rgba(0, 0, 0, 0.15)" : undefined,
      }}
    >
      <Checkbox
        data-testid={"select-item-checkbox"}
        checked={props.activeLayer.selected}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          props.activeLayer.selected = event.target.checked;
          props.onItemSelected(props.isOverlay, props.index);
        }}
      />
      <IconButton
        disabled={props.disabled}
        size="small"
        styleType="borderless"
        className="map-manager-item-visibility"
        label={props.toggleVisibility}
        onClick={() => {
          props.onItemVisibilityToggleClicked(props.activeLayer);
        }}
      >
        {props.activeLayer.visible ? <SvgVisibilityShow data-testid="layer-visibility-icon-show" /> : <SvgVisibilityHide data-testid="layer-visibility-icon-hide" />}
      </IconButton>

      <span
        className={props.disabled || outOfRange ? "map-manager-item-label-disabled" : "map-manager-item-label"}
        title={outOfRange ? props.outOfRangeTitle : undefined}
      >
        {props.activeLayer.name}
        {/* eslint-disable-next-line @itwin/no-internal */}
        {props.activeLayer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
          <IconButton
            disabled={props.disabled}
            size="small"
            styleType="borderless"
            onClick={() => {
              const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
                props.activeLayer.name,
                props.activeLayer.source,
                props.activeLayer.isOverlay,
              );
              if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
                const mapLayerIndex = { index: indexInDisplayStyle, isOverlay: props.activeLayer.isOverlay };
                const layer = props.activeViewport.displayStyle.mapLayerAtIndex(mapLayerIndex);
                if (layer instanceof ImageMapLayerSettings) {
                  UiFramework.dialogs.modal.open(
                    <MapUrlDialog
                      activeViewport={props.activeViewport}
                      signInModeArgs={{ layer }}
                      onOkResult={(sourceState?: SourceState) => props.handleOk(mapLayerIndex, sourceState)}
                      onCancelResult={() => {
                        UiFramework.dialogs.modal.close();
                      }}
                      mapLayerOptions={props.mapLayerOptions}
                    />,
                  );
                }
              }
            }}
            label={props.requireAuthTooltip}
          >
            <SvgStatusWarning />
          </IconButton>
        )}
      </span>

      <div className="map-manager-item-sub-layer-container map-layer-settings-sublayers-menu">
        {props.activeLayer.subLayers && props.activeLayer.subLayers.length > 1 && (
          <SubLayersPopupButton
            checkboxStyle="eye"
            expandMode="rootGroupOnly"
            subLayers={props.activeViewport ? props.activeLayer.subLayers : undefined}
            singleVisibleSubLayer={props.activeLayer.provider?.mutualExclusiveSubLayer}
            onSubLayerStateChange={(subLayerId: SubLayerId, isSelected: boolean) => {
              props.onSubLayerStateChange(props.activeLayer, subLayerId, isSelected);
            }}
          />
        )}
      </div>
      {/* eslint-disable-next-line @itwin/no-internal */}
      {props.activeLayer.provider?.status === MapLayerImageryProviderStatus.RequireAuth && (
        <IconButton
          disabled={props.disabled}
          size="small"
          styleType="borderless"
          onClick={() => {
            const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(
              props.activeLayer.name,
              props.activeLayer.source,
              props.activeLayer.isOverlay,
            );
            if (indexInDisplayStyle !== undefined && indexInDisplayStyle >= 0) {
              const mapLayerIndex = { index: indexInDisplayStyle, isOverlay: props.activeLayer.isOverlay };
              const layer = props.activeViewport.displayStyle.mapLayerAtIndex(mapLayerIndex);
              if (layer instanceof ImageMapLayerSettings) {
                UiFramework.dialogs.modal.open(
                  <MapUrlDialog
                    activeViewport={props.activeViewport}
                    signInModeArgs={{ layer }}
                    onOkResult={(sourceState?: SourceState) => props.handleOk(mapLayerIndex, sourceState)}
                    onCancelResult={() => {
                      UiFramework.dialogs.modal.close();
                    }}
                    mapLayerOptions={props.mapLayerOptions}
                  />,
                );
              }
            }
          }}
          label={props.requireAuthTooltip}
        >
          <SvgStatusWarning />
        </IconButton>
      )}
      <div className="map-layer-settings-menu-wrapper">
        <MapLayerSettingsMenu
          activeViewport={props.activeViewport}
          mapLayerSettings={props.activeLayer}
          onMenuItemSelection={props.onMenuItemSelected}
          disabled={props.disabled}
        />
      </div>
    </div>
  );
}
