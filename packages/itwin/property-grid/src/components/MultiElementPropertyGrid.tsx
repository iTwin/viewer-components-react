/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./MultiElementPropertyGrid.scss";

import type { InstanceKey, KeySet } from "@itwin/presentation-common";
import type { SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import {
  FrontstageManager,
  UiFramework,
  useActiveFrontstageDef,
  useActiveIModelConnection,
} from "@itwin/appui-react";
import {
  SvgArrowDown,
  SvgArrowUp,
  SvgPropertiesList,
} from "@itwin/itwinui-icons-react";

import type { PropertyGridProps } from "../types";
import { ElementList } from "./ElementList";
import { PropertyGrid } from "./PropertyGrid";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { WidgetState } from "@itwin/appui-abstract";
import { Id64, Logger } from "@itwin/core-bentley";
import { IconButton } from "@itwin/itwinui-react";
import { PropertyGridManager } from "../PropertyGridManager";

const PropertyGridSelectionScope = "Property Grid";
const LOGGER_CATEGORY = "PropertyGrid";

enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

export const MultiElementPropertyGridId = "vcr:MultiElementPropertyGrid";

export const MultiElementPropertyGrid = (props: PropertyGridProps) => {
  const { enableAncestorNavigation } = props;
  const iModelConnection = useActiveIModelConnection();
  const [content, setContent] = useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );
  const [instanceKeys, setInstanceKeys] = useState<InstanceKey[]>([]);
  const [selectedInstanceKey, setSelectedInstanceKey] =
    useState<InstanceKey>();
  const widgetDef = useSpecificWidgetDef(MultiElementPropertyGridId);
  const [hasParent, setHasParent] = useState(true);
  const [ancestorKeys, setAncestorKeys] = useState<InstanceKey[]>([]);

  useEffect(() => {
    const onSelectionChange = (args?: SelectionChangeEventArgs) => {
      setContent(MultiElementPropertyContent.PropertyGrid);
      if (iModelConnection) {
        const selectionSet =
          Presentation.selection.getSelection(iModelConnection);
        const instanceKeys: InstanceKey[] = [];
        selectionSet.instanceKeys.forEach(
          (ids: Set<string>, className: string) => {
            ids.forEach((id: string) => {
              instanceKeys.push({
                id,
                className,
              });
            });
          }
        );

        // if selection is not from us, clear the ancestry
        if (undefined === args || args.source !== PropertyGridSelectionScope) {
          setInstanceKeys([]);
          setAncestorKeys([]);
        }

        setInstanceKeys(instanceKeys);
        setSelectedInstanceKey(undefined);
      }
    };

    const onFrontstageReady = () => {
      onSelectionChange();
    };

    // ensure this selection handling runs if component mounts after the selection event fires:
    onSelectionChange();

    const removePresentationListener = Presentation.selection.selectionChange.addListener(onSelectionChange);
    // if the frontstage changes and a selection set is already active we need to resync this widget's state with that selection
    const removeFrontstageReadyListener = FrontstageManager.onFrontstageReadyEvent.addListener(onFrontstageReady);
    return () => {
      removePresentationListener();
      removeFrontstageReadyListener();
    };
  }, [iModelConnection]);

  useEffect(() => {
    // update the ancestry when the instanceKeys change
    if (enableAncestorNavigation) {
      if (instanceKeys.length === 1) {
        const currentKey = instanceKeys[0];
        if (undefined === ancestorKeys.find((key) => key.id === currentKey.id && key.className === currentKey.className)) {
          setAncestorKeys([...ancestorKeys, currentKey]);
        }
      }
    }
  }, [instanceKeys, ancestorKeys, enableAncestorNavigation]);

  useEffect(() => {
    const getSingleElementId = (keys?: KeySet): string | undefined => {
      let elementIds = new Set<string>();
      if (keys?.instanceKeysCount === 1) {
        keys.instanceKeys.forEach((ids: Set<string>) => {
          elementIds = new Set([...elementIds, ...ids]);
        });
        if (elementIds.size === 1) {
          return [...elementIds][0];
        }
      }
      return undefined;
    };

    // determine if the current instance key has a parent
    if (enableAncestorNavigation) {
      if (iModelConnection && instanceKeys?.length === 1) {
        const elementId = instanceKeys[0].id;
        Presentation.selection.scopes.computeSelection(
          iModelConnection,
          elementId,
          { id: "element", ancestorLevel: 1 })
          .then((parentKeys) => {
            setHasParent(getSingleElementId(parentKeys) !== elementId);
          })
          .catch((error) => {
            Logger.logException(LOGGER_CATEGORY, error as Error);
          });
      }
    }
  }, [iModelConnection, instanceKeys, enableAncestorNavigation]);

  const onInfoButton = () => {
    setContent(MultiElementPropertyContent.ElementList);
  };

  const onNavigateUp = useCallback(
    async () => {
      if (!iModelConnection)
        return;

      const selectedId = instanceKeys[0].id;
      if (selectedId) {
        const parentKeys = await Presentation.selection.scopes.computeSelection(
          iModelConnection,
          selectedId,
          { id: "element", ancestorLevel: 1 }
        );
        Presentation.selection.replaceSelection(
          PropertyGridSelectionScope,
          iModelConnection,
          parentKeys
        );
      }
    },
    [iModelConnection, instanceKeys]
  );

  const onNavigateDown = useCallback(
    async () => {
      if (!iModelConnection)
        return;

      const newAncestor = [...ancestorKeys];
      // pop the top parent
      newAncestor.pop();
      // pop the next parent (which will be the selected instance key),
      // it will be added back to ancestry in the selection listener (above).
      const currentKey = newAncestor.pop();
      setAncestorKeys(newAncestor);
      // select the current instance key
      if (currentKey) {
        Presentation.selection.replaceSelection(
          PropertyGridSelectionScope,
          iModelConnection,
          [currentKey]
        );
      }
    },
    [iModelConnection, ancestorKeys]
  );

  const items = [
    ...useMemo(() => {
      const moreThanOneElement = instanceKeys.length > 1;
      const _items = [
        <PropertyGrid
          {...props}
          headerContent={
            moreThanOneElement
              ?
              <IconButton
                className="property-grid-react-multi-select-icon"
                size="small"
                styleType="borderless"
                onClick={onInfoButton}
                onKeyDown={onInfoButton}
                title={PropertyGridManager.translate("element-list.title")}
                tabIndex={0}
              >
                <SvgPropertiesList />
              </IconButton>
              :
              enableAncestorNavigation
                ?
                <>
                  {hasParent &&
                    <IconButton
                      size="small"
                      styleType="borderless"
                      title={PropertyGridManager.translate("tools.navigateUpTooltip")}
                      onClick={onNavigateUp}
                      tabIndex={0}
                    >
                      <SvgArrowUp />
                    </IconButton>
                  }
                  {ancestorKeys.length > 1 &&
                    <IconButton
                      size="small"
                      styleType="borderless"
                      title={PropertyGridManager.translate("tools.navigateDownTooltip")}
                      onClick={onNavigateDown}
                    >
                      <SvgArrowDown />
                    </IconButton>
                  }
                </>
                : undefined
          }
          key={"PropertyGrid"}
        />,
      ];
      if (iModelConnection) {
        _items.push(
          <ElementList
            iModelConnection={iModelConnection}
            instanceKeys={instanceKeys}
            onBack={() => {
              setContent(MultiElementPropertyContent.PropertyGrid);
            }}
            onSelect={(instanceKey: InstanceKey) => {
              setContent(MultiElementPropertyContent.SingleElementPropertyGrid);
              setSelectedInstanceKey(instanceKey);
            }}
            rootClassName={props.rootClassName}
            key={"ElementList"}
          />
        );
      }

      return _items;
    }, [props, iModelConnection, instanceKeys, ancestorKeys, onNavigateUp, onNavigateDown, hasParent, enableAncestorNavigation]),
  ];

  items.push(
    <PropertyGrid
      {...props}
      instanceKey={selectedInstanceKey}
      disableUnifiedSelection={true}
      onBackButton={() => {
        setContent(MultiElementPropertyContent.ElementList);
      }}
      key={"SingleElementPropertyGrid"}
    />
  );

  useEffect(() => {
    if (UiFramework.uiVersion !== "1") {
      if (instanceKeys.some((key) => !Id64.isTransient(key.id))) {
        widgetDef?.setWidgetState(WidgetState.Open);
      } else {
        widgetDef?.setWidgetState(WidgetState.Hidden);
      }
    }
  }, [widgetDef, instanceKeys]);

  return (
    <div className="property-grid-react-transition-container">
      <div className="property-grid-react-transition-container-inner">
        {items.map((component, idx) => (
          <div key={component.key} className={classnames({
            "property-grid-react-animated-tab": true,
            "property-grid-react-animated-tab-animate-right": idx > content,
            "property-grid-react-animated-tab-animate-left": idx < content,
          })} >
            {component}
          </div>
        ))}
      </div>
    </div>
  );
};
