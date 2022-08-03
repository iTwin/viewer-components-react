/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBox } from "@itwin/core-react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import DeleteModal from "./DeleteModal";
import { Button, Table, DropdownMenu, MenuItem, IconButton } from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import type { CellProps } from "react-table";
import { WidgetHeader } from "./utils";
import "./Reports.scss";
import SelectorClient from "./selectorClient";
import { Selector } from "./Selector"
import TemplateMenu from "./TemplateMenu";


type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type TemplateType = CreateTypeFromInterface<Selector>;

enum TemplateView {
  TEMPLATES = "templates",
  CREATE = "create",
  MENU = "menu",
}

const Templates = () => {

  const selectorClient = new SelectorClient;
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Selector[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [filteredTemplates, setFilteredTemplates] = useState<Selector[]>(templates);
  const [selectedTemplate, setSelectedTemplate] = useState<Selector>();
  const [templateView, setTemplateView] = useState<TemplateView>(
    TemplateView.TEMPLATES
  );

  const refresh = useCallback(async () => {
    setTemplateView(TemplateView.TEMPLATES);
    load();
  }, []);

  function load() {
    setIsLoading(true);
    const selectors = selectorClient.getSelectorsT();
    setTemplates(selectors);
    setFilteredTemplates(selectors);
    setIsLoading(false);
  }

  const templatesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "templateName",
            Header: "Template Name",
            accessor: "templateName",
            Cell: (value: CellProps<Selector>) => (
              <div
                className="iui-anchor"
                onClick={() => {
                  setSelectedTemplate(value.row.original);
                  setTemplateView(TemplateView.MENU);
                }}
              >
                {value.row.original.templateName}
              </div>
            ),
          },
          {
            id: "templateDescription",
            Header: "Template Description",
            accessor: "templateDescription",
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<Selector>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [

                    <MenuItem
                      key={2}
                      onClick={() => {
                        setSelectedTemplate(value.row.original);
                        setShowDeleteModal(true);
                        close();
                      }}
                      icon={<SvgDelete />}
                    >
                      Remove
                    </MenuItem>,
                  ]}
                >
                  <IconButton styleType="borderless">
                    <SvgMore
                      style={{
                        width: "16px",
                        height: "16px",
                      }}
                    />
                  </IconButton>
                </DropdownMenu>
              );
            },
          },
        ],
      },
    ],
    []
  );

  const onSearchBoxValueChanged = async (value: string) => {
    const filterTemplates = templates.filter(
      (x) =>
        x.templateName &&
        x.templateName.toLowerCase()?.indexOf(value.toLowerCase()) > -1
    );
    setFilteredTemplates(filterTemplates);
  };

  const tableStateSingleSelectReducer = (newState: any, action: any): any => {
    switch (action.type) {
      case "toggleRowSelected": {
        return { ...newState, selectedRowIds: { [action.id]: action.value } };
      }
      default:
        break;
    }
    return newState;
  };

  useEffect(() => {
    load();
  }, [projectId]);

  switch (templateView) {

    case TemplateView.CREATE:
      return (
        <TemplateMenu
          goBack={async () => {
            setTemplateView(TemplateView.TEMPLATES);
            await refresh();
          }}
        />
      );
    case TemplateView.MENU:
      return (
        <TemplateMenu
          selector={selectedTemplate!}
          //templateId={selectedTemplate!.id!}
          goBack={async () => {
            setTemplateView(TemplateView.TEMPLATES);
            await refresh();
          }}
        />
      );
    default:
      return (
        <>
          <WidgetHeader title="Templates" />

          <div className="toolbar">
            <Button
              styleType="high-visibility"
              onClick={() => {
                setTemplateView(TemplateView.CREATE);
              }}
            >
              {"Create Template"}
            </Button>
          </div>
          <div className="e_c_3-reports-container">
            <div className="e_c_3-searchbox-container">
              <SearchBox
                onValueChanged={onSearchBoxValueChanged}
                placeholder={"Search templates"}
              />
            </div>
            <div className="e_c_3-scrollable-table">
              <Table<TemplateType>
                className="e_c_3-reports-table"
                data={filteredTemplates}
                density="extra-condensed"
                columns={templatesColumns}
                emptyTableContent="No items available."
                isSortable
                stateReducer={tableStateSingleSelectReducer}
                isLoading={isLoading}
                selectRowOnClick={true}
                selectSubRows={false}
              />
            </div>
          </div>
          <DeleteModal
            entityName={selectedTemplate?.templateName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={() => {
              if (selectedTemplate && selectedTemplate.id) {
                selectorClient.deleteSelectorDep(
                  selectedTemplate.id
                );
              }
            }}
            refresh={refresh}
          />
        </>
      );
  };

}

export default Templates;
