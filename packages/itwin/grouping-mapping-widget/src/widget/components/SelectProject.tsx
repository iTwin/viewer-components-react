/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  ApiOverrides,
  ProjectFull,
} from "@itwin/imodel-browser-react";
import {
  ProjectGrid,
} from "@itwin/imodel-browser-react";
import {
  SvgCalendar,
  SvgList,
  SvgSearch,
  SvgStarHollow,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  HorizontalTabs,
  IconButton,
  LabeledInput,
  Tab,
} from "@itwin/itwinui-react";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { ApiContext } from "./GroupingMapping";
import "./SelectProject.scss";

const tabsWithIcons = [
  <Tab
    key='favorite'
    label='Favorite projects'
    startIcon={<SvgStarHollow />}
  />,
  <Tab key='recents' label='Recent projects' startIcon={<SvgCalendar />} />,
  <Tab key='all' label='My projects' startIcon={<SvgList />} />,
];
interface SelectProjectProps {
  onSelect: (project: ProjectFull) => void;
  onCancel: () => void;
}
const SelectProject = ({ onSelect, onCancel }: SelectProjectProps) => {
  const apiContext = useContext(ApiContext);
  const [projectType, setProjectType] = useState<number>(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");

  const startSearch = useCallback(() => {
    setActiveSearchInput(searchInput);
  }, [searchInput]);

  const apiOverrides = useMemo<ApiOverrides<ProjectFull[]>>(
    () => ({ serverEnvironmentPrefix: apiContext.prefix }),
    [apiContext.prefix],
  );

  return (
    <div className='select-project-grid-container'>
      <HorizontalTabs
        labels={tabsWithIcons}
        onTabSelected={setProjectType}
        activeIndex={projectType}
        type={"borderless"}
        contentClassName='grid-holding-tab'
      >
        <LabeledInput
          displayStyle='inline'
          iconDisplayStyle='inline'
          className='search-input'
          label='Search'
          value={searchInput}
          onChange={(event) => {
            const {
              target: { value },
            } = event;
            setSearchInput(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              startSearch();
            }
            if (event.key === "Escape") {
              setSearchInput("");
              setActiveSearchInput("");
            }
          }}
          svgIcon={
            <IconButton onClick={() => startSearch()} styleType='borderless'>
              <SvgSearch />
            </IconButton>
          }
        />
        <div className='project-grid'>
          <ProjectGrid
            onThumbnailClick={onSelect}
            accessToken={apiContext.accessToken}
            apiOverrides={apiOverrides}
            filterOptions={activeSearchInput}
            requestType={
              projectType === 0
                ? "favorites"
                : projectType === 1
                  ? "recents"
                  : ""
            }
          />
        </div>
        <div className='select-project-action-panel'>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </HorizontalTabs>
    </div>
  );
};

export default SelectProject;
