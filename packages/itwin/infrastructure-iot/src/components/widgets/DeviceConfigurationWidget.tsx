/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useState } from "react";

import { Icon, LoadingSpinner, SearchBox } from "@itwin/core-react";
import { Alert, Button, IconButton, Select, Slider, ToggleSwitch, Tooltip, useTheme } from "@itwin/itwinui-react";

import InfiniteScroll from "react-infinite-scroll-component";

import type { AlertPriority } from "../../enums/alerts/AlertPriorityEnum";
import { IModelMarkerStyle } from "../../enums/imodel/IModelMarkerStyleEnum";
import type { AuthState } from "../../models/auth/AuthStateModel";
import { IModelSettings } from "../../models/imodel/IModelSettingsModel";
import { EntityType } from "../../enums/entities/EntityTypeEnum";
import { SearchQuery } from "../../models/SearchQueryModel";
import type { Sensor } from "../../models/entities/SensorModel";
import { AlertPriorityMetadata } from "../../models/alerts/AlertPriorityMetadataModel";
import type { AlertPriorityMetadataObject } from "../../models/alerts/AlertPriorityMetadataObjectInterface";
import { AuthService } from "../../services/AuthService";
import { EntityService } from "../../services/entities/EntityService";
import { IModelSettingsService } from "../../services/imodel/IModelSettingsService";
import { UtilitiesService } from "../../services/UtilitiesService";

import { ExpandableBlockWrapper } from "../partials/ExpandableBlockWrapper";
import { InputColorPicker } from "../partials/inputs/InputColorPicker";

import appStyles from "../../styles/App.module.scss";
import styles from "./DeviceConfigurationWidget.module.scss";

