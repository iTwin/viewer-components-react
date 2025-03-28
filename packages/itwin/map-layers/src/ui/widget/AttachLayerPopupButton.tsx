/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { SvgAdd, SvgDelete, SvgEdit } from "@itwin/itwinui-icons-react";
import { Button, IconButton, Input, List, ListItem, Popover, ProgressRadial } from "@itwin/itwinui-react";
import { MapLayerPreferences } from "../../MapLayerPreferences";
import { MapLayersUI } from "../../mapLayers";
import { ConfirmMessageDialog } from "./ConfirmMessageDialog";
import { useSourceMapContext } from "./MapLayerManager";
import { MapSelectFeaturesDialog } from "./MapSelectFeaturesDialog";
import { MapUrlDialog } from "./MapUrlDialog";

import type { MapSubLayerProps } from "@itwin/core-common";
import type { MapLayerSourceValidation } from "@itwin/core-frontend";
import type { SourceState } from "./MapUrlDialog";
// cSpell:ignore droppable Sublayer

enum LayerAction {
  New,
  Edit,
}

interface AttachLayerPanelProps {
  isOverlay: boolean;
  onLayerAttached: () => void;
  onHandleOutsideClick?: (shouldHandle: boolean) => void;
  setMapUrlModalOpen: (open: boolean) => void;
}

