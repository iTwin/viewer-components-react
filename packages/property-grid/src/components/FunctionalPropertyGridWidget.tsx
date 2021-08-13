/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import "./PropertyGrid.scss";

import * as React from "react";

import {
  AuthorizedFrontendRequestContext,
  IModelApp,
  IModelConnection,
} from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import {
  IPresentationPropertyDataProvider,
  PresentationPropertyDataProvider,
  usePropertyDataProviderWithUnifiedSelection,
} from "@bentley/presentation-components";
import {
  FavoritePropertiesScope,
  Presentation,
} from "@bentley/presentation-frontend";
import {
  ActionButtonRenderer,
  ActionButtonRendererProps,
  PropertyData,
  PropertyDataFiltererBase,
  PropertyGridContextMenuArgs,
  PropertyValueRendererManager,
  VirtualizedPropertyGridWithDataProvider,
} from "@bentley/ui-components";
import {
  ContextMenuItem,
  FillCentered,
  GlobalContextMenu,
  Icon,
  Orientation,
} from "@bentley/ui-core";
import { useActiveIModelConnection } from "@bentley/ui-framework";
import { PropertyGridManager } from "../PropertyGridManager";
import { SettingsStatus } from "@bentley/product-settings-client";
import { PropertyRecord } from "@bentley/ui-abstract";
import {
  ContextMenuItemInfo,
  PropertyGridProps,
  sharedName,
  sharedNamespace,
} from "./PropertyGrid";
import {
  FilteringPropertyGridWithUnifiedSelection,
  NonEmptyValuesPropertyDataFilterer,
  PlaceholderPropertyDataFilterer,
} from "./FilteringPropertyGrid";
import { copyToClipboard } from "../api/WebUtilities";

const createDataProvider = (
  imodel: IModelConnection | undefined
): PresentationPropertyDataProvider | undefined => {
  if (imodel) {
    const provider = new PresentationPropertyDataProvider({ imodel });
    provider.isNestedPropertyCategoryGroupingEnabled = true;
    return provider;
  }
  return undefined;
};

