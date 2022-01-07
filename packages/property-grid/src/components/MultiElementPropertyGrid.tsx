/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./MultiElementPropertyGrid.scss";

import { InstanceKey, KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import {
  ConfigurableCreateInfo,
  useActiveIModelConnection,
  WidgetControl,
} from "@itwin/appui-react";
import { animated, Transition } from "react-spring/renderprops.cjs";

import { AutoExpandingPropertyDataProvider } from "../api/AutoExpandingPropertyDataProvider";
import { PropertyGridProps } from "../types";
import { ElementList } from "./ElementList";
import { PropertyGrid } from "./PropertyGrid";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOptionalDisposable } from "@itwin/core-react";

export enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

interface SingleElementPropertyGridProps extends PropertyGridProps {
  instanceKey?: InstanceKey;
}

const SingleElementPropertyGrid = ({
  instanceKey,
  ...props
}: SingleElementPropertyGridProps) => {
  /* gah, why do we have this again? why dont we just pass the instanceKey into the property grid? */
  const iModelConnection = useActiveIModelConnection();
  const createDataProvider = useCallback(() => {
    let dp;
    if (iModelConnection) {
      dp = new AutoExpandingPropertyDataProvider({
        imodel: iModelConnection,
        ruleset: props.rulesetId,
        disableFavoritesCategory: !props.enableFavoriteProperties,
      });
      if (instanceKey) {
        // Set inspected instance as the key
        dp.keys = new KeySet([instanceKey]);
      }
    }
    return dp;
  }, [
    iModelConnection,
    props.rulesetId,
    props.enableFavoriteProperties,
    props.enablePropertyGroupNesting,
    instanceKey,
  ]);

  const dataProvider = useOptionalDisposable(createDataProvider);

  return (
    <PropertyGrid
      {...props}
      dataProvider={dataProvider}
      disableUnifiedSelection={true}
    />
  );
};

export const MultiElementPropertyGrid = (props: PropertyGridProps) => {
  const iModelConnection = useActiveIModelConnection();
  const [content, setContent] = useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );
  const [animationForward, setAnimationForward] = useState(true);
  const [instanceKeys, setInstanceKeys] = useState<InstanceKey[]>([]);
  const [moreThanOneElement, setMoreThanOneElement] = useState(false);
  const [selectedInstanceKey, setSelectedInstanceKey] =
    useState<InstanceKey>();

  useEffect(() => {
    const onSelectionChange = () => {
      setContent(MultiElementPropertyContent.PropertyGrid);
      setAnimationForward(false);
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
        setInstanceKeys(instanceKeys);
        setMoreThanOneElement(selectionSet.instanceKeysCount > 1);
        setSelectedInstanceKey(undefined);
      }
    };

    const removeListener = Presentation.selection.selectionChange.addListener(onSelectionChange);
    return () => removeListener();
  }, [iModelConnection]);

  const items = [
    ...useMemo(() => {
      const _items = [
        <PropertyGrid
          {...props}
          onInfoButton={
            moreThanOneElement
              ? () => {
                setContent(MultiElementPropertyContent.ElementList);
                setAnimationForward(true);
              }
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
              setAnimationForward(false);
            }}
            onSelect={(instanceKey: InstanceKey) => {
              setContent(MultiElementPropertyContent.SingleElementPropertyGrid);
              setSelectedInstanceKey(instanceKey);
              setAnimationForward(true);
            }}
            rootClassName={props.rootClassName}
            key={"ElementList"}
          />
        );
      }

      return _items;
    }, [props, moreThanOneElement, iModelConnection, instanceKeys]),
  ];

  items.push(
    <SingleElementPropertyGrid
      {...props}
      instanceKey={selectedInstanceKey}
      onBackButton={() => {
        setContent(MultiElementPropertyContent.ElementList);
        setAnimationForward(false);
      }}
      key={"SingleElementPropertyGrid"}
    />
  );

  return (
    <div className="property-grid-react-transition-container">
      <div className="property-grid-react-transition-container-inner">
        <Transition
          items={content as number}
          config={{ duration: 250, easing: (t: number) => t * t }}
          from={{
            transform: animationForward
              ? "translate(100%,0)"
              : "translate(-100%,0)",
          }}
          enter={{ transform: "translate(0,0)" }}
          leave={{
            transform: !animationForward
              ? "translate(100%,0)"
              : "translate(-100%,0)",
          }}
        >
          {(index) => (style) =>
          (
            <animated.div
              className="property-grid-react-animated-tab"
              style={style}
            >
              {items[index]}
            </animated.div>
          )}
        </Transition>
      </div>
    </div>
  );
};

export class MultiElementPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: PropertyGridProps) {
    super(info, options);

    this.reactNode = <MultiElementPropertyGrid {...options} />;
  }
}
