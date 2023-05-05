/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./TreeHeader.scss";
import classnames from "classnames";
import * as React from "react";
import { Viewport } from "@itwin/core-frontend";
import { SvgMore } from "@itwin/itwinui-icons-react";
import { ButtonGroup, DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import { SearchBox, SearchBoxProps } from "./SearchBox";

/** @internal */
export interface TreeHeaderButtonProps {
  viewport: Viewport;
}

/** @internal */
export interface TreeHeaderProps extends Omit<SearchBoxProps,
| "onIconClick"
| "valueChangedDelay"
| "searchOpen"
| "onSearchOpen"
| "onSearchClose"
> {
  /** Header buttons */
  children: React.ReactNode[];
}

/** @internal */
export function TreeHeader(props: TreeHeaderProps) {
  const { children, ...restProps } = props;
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <div className={classnames("tree-widget-search-bar", props.className)}>
      <HeaderButtons contracted={searchOpen}>{children}</HeaderButtons>
      <div className="search-bar-search-container">
        <SearchBox
          {...restProps}
          valueChangedDelay={500}
          searchOpen={searchOpen}
          onSearchOpen={() => setSearchOpen(true)}
          onSearchClose={() => setSearchOpen(false)}
        />
      </div>
    </div>
  );
}

interface HeaderButtonsProps {
  contracted: boolean;
  children: React.ReactNode[];
}

function HeaderButtons(props: HeaderButtonsProps) {
  const className = classnames(
    "search-bar-button-container",
    props.contracted && "contracted",
  );

  return (
    <ButtonGroup
      className={className}
      overflowButton={(overflowStart) => (
        <DropdownMenu
          menuItems={() =>
            React.Children.toArray(props.children)
              .slice(overflowStart === 0 ? 0 : overflowStart - 1)
              .map((btn, index) => <MenuItem key={index} className="search-bar-dropdown-menu-item">{btn}</MenuItem>)
          }
          className="search-bar-dropdown-container"
        >
          <IconButton styleType="borderless" size="small">
            <SvgMore />
          </IconButton>
        </DropdownMenu>
      )}
    >
      {props.children}
    </ButtonGroup>
  );
}