function AttachLayerPanel({ isOverlay, onLayerAttached, onHandleOutsideClick, setMapUrlModalOpen}: AttachLayerPanelProps) {
  const [layerNameToAdd, setLayerNameToAdd] = React.useState<string | undefined>();
  const [sourceFilterString, setSourceFilterString] = React.useState<string | undefined>();

  const {
    placeholderLabel,
    addCustomLayerLabel,
    addCustomLayerToolTip,
    removeLayerDefButtonTitle,
    editLayerDefButtonTitle,
    removeLayerDefDialogTitle,
  } = React.useMemo(() => {
    return {
      placeholderLabel: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.SearchPlaceholder"),
      addCustomLayerLabel: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.Custom"),
      addCustomLayerToolTip: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.AttachCustomLayer"),
      removeLayerDefButtonTitle: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefButtonTitle"),
      editLayerDefButtonTitle: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.EditLayerDefButtonTitle"),
      removeLayerDefDialogTitle: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefDialogTitle"),
    };
  }, []);

  const [loading, setLoading] = React.useState(false);
  const [layerNameUnderCursor, setLayerNameUnderCursor] = React.useState<string | undefined>();

  const resumeOutsideClick = React.useCallback(() => {
    if (onHandleOutsideClick) {
      onHandleOutsideClick(true);
    }
  }, [onHandleOutsideClick]);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;

      // We close any open dialogs that we might have opened
      // This was added because the modal dialog remained remained displayed after the session expired.
      UiFramework.dialogs.modal.close();
    };
  }, []);

  const handleFilterTextChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSourceFilterString(event.target.value);
  }, []);

  const { loadingSources, sources, activeViewport, backgroundLayers, overlayLayers, mapLayerOptions } = useSourceMapContext();
  const iTwinId = activeViewport?.iModel?.iTwinId;
  const iModelId = activeViewport?.iModel?.iModelId;

  const attachLayer = React.useCallback(
    (source: MapLayerSource, subLayers: MapSubLayerProps[] | undefined, oneMapLayerPerSubLayer: boolean) => {
      if (activeViewport) {
        const generateUniqueMapLayerName = (layerName: string) => {
          let uniqueLayerName = layerName;
          let layerNameIdx = 1;
          while (
            (backgroundLayers && backgroundLayers.some((layer) => uniqueLayerName === layer.name)) ||
            (overlayLayers && overlayLayers.some((layer) => uniqueLayerName === layer.name))
          ) {
            uniqueLayerName = `${layerName} (${layerNameIdx++})`;
          }
          return { layerNameUpdate: layerNameIdx > 1, uniqueLayerName };
        };

        const doAttachLayer = (layerName: string, subLayer?: MapSubLayerProps) => {
          const generatedName = generateUniqueMapLayerName(layerName);
          let sourceToAdd = source;
          if (generatedName.layerNameUpdate || sourceToAdd.name !== generatedName.uniqueLayerName) {
            // create a source with a unique name
            const clonedSource = MapLayerSource.fromJSON({ ...source.toJSON(), name: generatedName.uniqueLayerName });
            if (clonedSource !== undefined) {
              clonedSource.userName = source.userName;
              clonedSource.password = source.password;
              clonedSource.unsavedQueryParams = { ...source.unsavedQueryParams };
              clonedSource.savedQueryParams = { ...source.savedQueryParams };
              sourceToAdd = clonedSource;
            }
          }

          const settings = sourceToAdd.toLayerSettings(subLayer ? [subLayer] : subLayers);
          if (settings) {
            activeViewport.displayStyle.attachMapLayer({ settings, mapLayerIndex: { index: -1, isOverlay } });
            return generatedName.uniqueLayerName;
          }
          return undefined;
        };

        if (oneMapLayerPerSubLayer && subLayers) {
          const layerNamesAttached: string[] = [];
          for (const subLayer of subLayers) {
            const attachedLayerName = doAttachLayer(`${source.name} - ${subLayer.name}`, subLayer);
            if (attachedLayerName !== undefined) {
              layerNamesAttached.push(attachedLayerName);
            }
          }

          if (layerNamesAttached.length > 0) {
            const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayersAttached", { layerNames: layerNamesAttached.join(", ") });
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
          }
        } else {
          const attachedLayerName = doAttachLayer(source.name, undefined);
          if (attachedLayerName !== undefined) {
            const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerAttached", { sourceName: attachedLayerName });
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
          }
        }

        if (isMounted.current) {
          setLoading(false);
        }
      }
      if (isMounted.current) {
        onLayerAttached();
        resumeOutsideClick();
      }
    },
    [activeViewport, backgroundLayers, isOverlay, onLayerAttached, overlayLayers, resumeOutsideClick],
  );

  const handleSelectFeaturesCancel = React.useCallback(() => {
    if (isMounted.current) {
      setLoading(false);
    }
    resumeOutsideClick();
    UiFramework.dialogs.modal.close();
  }, [resumeOutsideClick, setLoading]);

  const handleSelectFeaturesOk = React.useCallback(
    (source: MapLayerSource, sourceSubLayers: MapSubLayerProps[], selectedSubLayers: MapSubLayerProps[]) => {
      // keep only visible subLayers
      const visibleSubLayers = selectedSubLayers.filter((value) => value.visible);

      // Re-apply default visibility from the source validation
      visibleSubLayers.forEach((visible) => {
        const found = sourceSubLayers.find((value) => {
          visible.name === value.name;
        });
        if (found) {
          visible.visible = found?.visible;
        }
      });
      attachLayer(source, visibleSubLayers, true);
    },
    [attachLayer],
  );

  const openFeatureSelectionDialog = React.useCallback(
    (subLayers: MapSubLayerProps[], source: MapLayerSource) => {
      // Keep leafs sub-layers and force default visibility to false
      const noGroupLayers = subLayers.filter((value: MapSubLayerProps) => value.children === undefined);
      const visibleLayers = noGroupLayers.map((value: MapSubLayerProps) => {
        return { ...value, visible: false };
      });
      UiFramework.dialogs.modal.open(
        <MapSelectFeaturesDialog
          handleOk={(selectedLayers) => {
            handleSelectFeaturesOk(source, subLayers, selectedLayers);
          }}
          handleCancel={handleSelectFeaturesCancel}
          source={source}
          subLayers={visibleLayers}
        />,
      );
    },
    [handleSelectFeaturesCancel, handleSelectFeaturesOk],
  );

  const needsFeatureSelection = React.useCallback((source: MapLayerSource, validation: MapLayerSourceValidation) => {
    return (
      (source.formatId === "ArcGISFeature" || source.formatId === "WMTS") && // TODO, replace this with a flag in MapLayerSourceStatus
      validation.subLayers &&
      validation.subLayers.length > 1
    );
  }, []);

  const handleModalUrlDialogOk = React.useCallback(
    (action: LayerAction, sourceState?: SourceState) => {
      setMapUrlModalOpen(false);
      UiFramework.dialogs.modal.close();
      if (LayerAction.New === action && sourceState && sourceState.validation.status === MapLayerSourceStatus.Valid) {
        if (needsFeatureSelection(sourceState.source, sourceState.validation)) {
          openFeatureSelectionDialog(sourceState.validation.subLayers!, sourceState.source);
        } else {
          attachLayer(sourceState.source, sourceState.validation.subLayers, false);
        }
      } else {
        resumeOutsideClick();
      }
    },
    [attachLayer, needsFeatureSelection, openFeatureSelectionDialog, resumeOutsideClick, setMapUrlModalOpen],
  );

  const handleModalUrlDialogCancel = React.useCallback(() => {
    // close popup and refresh UI
    setLoading(false);
    setMapUrlModalOpen(false);
    UiFramework.dialogs.modal.close();
    resumeOutsideClick();
  }, [setLoading, resumeOutsideClick, setMapUrlModalOpen]);

  React.useEffect(() => {
    async function attemptToAddLayer() {
      if (layerNameToAdd && activeViewport) {
        // if the layer is not in the style add it now.
        const foundSource = sources?.find((source) => source.name === layerNameToAdd);
        if (foundSource === undefined) {
          return;
        }

        try {
          if (isMounted.current) {
            setLoading(true);
          }

          const sourceValidation = await foundSource.validateSource();
          if (sourceValidation.status === MapLayerSourceStatus.Valid || sourceValidation.status === MapLayerSourceStatus.RequireAuth) {
            if (sourceValidation.status === MapLayerSourceStatus.Valid) {
              if (sourceValidation.subLayers && needsFeatureSelection(foundSource, sourceValidation)) {
                openFeatureSelectionDialog(sourceValidation.subLayers, foundSource);
                if (onHandleOutsideClick) {
                  onHandleOutsideClick(false);
                }
              } else {
                attachLayer(foundSource, sourceValidation.subLayers, false);
              }
            } else if (sourceValidation.status === MapLayerSourceStatus.RequireAuth && isMounted.current) {
              const layer = foundSource.toLayerSettings();
              if (layer) {
                setMapUrlModalOpen(true);
                UiFramework.dialogs.modal.open(
                  <MapUrlDialog
                    activeViewport={activeViewport}
                    signInModeArgs={{ layer, validation: sourceValidation, source: foundSource }}
                    onOkResult={(sourceState?: SourceState) => handleModalUrlDialogOk(LayerAction.New, sourceState)}
                    onCancelResult={handleModalUrlDialogCancel}
                    mapLayerOptions={mapLayerOptions}
                  />,
                );
              }

              if (onHandleOutsideClick) {
                onHandleOutsideClick(false);
              }
            }
          } else {
            const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerValidationFailed", { sourceUrl: foundSource.url });
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
            if (isMounted.current) {
              setLoading(false);
            }
          }
        } catch (err) {
          if (isMounted.current) {
            setLoading(false);
          }
          const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error: err, sourceName: foundSource.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        }
      }
      return;
    }

    attemptToAddLayer(); // eslint-disable-line @typescript-eslint/no-floating-promises

    if (isMounted.current) {
      setLayerNameToAdd(undefined);
    }
  }, [
    attachLayer,
    needsFeatureSelection,
    setLayerNameToAdd,
    layerNameToAdd,
    activeViewport,
    sources,
    backgroundLayers,
    isOverlay,
    overlayLayers,
    onLayerAttached,
    handleModalUrlDialogOk,
    handleSelectFeaturesCancel,
    handleSelectFeaturesOk,
    handleModalUrlDialogCancel,
    onHandleOutsideClick,
    openFeatureSelectionDialog,
    mapLayerOptions,
    setMapUrlModalOpen,
  ]);

  const options = React.useMemo(() => sources, [sources]);

  const filteredOptions = React.useMemo(() => {
    if (undefined === sourceFilterString || 0 === sourceFilterString.length) {
      return options;
    } else {
      return options?.filter((option) => option.name.toLowerCase().includes(sourceFilterString?.toLowerCase()));
    }
  }, [options, sourceFilterString]);

  const handleAddNewMapSource = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation(); // We don't want the owning ListBox to react on mouse click.
    setMapUrlModalOpen(true);
    UiFramework.dialogs.modal.open(
      <MapUrlDialog
        activeViewport={activeViewport}
        onOkResult={(result?: SourceState) => handleModalUrlDialogOk(LayerAction.New, result)}
        onCancelResult={handleModalUrlDialogCancel}
        mapLayerOptions={mapLayerOptions}
      />,
    );
    if (onHandleOutsideClick) {
      onHandleOutsideClick(false);
    }
}, [activeViewport, handleModalUrlDialogCancel, handleModalUrlDialogOk, mapLayerOptions, onHandleOutsideClick, setMapUrlModalOpen]);

  const handleAttach = React.useCallback((mapName: string) => {
    setLayerNameToAdd(mapName);
  }, []);

  const handleNoConfirmation = React.useCallback(
    (_layerName: string) => {
      UiFramework.dialogs.modal.close();
      resumeOutsideClick();
    },
    [resumeOutsideClick],
  );

  const handleYesConfirmation = React.useCallback(
    async (source: MapLayerSource) => {
      const layerName = source.name;
      if (!!iTwinId) {
        try {
          await MapLayerPreferences.deleteByName(source, iTwinId, iModelId);
          const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefSuccess", { layerName });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
        } catch {
          const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefError", { layerName });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        }
      }

      UiFramework.dialogs.modal.close();
      resumeOutsideClick();
    },
    [iTwinId, iModelId, resumeOutsideClick],
  );

  /*
   Handle Remove layer button clicked
  */
  const onItemRemoveButtonClicked = React.useCallback(
    (source: MapLayerSource, event: React.MouseEvent) => {
      event.stopPropagation(); // We don't want the owning ListBox to react on mouse click.

      const layerName = source.name;

      const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefDialogMessage", { layerName });
      UiFramework.dialogs.modal.open(
        <ConfirmMessageDialog
          className="map-sources-delete-confirmation"
          title={removeLayerDefDialogTitle}
          message={msg}
          maxWidth={400}
          opened
          onYesResult={async () => handleYesConfirmation(source)}
          onNoResult={() => handleNoConfirmation(layerName)}
        />,
      );
      if (onHandleOutsideClick) {
        onHandleOutsideClick(false);
      }
    },
    [handleNoConfirmation, handleYesConfirmation, onHandleOutsideClick, removeLayerDefDialogTitle],
  );

  /*
 Handle Edit layer button clicked
 */
  const onItemEditButtonClicked = React.useCallback(
    (event: React.MouseEvent, source: MapLayerSource) => {
      event.stopPropagation(); // We don't want the owning ListBox to react on mouse click.

      // we expect a single layer source matching this name
      if (source === undefined) {
        return;
      }
      setMapUrlModalOpen(true);
      UiFramework.dialogs.modal.open(
        <MapUrlDialog
          activeViewport={activeViewport}
          mapLayerSourceToEdit={source}
          onOkResult={(result?: SourceState) => handleModalUrlDialogOk(LayerAction.Edit, result)}
          onCancelResult={handleModalUrlDialogCancel}
          mapLayerOptions={mapLayerOptions}
        />,
      );

      if (onHandleOutsideClick) {
        onHandleOutsideClick(false);
      }
    },
    [activeViewport, handleModalUrlDialogCancel, handleModalUrlDialogOk, mapLayerOptions, onHandleOutsideClick, setMapUrlModalOpen],
  );

  return (
    <div className="map-manager-header">
      {(loading || loadingSources) && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          zIndex: 100,
        }}>
          <ProgressRadial as="div"/>
        </div>
      )}
      <div className="map-manager-source-listbox-header">
        <Input
          type="text"
          className="map-manager-source-list-filter"
          placeholder={placeholderLabel}
          value={sourceFilterString}
          onChange={handleFilterTextChanged}
          size="small"
        />
        <Button className="map-manager-add-source-button" title={addCustomLayerToolTip} onClick={handleAddNewMapSource}>
          {addCustomLayerLabel}
        </Button>
      </div>
      <div className="map-manager-sources">
        <List
          id="map-sources"
          as="div"
          className="map-manager-source-list"
        >
          {filteredOptions?.map((source) => (
            <ListItem
              as="div"
              key={source.name}
              className="map-source-list-entry"
              actionable
              onClick={() => handleAttach(source.name)}
              onMouseEnter={() => setLayerNameUnderCursor(source.name)}
              onMouseLeave={() => setLayerNameUnderCursor(undefined)}
            >
              <ListItem.Content>{source.name}</ListItem.Content>
              {
                // Display the delete icon only when the mouse over a specific item
                // otherwise list feels cluttered.
                !!iTwinId && layerNameUnderCursor && layerNameUnderCursor === source.name && (
                  <>
                    <IconButton
                      size="small"
                      styleType="borderless"
                      className="map-source-list-entry-button"
                      label={editLayerDefButtonTitle}
                      onClick={(e)=>onItemEditButtonClicked(e, source)}
                    >
                      <SvgEdit />
                    </IconButton>
                    <IconButton
                      size="small"
                      styleType="borderless"
                      className="map-source-list-entry-button"
                      label={removeLayerDefButtonTitle}
                      onClick={(event: React.MouseEvent) => {
                        onItemRemoveButtonClicked(source, event);
                      }}
                    >
                      <SvgDelete />
                    </IconButton>
                  </>
                )
              }
            </ListItem>
          ))}
        </List>
      </div>
    </div>
  );
}

