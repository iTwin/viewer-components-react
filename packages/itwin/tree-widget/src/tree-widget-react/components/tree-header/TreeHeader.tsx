/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeHeader.scss";
import classnames from "classnames";
import React, { useEffect, useState } from "react";

import type { PropsWithChildren } from "react";
import type { Viewport } from "@itwin/core-frontend";
/** @public */
export interface TreeHeaderButtonProps {
  viewport: Viewport;
  // density?: "default" | "enlarged";
  onFeatureUsed?: (feature: string) => void;
}

/** @beta */
export interface TreeFilteringProps {
  /** Filtering is cleared after everything's loaded */
  onFilterStart: (newFilter: string) => void;
  /** listens for onClick event for Clear (x) icon */
  onFilterClear: () => void;
  /** Total number of results/entries */
  resultCount?: number;
  /** Current selected result index */
  selectedIndex?: number;
  /** Callback to currently selected result/entry change */
  onSelectedChanged?: (index: number) => void;
  /** Should the search box be disabled */
  isDisabled?: boolean;
}

interface TreeHeaderProps {
  filteringProps?: TreeFilteringProps;
  /** Modifies the density of tree header. `enlarged` header contains larger content */
  density?: "default" | "enlarged";
  className?: string;
}

/// TODO: ADD SEARCH BOX
export function TreeHeader(props: PropsWithChildren<TreeHeaderProps>) {
  const { filteringProps, density, className, children } = props;
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  // const { enabled: instanceFocusEnabled } = useFocusedInstancesContext();
  const size = density === "enlarged" ? "large" : "small";

  useEffect(() => {
    if (filteringProps?.isDisabled) {
      setIsSearchOpen(false);
    }
  }, [filteringProps?.isDisabled]);

  return (
    <div className={classnames("tree-widget-tree-header", className)}>
      <HeaderButtons contracted={isSearchOpen} size={size}>
        {children}
      </HeaderButtons>
    </div>
  );
}

interface HeaderButtonsProps {
  contracted: boolean;
  size: "large" | "small";
}

function HeaderButtons(props: PropsWithChildren<HeaderButtonsProps>) {
  return <>{props.children}</>;
}
