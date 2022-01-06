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
import * as React from "react";
import { animated, Transition } from "react-spring/renderprops.cjs";

import { AutoExpandingPropertyDataProvider } from "../api/AutoExpandingPropertyDataProvider";
import { PropertyGridProps } from "../types";
import { ElementList } from "./ElementList";
import { PropertyGrid } from "./PropertyGrid";

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
  const iModelConnection = useActiveIModelConnection();
  const dataProvider = React.useMemo(() => {
    let dp;

    if (iModelConnection) {
      dp = new AutoExpandingPropertyDataProvider({
        imodel: iModelConnection,
        ruleset: props.rulesetId,
        disableFavoritesCategory: !props.enableFavoriteProperties,
      });
    }

    if (dp) {
      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled =
        !!props.enablePropertyGroupNesting;
      // Set inspected instance as the key
      if (instanceKey) {
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
  const [content, setContent] = React.useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );
  const [animationForward, setAnimationForward] = React.useState(true);
  const [instanceKeys, setInstanceKeys] = React.useState<InstanceKey[]>([]);
  const [moreThanOneElement, setMoreThanOneElement] = React.useState(false);
  const [selectedInstanceKey, setSelectedInstanceKey] =
    React.useState<InstanceKey>();

  React.useEffect(() => {
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

    Presentation.selection.selectionChange.addListener(onSelectionChange);
    return () => {
      Presentation.selection.selectionChange.removeListener(onSelectionChange);
    };
  }, [iModelConnection]);

  const items = [
    ...React.useMemo(() => {
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
              // Need to set animation first, otherwise the animation is incorrect. Theres some issue batching these state changes.
              setAnimationForward(true);
              setContent(MultiElementPropertyContent.SingleElementPropertyGrid);
              setSelectedInstanceKey(instanceKey);
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
        {/* eslint-disable-next-line react/display-name */}
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
  );
};

export class MultiElementPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: PropertyGridProps) {
    super(info, options);

    this.reactNode = <MultiElementPropertyGrid {...options} />;
  }
}