/** @internal */
export enum AttachLayerButtonType {
  Primary,
  Blue,
  Icon,
}
export interface AttachLayerPopupButtonProps {
  isOverlay: boolean;
  buttonType?: AttachLayerButtonType;
  disabled?: boolean;
}

/** @internal */
export function AttachLayerPopupButton(props: AttachLayerPopupButtonProps) {
  const { showAttachLayerLabel, hideAttachLayerLabel, addCustomLayerButtonLabel } = React.useMemo(() => {
    return {
      showAttachLayerLabel: MapLayersUI.localization.getLocalizedString("mapLayers:AttachLayerPopup.Attach"),
      hideAttachLayerLabel: MapLayersUI.localization.getLocalizedString("mapLayers:AttachLayerPopup.Close"),
      addCustomLayerButtonLabel: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.AddCustomLayerButtonLabel"),
    };
  }, []);

  const [handleOutsideClick, setHandleOutsideClick] = React.useState(true);
  const [mapUrlModalOpen, setMapUrlModalOpen] = React.useState(false);
  const [popupOpen, setPopupOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const togglePopup = React.useCallback(() => {
    setPopupOpen(!popupOpen);
  }, [popupOpen]);


  const { refreshFromStyle } = useSourceMapContext();

  const handleLayerAttached = React.useCallback(() => {
    if (!isMounted.current) {
      return;
    }
    setPopupOpen(false);
    refreshFromStyle();
  }, [refreshFromStyle]);

  function renderButton(): React.ReactNode {
    let button: React.ReactNode;

    if (props.buttonType === undefined || props.buttonType === AttachLayerButtonType.Icon) {
      button = (
        <IconButton
          disabled={props.disabled}
          size="small"
          styleType="borderless"
          ref={buttonRef}
          className="map-manager-attach-layer-button"
          label={popupOpen ? hideAttachLayerLabel : showAttachLayerLabel}
          onClick={togglePopup}
        >
          <SvgAdd />
        </IconButton>
      );
    } else {
      const determineStyleType = () => {
        switch (props.buttonType) {
          case AttachLayerButtonType.Blue:
            return "high-visibility";
          case AttachLayerButtonType.Primary:
          default:
            return "cta";
        }
      };
      const styleType = determineStyleType();
      button = (
        <Button
          disabled={props.disabled}
          ref={buttonRef}
          styleType={styleType}
          title={popupOpen ? hideAttachLayerLabel : showAttachLayerLabel}
          onClick={togglePopup}
        >
          <span className="map-manager-attach-layer-label">{addCustomLayerButtonLabel}</span>
        </Button>
      );
    }

    return button;
  }

  return (
    <>
      <Popover
        content={
          <div ref={panelRef} className="map-sources-popup-panel">
            <AttachLayerPanel isOverlay={props.isOverlay} onLayerAttached={handleLayerAttached} onHandleOutsideClick={setHandleOutsideClick} setMapUrlModalOpen={setMapUrlModalOpen} />
          </div>
        }
        applyBackground
        visible={popupOpen || mapUrlModalOpen} // keep the Popover open while the mapUrlModal is active
        onVisibleChange={setPopupOpen}
        closeOnOutsideClick={handleOutsideClick}
        placement={"bottom-end"}
      >
        {renderButton()}
      </Popover>
    </>
  );
}
