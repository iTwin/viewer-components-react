/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ApiOverrides,
  ProjectFull,
  ProjectGrid,
} from "@itwin/imodel-browser-react";
import {
  SvgCalendar,
  SvgList,
  SvgSearch,
  SvgStarHollow,
} from "@itwin/itwinui-icons-react";
import {
  HorizontalTabs,
  IconButton,
  LabeledInput,
  Tab,
} from "@itwin/itwinui-react";
import React, { useCallback, useMemo, useState } from "react";
import { getUrlPrefix } from "../../api/reportingClient";
import useFetchAccessToken from "../hooks/useFetchAccessToken";
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
}
const SelectProject = ({ onSelect }: SelectProjectProps) => {
  const accessToken = useFetchAccessToken();
  const [projectType, setProjectType] = useState<number>(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");

  const startSearch = useCallback(() => {
    setActiveSearchInput(searchInput);
  }, [searchInput]);

  const apiOverrides = useMemo<ApiOverrides<ProjectFull[]>>(
    () => ({ serverEnvironmentPrefix: getUrlPrefix() }),
    [],
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
            accessToken={accessToken}
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
      </HorizontalTabs>
    </div>
  );
};

export default SelectProject;