export function DeviceConfigurationWidget() {

  // This is needed to iTwin React component to respect system-wide light/dark mode
  useTheme("os");

  // Save re-usable variables
  const searchQuery = useMemo(() => new SearchQuery(), []);
  const alertPriorityColorPresets = useMemo(() => AlertPriorityMetadata.getDefaultAlertColors(), []);

  // Initialize AuthState state management and subscription
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [canSave, setCanSave] = useState<boolean>(true);
  useEffect(() => {

    // Subscribe to auth state changes, show welcome screen or actual widget content
    const authStateSubscription = AuthService
      .authState$()
      .subscribe((authState: AuthState | null) => {
        setIsLoadingAuth(false);
        setAuthState(authState);

        if (authState) {
          setCanSave(authState.hasSettingsWriteAccess());
        }
      });

    return () => authStateSubscription.unsubscribe();

  }, []);

  // Initialize iModelSettings state management and subscription
  const [iModelSettings, setIModelSettings] = useState<IModelSettings>(new IModelSettings());
  useEffect(() => {

    // Subscribe to global iModel settings, show saved user selections
    const iModelSettingsSubscription = IModelSettingsService.iModelSettings$()
      .subscribe((iModelSettings: IModelSettings) => {
        setIModelSettings(iModelSettings);
      });

    return () => {
      iModelSettingsSubscription.unsubscribe();
    };
  }, []);

  // Initialize sensor list state management and subscription
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [hasSensors, setHasSensors] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("props.NAME");
  useEffect(() => {
    const sensorSubscription = EntityService
      .getEntities$(EntityType.SENSOR, searchQuery)
      .subscribe({
        next: (sensors: any[]) => {
          setHasSensors(!!sensors.length);
          setSensors(sensors as Sensor[]);
        },
        error: () => {},
      });

    return () => {
      sensorSubscription.unsubscribe();
    };
  }, [searchQuery]);

  const getNextPage = () => {
    searchQuery.incrementPageNumber();

    EntityService
      .getEntities$(EntityType.SENSOR, searchQuery)
      .subscribe({
        next: (nextSensors: any[]) => setSensors([...sensors, ...nextSensors as Sensor[]]),
        error: () => {},
      });
  };

  const getSensorData = () => {
    EntityService
      .getEntities$(EntityType.SENSOR, searchQuery)
      .subscribe({
        next: (sensors: any[]) => setSensors(sensors as Sensor[]),
        error: () => {},
      });
  };

  const search = (val: string) => {
    searchQuery.setSearchFor(val);
    setSensors([]);
    getSensorData();
  };

  const handleSort = (val: string) => {
    if (val !== sortBy) {
      let sortOrder: "asc" | "desc" = "asc";
      if (val === "lastActivity" || val === "props.OBSERVATION_COUNT") {
        sortOrder = "desc";
      }
      setSortBy(val);
      searchQuery.setSortBy([val]);
      searchQuery.setSortOrder(sortOrder);
      getSensorData();
    }
  };

  const onMarkerVisibilityChange = (event: any): void => {
    iModelSettings.setMarkerVisibility(event.target.checked);
    IModelSettingsService.setIModelSettings(iModelSettings);
  };

  const onMarkerStyleChange = (newValue: IModelMarkerStyle): void => {
    if (newValue !== iModelSettings.getMarkerStyle()) {
      iModelSettings.setMarkerStyle(newValue);
      IModelSettingsService.setIModelSettings(iModelSettings);
    }
  };

  const onMarkerSizeChange = (newValue: any): void => {
    iModelSettings.setMarkerSize(newValue[0]);
    IModelSettingsService.setIModelSettings(iModelSettings);
  };

  const onAlertPriorityColorChange = (priority: AlertPriority | "default", newValue: string): void => {
    iModelSettings.setAlertPriorityDisplayStyle(priority, {color: newValue});
    IModelSettingsService.setIModelSettings(iModelSettings);
  };

  return (
    <div className={appStyles["widget-wrapper"]}>
      {!authState ? (
        <div>
          {isLoadingAuth ? (<LoadingSpinner/>) :
            <div className={`${appStyles["text-center"]} ${appStyles["mt-4"]}`}>
              No IoT projects have been associated with this iModel.
              {" "}<a
                href={UtilitiesService.getSupportLink("projectAssociation")}
                target="_blank"
                rel="noopener noreferrer">Click here</a>{" "}
              to learn how to associate IoT projects.
            </div>
          }
        </div>
      ) : (
        <div>
          <div className={`${appStyles["row-with-label"]} ${appStyles["mb-1"]}`}>
            <div>Project name:</div>
            <div>{authState.getProjectName()}</div>
          </div>
          <div className={appStyles["row-with-label"]}>
            <div>Project ID:</div>
            <div>{authState.getProjectId()}</div>
          </div>

          {!canSave && (
            <div className={`${appStyles["mt-4"]} ${appStyles["mb-6"]} ${styles["alert-msg"]}`}>
              <Alert type="informational">You do not have sufficient permissions to change IoT sensor settings.</Alert>
            </div>
          )}

          {canSave && (
            <ExpandableBlockWrapper
              className={`${appStyles["mt-4"]} ${appStyles["mb-6"]}`}
              title="Display Settings"
              isCollapsed={true}>
              <h4 className={styles["display-settings-sub-header"]}>
                Sensor Display
              </h4>
              <div className={appStyles["row-with-label"]}>
                <div>Show sensors:</div>
                <div>
                  <ToggleSwitch checked={iModelSettings.getMarkerVisibility()} onChange={onMarkerVisibilityChange}/>
                </div>
              </div>
              {iModelSettings.getMarkerVisibility() && (
                <div className={appStyles["mt-3"]}>
                  <div className={appStyles["row-with-label"]}>
                    <div>Style:</div>
                    <div>
                      <Select
                        size="small"
                        options={[
                          { value: IModelMarkerStyle.OVERLAY, label: "Markers" },
                          { value: IModelMarkerStyle.ELEMENT, label: "Elements" },
                        ]}
                        value={iModelSettings.getMarkerStyle()}
                        onChange={(newValue: IModelMarkerStyle) => onMarkerStyleChange(newValue)}/>
                    </div>
                  </div>
                  {iModelSettings.getMarkerStyle() === IModelMarkerStyle.OVERLAY && (
                    <div className={`${appStyles["row-with-label"]} ${appStyles["mt-2"]}`}>
                      <div>Marker size:</div>
                      <div>
                        <Slider
                          min={IModelSettings.minMarkerSize}
                          minLabel=""
                          max={IModelSettings.maxMarkerSize}
                          maxLabel=""
                          tooltipProps={() => { return {visible: false }; }}
                          values={[iModelSettings.getMarkerSize()]}
                          onChange={onMarkerSizeChange}/>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <hr/>

              <h4 className={styles["display-settings-sub-header"]}>
                Alert Colors
              </h4>
              {
                AlertPriorityMetadata.getAllMetadata().map(
                  (metadata: AlertPriorityMetadataObject, idx: number, allMetadata: any[]) => {
                    const displayStyle = iModelSettings.getAlertPriorityDisplayStyle(metadata.id);
                    let className = appStyles["row-with-label"];
                    if (idx < allMetadata.length - 1) {
                      className += ` ${appStyles["mb-1"]}`;
                    }
                    return <div key={metadata.id} className={className} >
                      <div>{displayStyle.name}:</div>
                      <div className={styles["display-settings-color-picker"]}>
                        <InputColorPicker
                          presetColors={alertPriorityColorPresets}
                          value={displayStyle.color}
                          onChange={(newValue: string) => {
                            onAlertPriorityColorChange(metadata.id, newValue);
                          }}/>
                      </div>
                    </div>;
                  }
                )
              }
            </ExpandableBlockWrapper>
          )}

          <hr/>

          <div>
            <div className={styles["sensor-table-sub-header"]}>
              <h4>
                Sensor Associations
              </h4>
              {canSave && (
                <Button
                  className={appStyles["button-sm"]}
                  size="small"
                  styleType="borderless"
                  onClick={() => IModelSettingsService.deleteAllEntityAssociations()}>
                  Remove All
                </Button>
              )}
            </div>

            <div className={styles["filters-container"]}>
              <SearchBox
                className={styles["search-box"]}
                placeholder={"Search sensors..."}
                onValueChanged={(val: string) => search(val)}
                valueChangedDelay={250}/>

              <div className={styles["sort-container"]}>
                <div>Sort by:</div>
                <Select
                  className={styles["sort-select-input"]}
                  size="small"
                  value={sortBy}
                  onChange={(val: string) => handleSort(val)}
                  options={[
                    { value: "props.NAME", label: "Name" },
                    { value: "type", label: "Type" },
                    { value: "status", label: "Status" },
                    { value: "lastActivity", label: "Last Activity" },
                    { value: "props.OBSERVATION_COUNT", label: "Observations" },
                  ]}/>
              </div>
            </div>

            <InfiniteScroll
              next={() => getNextPage()}
              hasMore={!searchQuery.isEndOfResults()}
              loader={<LoadingSpinner/>}
              endMessage={
                <div className={appStyles["text-center"]}>
                  {!hasSensors ? "No sensors added to project." : ""}
                </div>
              }
              height={400}
              dataLength={sensors.length}>
              <div className={styles["sensor-table"]}>
                <table cellPadding={0} cellSpacing={0}>
                  <thead>
                    <tr>
                      {canSave && <th></th>}
                      <th>Sensor</th>
                      <th>Element</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      sensors.map((sensor: Sensor) => {
                        return <tr key={sensor.getId()}>
                          {canSave && (
                            <td className={styles["action-column"]}>
                              <Tooltip content="Associate sensor with element">
                                <IconButton
                                  className={appStyles["button-xs"]}
                                  size="small"
                                  styleType="borderless"
                                  onClick={() => IModelSettingsService.setEntityAssociation(
                                    sensor.getId()
                                  )}>
                                  <Icon iconSpec="icon-link" />
                                </IconButton>
                              </Tooltip>
                              {iModelSettings.hasAssociation(sensor.getId()) && (
                                <Tooltip content="Remove sensor from iModel">
                                  <IconButton
                                    className={appStyles["button-xs"]}
                                    size="small"
                                    styleType="borderless"
                                    onClick={() => IModelSettingsService.setEntityAssociation(
                                      sensor.getId(),
                                      true
                                    )}>
                                    <Icon iconSpec="icon-close-circular" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </td>
                          )}
                          <td>
                            {iModelSettings.hasAssociation(sensor.getId()) ? (
                              <Tooltip content="Center view on sensor">
                                <Button
                                  className={appStyles["button-link"]}
                                  styleType="borderless"
                                  onClick={() => IModelSettingsService.setSelectedEntity(
                                    sensor,
                                    iModelSettings.getAssociation(sensor.getId())?.getElementId() as string
                                  )}>
                                  {sensor.getName()}
                                </Button>
                              </Tooltip>
                            ) : (
                              sensor.getName()
                            )}
                          </td>
                          <td>
                            {iModelSettings.hasAssociation(sensor.getId()) ? (
                              iModelSettings.getAssociation(sensor.getId())?.getElementName()
                            ) : (
                              <span className={appStyles["color-muted"]}>No association</span>
                            )}
                          </td>
                        </tr>;
                      })
                    }
                  </tbody>
                </table>
                <div>
                  { searchQuery.isNoResultsFound() && hasSensors &&
                  <div className={`${appStyles["text-center"]} ${appStyles["mt-4"]} ${appStyles["mb-4"]}`}>
                    No sensors found.
                  </div>
                  }
                </div>
              </div>
            </InfiniteScroll>
          </div>
        </div>
      )}
    </div>
  );
}
