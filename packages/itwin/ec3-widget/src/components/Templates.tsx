/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBox } from "@itwin/core-react";
import DeleteModal from "./DeleteModal";
import { Button, Table, DropdownMenu, MenuItem, IconButton } from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import type { CellProps } from "react-table";
import { WidgetHeader } from "./utils";
import "./Templates.scss";
import TemplateClient from "./templateClient";
import { Template } from "./Template"
import TemplateMenu from "./TemplateMenu";
import React from "react";


type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type TemplateType = CreateTypeFromInterface<Template>;

enum TemplateView {
  TEMPLATES = "templates",
  CREATE = "create",
  MENU = "menu",
}

const Templates = () => {

  const templateClient = useMemo(() => { return new TemplateClient() }, []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>(templates);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>();
  const [templateView, setTemplateView] = useState<TemplateView>(
    TemplateView.TEMPLATES
  );


  const load = useCallback(() => {
    setIsLoading(true);
    const templates = templateClient.getTemplatesT();
    setTemplates(templates);
    setFilteredTemplates(templates);
    setIsLoading(false);
  }, [templateClient])


  const refresh = useCallback(async () => {
    setTemplateView(TemplateView.TEMPLATES);
    load();
  }, [load]);



  const templatesColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "templateName",
            Header: "Template Name",
            accessor: "templateName",
            Cell: (value: CellProps<Template>) => (
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
            Cell: (value: CellProps<Template>) => {
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
  }, [load]);

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
          template={selectedTemplate!}
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
          <div className="e_c_3-template-container">
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
                templateClient.deleteTemplateDep(
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