const useDataProvider = (
  iModelConnection: IModelConnection | undefined,
  propDataProvider?: PresentationPropertyDataProvider | undefined
): PresentationPropertyDataProvider | undefined => {
  const [dataProvider, setDataProvider] = React.useState(
    propDataProvider ?? createDataProvider(iModelConnection)
  );
  React.useEffect(() => {
    setDataProvider(createDataProvider(iModelConnection));
  }, [iModelConnection]);

  return dataProvider;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const FunctionalPropertyGridWidget = ({
  projectId,
  orientation,
  isOrientationFixed,
  enableCopyingPropertyText,
  enableNullValueToggle,
  debugLog,
  featureTracking,
  dataProvider,
  onInfoButton,
  onBackButton,
  disableUnifiedSelection,
}: Partial<PropertyGridProps>) => {
  const iModelConnection = useActiveIModelConnection();
  const projectID = projectId ?? iModelConnection?.contextId;
  const projectDataProvider = useDataProvider(iModelConnection, dataProvider);

  const [title, setTitle] = React.useState<PropertyRecord>();
  const [className, setClassName] = React.useState<string>("");
  const [contextMenu, setContextMenu] = React.useState<
    PropertyGridContextMenuArgs | undefined
  >(undefined);
  const [contextMenuItemInfos, setContextMenuItemInfos] = React.useState<
    ContextMenuItemInfo[] | undefined
  >(undefined);
  const [sharedFavorites, setSharedFavorites] = React.useState<string[]>([]);
  const [showNullValues, setShowNullValues] = React.useState<boolean>(true);
  const [filterer, setFilterer] = React.useState<PropertyDataFiltererBase>(
    new PlaceholderPropertyDataFilterer()
  );

  const localizations = React.useMemo(() => {
    return {
      favorite: PropertyGridManager.translate("context-menu.favorite"),
      unshareFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.unshare-favorite.description"
        ),
        label: PropertyGridManager.translate(
          "context-menu.unshare-favorite.label"
        ),
      },
      shareFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.share-favorite.description"
        ),
        label: PropertyGridManager.translate(
          "context-menu.share-favorite.label"
        ),
      },
      removeFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.remove-favorite.description"
        ),
        label: PropertyGridManager.translate(
          "context-menu.remove-favorite.label"
        ),
      },
      addFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.add-favorite.description"
        ),
        label: PropertyGridManager.translate("context-menu.add-favorite.label"),
      },
      copyText: {
        title: PropertyGridManager.translate(
          "context-menu.copy-text.description"
        ),
        label: PropertyGridManager.translate("context-menu.copy-text.label"),
      },
      hideNull: {
        title: PropertyGridManager.translate(
          "context-menu.hide-null.description"
        ),
        label: PropertyGridManager.translate("context-menu.hide-null.label"),
      },
      showNull: {
        title: PropertyGridManager.translate(
          "context-menu.show-null.description"
        ),
        label: PropertyGridManager.translate("context-menu.show-null.label"),
      },
      tooManySelected: PropertyGridManager.translate(
        "context-menu.selection.too-many-elements-selected"
      ),
      noneSelected: PropertyGridManager.translate(
        "context-menu.selection.no-elements-selected"
      ),
    };
  }, []);

  /**
   * Finds the name of the Favorites category
   * @param propertyRecords
   */
  const getFavoritesCategoryName = React.useCallback(
    async (categories: { [categoryName: string]: PropertyRecord[] }) => {
      const keys = Object.keys(categories);

      for (const key of keys) {
        const category = categories[key];
        for (const record of category) {
          const field = await projectDataProvider?.getFieldByPropertyRecord(
            record
          );
          if (
            field !== undefined &&
            Presentation.favoriteProperties.has(
              field,
              projectID,
              iModelConnection?.iModelId
            )
          ) {
            return key;
          }
        }
      }
      return localizations.favorite;
    },
    [projectDataProvider, iModelConnection?.iModelId, projectID]
  );

  const addSharedFavsToData = React.useCallback(
    async (propertyData: PropertyData) => {
      let newSharedFavs: string[] = [];
      if (projectID) {
        const requestContext = await AuthorizedFrontendRequestContext.create();
        const result = await IModelApp.settings.getSharedSetting(
          requestContext,
          sharedNamespace,
          sharedName,
          false,
          projectID,
          iModelConnection?.iModelId
        );
        if (result.setting?.slice) {
          newSharedFavs = (result.setting as string[]).slice();
        }
        setSharedFavorites(newSharedFavs);
      }
      if (propertyData.categories[0]?.name !== "Favorite") {
        propertyData.categories.unshift({
          name: "Favorite",
          label: "Favorite",
          expand: true,
        });
        propertyData.records.Favorite = [];
      }
      const favoritesCategoryName = await getFavoritesCategoryName(
        propertyData.records
      );
      const dataFavs = propertyData.records[favoritesCategoryName];

      for (const cat of propertyData.categories) {
        if (cat.name !== "Favorite") {
          for (const rec of propertyData.records[cat.name]) {
            const propName = rec.property.name;
            const shared =
              newSharedFavs &&
              newSharedFavs?.findIndex(
                (fav: string) => rec.property.name === fav
              ) >= 0;
            if (
              shared &&
              !dataFavs.find(
                (favRec: PropertyRecord) => favRec.property.name === propName
              )
            ) {
              // if shared & not already in favorites
              dataFavs.push(rec);
              const propertyField =
                await projectDataProvider?.getFieldByPropertyRecord(rec);
              if (propertyField) {
                await Presentation.favoriteProperties.add(
                  propertyField,
                  projectID
                );
              }
            }
          }
        }
      }
      return projectDataProvider?.getData();
    },
    [
      projectDataProvider,
      getFavoritesCategoryName,
      iModelConnection?.iModelId,
      projectID,
    ]
  );

  const onDataChanged = React.useCallback(async () => {
    let propertyData: PropertyData | undefined =
      await projectDataProvider?.getData();
    if (propertyData) {
      propertyData = await addSharedFavsToData(propertyData);
      setTitle(propertyData?.label);
      setClassName(propertyData?.description ?? "");
    }
  }, [projectDataProvider, addSharedFavsToData]);

  React.useEffect(() => {
    const mount = async () => {
      projectDataProvider?.onDataChanged.addListener(onDataChanged);

      let currentData: PropertyData | undefined =
        await projectDataProvider?.getData();
      currentData = await addSharedFavsToData(currentData as PropertyData);

      if (currentData) {
        setTitle(currentData.label);
        setClassName(currentData.description ?? "");
      }
    };

    const unmount = () => {
      if (debugLog) debugLog(`Unmounting Properties Grid`);

      projectDataProvider?.onDataChanged.removeListener(onDataChanged);
    };

    void mount();

    return unmount;
  }, [onDataChanged, projectDataProvider, debugLog, addSharedFavsToData]);

  const onAddFavorite = React.useCallback(
    async (propertyField: Field) => {
      if (iModelConnection)
        await Presentation.favoriteProperties.add(
          propertyField,
          iModelConnection,
          FavoritePropertiesScope.IModel
        );
      setContextMenu(undefined);
    },
    [iModelConnection]
  );

  const onRemoveFavorite = React.useCallback(
    async (propertyField: Field) => {
      if (iModelConnection)
        await Presentation.favoriteProperties.remove(
          propertyField,
          iModelConnection,
          FavoritePropertiesScope.IModel
        );
      setContextMenu(undefined);
    },
    [iModelConnection]
  );

  const onShareFavorite = React.useCallback(
    async (propName: string) => {
      if (!projectID || !sharedFavorites) {
        setContextMenu(undefined);
        return;
      }
      sharedFavorites.push(propName);

      const requestContext = await AuthorizedFrontendRequestContext.create();
      const result = await IModelApp.settings.saveSharedSetting(
        requestContext,
        sharedFavorites,
        sharedNamespace,
        sharedName,
        false,
        projectID,
        iModelConnection?.iModelId
      );
      if (result.status !== SettingsStatus.Success) {
        throw new Error(
          "Could not share favoriteProperties: " + result.errorMessage
        );
      }
      const result2 = await IModelApp.settings.getSharedSetting(
        requestContext,
        sharedNamespace,
        sharedName,
        false,
        projectID,
        iModelConnection?.iModelId
      );
      if (result2.status !== SettingsStatus.Success) {
        throw new Error(
          "Could not share favoriteProperties: " + result2.errorMessage
        );
      }
      setContextMenu(undefined);
    },
    [iModelConnection?.iModelId, projectID, sharedFavorites]
  );

  const onUnshareFavorite = React.useCallback(
    async (propName: string) => {
      if (!projectID || !sharedFavorites) {
        setContextMenu(undefined);
        return;
      }
      const index = sharedFavorites.indexOf(propName);
      if (index > -1) {
        sharedFavorites.splice(index, 1);
      }
      const requestContext = await AuthorizedFrontendRequestContext.create();
      const result = await IModelApp.settings.saveSharedSetting(
        requestContext,
        sharedFavorites,
        sharedNamespace,
        sharedName,
        false,
        projectID,
        iModelConnection?.iModelId
      );
      if (result.status !== SettingsStatus.Success) {
        throw new Error(
          "Could not unshare favoriteProperties: " + result.errorMessage
        );
      }
      setContextMenu(undefined);
    },
    [iModelConnection?.iModelId, projectID, sharedFavorites]
  );

  const shareActionButtonRenderer: ActionButtonRenderer = (
    props: ActionButtonRendererProps
  ) => {
    const shared =
      sharedFavorites !== undefined &&
      sharedFavorites?.findIndex(
        (fav: string) => props.property.property.name === fav
      ) >= 0;
    return (
      <div>
        {shared && (
          <span
            className="icon icon-share"
            style={{ paddingRight: "5px" }}
          ></span>
        )}
      </div>
    );
  };

  const onCopyText = React.useCallback(
    async (property: PropertyRecord) => {
      if (property.description) copyToClipboard(property.description);
      else if (debugLog)
        debugLog(
          "PROPERTIES COPY TEXT FAILED TO RUN DUE TO UNDEFINED PROPERTY RECORD DESCRIPTION"
        );
      setContextMenu(undefined);
    },
    [debugLog]
  );

  const onHideNull = React.useCallback(() => {
    setFilterer(new NonEmptyValuesPropertyDataFilterer());
    setContextMenu(undefined);
    setShowNullValues(false);
  }, []);

  const onShowNull = React.useCallback(() => {
    setFilterer(new PlaceholderPropertyDataFilterer());
    setContextMenu(undefined);
    setShowNullValues(true);
  }, []);

  const setupContextMenu = React.useCallback(
    async (args: PropertyGridContextMenuArgs) => {
      if (iModelConnection && projectDataProvider) {
        const field = await projectDataProvider.getFieldByPropertyRecord(
          args.propertyRecord
        );
        const items: ContextMenuItemInfo[] = [];
        if (
          sharedFavorites &&
          sharedFavorites?.findIndex(
            (fav: string) => args.propertyRecord.property.name === fav
          ) >= 0
        ) {
          // i.e. if shared
          items.push({
            key: "unshare-favorite",
            onSelect: () =>
              onUnshareFavorite(args.propertyRecord.property.name),
            title: localizations.unshareFavorite.title,
            label: localizations.unshareFavorite.label,
          });
        } else if (field !== undefined) {
          if (
            Presentation.favoriteProperties.has(
              field,
              iModelConnection,
              FavoritePropertiesScope.IModel
            )
          ) {
            items.push({
              key: "share-favorite",
              onSelect: () =>
                onShareFavorite(args.propertyRecord.property.name),
              title: localizations.shareFavorite.title,
              label: localizations.shareFavorite.label,
            });
            items.push({
              key: "remove-favorite",
              icon: "icon-remove-2",
              onSelect: async () => onRemoveFavorite(field),
              title: localizations.removeFavorite.title,
              label: localizations.removeFavorite.label,
            });
          } else {
            items.push({
              key: "add-favorite",
              icon: "icon-add",
              onSelect: async () => onAddFavorite(field),
              title: localizations.addFavorite.title,
              label: localizations.addFavorite.label,
            });
          }
        }

        if (enableCopyingPropertyText) {
          items.push({
            key: "copy-text",
            onSelect: async () => {
              if (featureTracking) featureTracking.trackCopyPropertyText();
              await onCopyText(args.propertyRecord);
            },
            title: localizations.copyText.title,
            label: localizations.copyText.label,
          });
        }

        if (enableNullValueToggle || true) {
          if (showNullValues) {
            items.push({
              key: "hide-null",
              onSelect: () => {
                onHideNull();
              },
              title: localizations.hideNull.title,
              label: localizations.hideNull.label,
            });
          } else {
            items.push({
              key: "show-null",
              onSelect: () => {
                onShowNull();
              },
              title: localizations.showNull.title,
              label: localizations.showNull.label,
            });
          }
        }
        setContextMenu(args);
        setContextMenuItemInfos(items.length > 0 ? items : undefined);
      }
    },
    [
      iModelConnection,
      projectDataProvider,
      localizations,
      sharedFavorites,
      showNullValues,
      enableCopyingPropertyText,
      featureTracking,
      enableNullValueToggle,
      onAddFavorite,
      onRemoveFavorite,
      onShareFavorite,
      onUnshareFavorite,
      onCopyText,
      onHideNull,
      onShowNull,
    ]
  );

  const onPropertyContextMenu = React.useCallback(
    (args: PropertyGridContextMenuArgs) => {
      args.event.persist();
      void setupContextMenu(args);
    },
    [setupContextMenu]
  );

  const onContextMenuOutsideClick = () => {
    setContextMenu(undefined);
  };

  const onContextMenuEsc = () => {
    setContextMenu(undefined);
  };

  const renderHeader = () => {
    return (
      <div className="property-grid-react-panel-header">
        {onBackButton !== undefined && (
          <div
            className="property-grid-react-panel-back-btn"
            onClick={onBackButton}
          >
            <Icon
              className="property-grid-react-panel-icon"
              iconSpec="icon-progress-backward"
            />
          </div>
        )}
        <div className="property-grid-react-panel-label-and-class">
          {title && PropertyValueRendererManager.defaultManager.render(title)}
          <span className="property-grid-react-panel-class">{className}</span>
        </div>
        {onInfoButton !== undefined && (
          <div
            className="property-grid-react-panel-info-btn"
            onClick={onInfoButton}
          >
            <Icon
              className="property-grid-react-panel-icon"
              iconSpec="icon-info-hollow"
            />
          </div>
        )}
      </div>
    );
  };

  const renderPropertyGrid = () => {
    const { isOverLimit } =
      // eslint-disable-next-line react-hooks/rules-of-hooks
      usePropertyDataProviderWithUnifiedSelection({
        dataProvider: projectDataProvider as IPresentationPropertyDataProvider,
      });
    if (isOverLimit) {
      return <FillCentered>{localizations.tooManySelected}</FillCentered>;
    }
    if (projectDataProvider) {
      if (disableUnifiedSelection) {
        return (
          <VirtualizedPropertyGridWithDataProvider
            orientation={orientation ?? Orientation.Horizontal}
            isOrientationFixed={isOrientationFixed ?? true}
            dataProvider={projectDataProvider}
            isPropertyHoverEnabled={true}
            isPropertySelectionEnabled={true}
            onPropertyContextMenu={onPropertyContextMenu}
            actionButtonRenderers={[shareActionButtonRenderer]}
          />
        );
      } else {
        return (
          <FilteringPropertyGridWithUnifiedSelection
            orientation={orientation ?? Orientation.Horizontal}
            isOrientationFixed={isOrientationFixed ?? true}
            dataProvider={projectDataProvider}
            filterer={filterer}
            isPropertyHoverEnabled={true}
            isPropertySelectionEnabled={true}
            onPropertyContextMenu={onPropertyContextMenu}
            actionButtonRenderers={[shareActionButtonRenderer]}
          />
        );
      }
    }
    return undefined;
  };

  const renderContextMenu = () => {
    if (!contextMenu || !contextMenuItemInfos) return undefined;

    const items: React.ReactNode[] = [];
    contextMenuItemInfos.forEach((info: ContextMenuItemInfo) =>
      items.push(
        <ContextMenuItem
          key={info.key}
          onSelect={info.onSelect}
          title={info.title}
        >
          {info.label}
        </ContextMenuItem>
      )
    );

    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={onContextMenuOutsideClick}
        onEsc={onContextMenuEsc}
        identifier="PropertiesWidget"
        x={contextMenu.event.clientX}
        y={contextMenu.event.clientY}
      >
        {items}
      </GlobalContextMenu>
    );
  };

  return (
    <div className="property-grid-widget-container">
      {renderHeader()}
      <div className="property-grid-container">{renderPropertyGrid()}</div>
      {renderContextMenu()}
    </div>
  );
};
