/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import DeleteModal from "./DeleteModal";
import { Button, Label, Table, toaster, DropdownMenu, MenuItem, IconButton } from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgConfiguration,
  SvgImport,
  SvgMore,
  SvgProcess,
} from "@itwin/itwinui-icons-react";
import type { Report } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { CellProps } from "react-table";
import { WidgetHeader } from "./utils";
import ExportModal from "./ExportModal";
import { clearAll } from "./viewerUtils";
import DataSelector from "./DataSelector";
import "./Reports.scss";
import DumbClient from "../dumb-client";
import SelectorClient from "./selectorClient";
import { Selector } from "./Selector"
//import TemplateAction from "./TemplateAction";
import TemplateMenu from "./TemplateMenu";


type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type TemplateType = CreateTypeFromInterface<Selector>;

enum TemplateView {
  TEMPLATES = "templates",
  CREATE = "create",
  //VIEW = "view",
  //EDIT = "edit",
  //CONFIGURE = "configure",
  MENU = "menu",
}

const Templates = () => {

  const selectorClient = new SelectorClient;
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  //const reportingClientApi = useMemo(() => new ReportingClient(), []);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Selector[]>([]);
  const [buttonIsDisabled, disableButton] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [filteredTemplates, setFilteredTemplates] = useState<Selector[]>(templates);
  const [selectedTemplate, setSelectedTemplate] = useState<Selector>();
  const [templateView, setTemplateView] = useState<TemplateView>(
    TemplateView.TEMPLATES
  );

  const [modalIsOpen, openModal] = useState(false);

  const refresh = useCallback(async () => {
    //clearAll();
    setTemplateView(TemplateView.TEMPLATES);
    //setSelectedTemplate(undefined);
    //setTemplates([]);
    load();

  }, []);

  function load() {
    setIsLoading(true);



    const selectors = selectorClient.getSelectorsT();
    setTemplates(selectors);
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
                        //refresh();
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
    disableButton(true);
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


  const createTemplate = (() => {
    setTemplateView(TemplateView.CREATE);
    refresh();
  })

  useEffect(() => {
    load();

    /*
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
      */


    /*
  IModelApp.authorizationClient
    .getAccessToken()
    .then((token: string) => {
      reportingClientApi
        .getReports(token, projectId)
        .then((data) => {
          if (data) {
            const fetchedReports = data ?? [];
            setReports(fetchedReports);
            setFilteredReports(fetchedReports);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          setIsLoading(false);
          toaster.negative("You are not authorized to get reports for this projects. Please contact project administrator.");

          console.error(err);
        });
    })
    .catch((err) => {
      toaster.negative("You are not authorized to use this system.");

      //console.error(err);
    });
    */
  }, [projectId]);



  switch (templateView) {



    case TemplateView.CREATE:
      return (
        <TemplateMenu
          selector={undefined}
          goBack={async () => {
            setTemplateView(TemplateView.TEMPLATES);
            await refresh();
          }}
        />
      );
    /*
        case TemplateView.EDIT:
          return (
            <TemplateAction
              selector={selectedTemplate}
              returnFn={async () => {
                setTemplateView(TemplateView.TEMPLATES);
                await refresh();
              }}
            />
          );
          */

    /*
  case TemplateView.CONFIGURE:
    return (
      <GroupSelector
        selector={selectedTemplate!}
        //templateId={selectedTemplate!.id!}
        goBack={async () => {
          setTemplateView(TemplateView.TEMPLATES);
          await refresh();
        }}
      />
    );
    */

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

    /*
  case TemplateView.VIEW:
    return (
      <TemplateViewer
        template={selectedTemplate}
        goBack={async () => {
          setTemplateView(TemplateView.TEMPLATES);
          await refresh();
        }}
      />
    );
    */

    default:
      return (
        <>
          <WidgetHeader title="Templates" />

          <div className="toolbar">
            <Button
              styleType="high-visibility"
              onClick={() => {
                setTemplateView(TemplateView.CREATE);
                //refresh();
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
                data={templates}
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
