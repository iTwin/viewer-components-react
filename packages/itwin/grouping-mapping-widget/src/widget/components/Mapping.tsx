/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from '@bentley/presentation-frontend';
import { useActiveIModelConnection } from '@bentley/ui-framework';
import {
  SvgDelete,
  SvgMore,
  SvgAdd,
  SvgEdit,
} from '@itwin/itwinui-icons-react';
import {
  DropdownMenu,
  MenuItem,
  IconButton,
  Table,
  Button,
} from '@itwin/itwinui-react';
import { CellProps } from 'react-table';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MappingReportingAPI } from '../../api/generated';
import { CreateTypeFromInterface } from '../utils';
import { onSelectionChanged, WidgetHeader } from './utils';
import './Mapping.scss';
import { reportingClientApi } from '../../api/reportingClient';
import DeleteModal from './DeleteModal';
import { Groupings } from './Grouping';
import MappingAction from './MappingAction';

type Mapping = CreateTypeFromInterface<MappingReportingAPI>;

enum MappingView {
  MAPPINGS = 'mappings',
  GROUPS = 'groups',
  ADDING = 'adding',
  MODIFYING = 'modifying',
}

const fetchMappings = async (
  setMappings: React.Dispatch<React.SetStateAction<MappingReportingAPI[]>>,
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  try {
    setIsLoading(true);
    const mappings = await reportingClientApi.getMappings(iModelId);
    setMappings(mappings.mappings ?? []);
  } catch {
  } finally {
    setIsLoading(false);
  }
};

const useFetchMappings = (
  iModelId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): [
  MappingReportingAPI[],
  React.Dispatch<React.SetStateAction<MappingReportingAPI[]>>,
] => {
  const [mappings, setMappings] = useState<MappingReportingAPI[]>([]);

  useEffect(() => {
    void fetchMappings(setMappings, iModelId, setIsLoading);
  }, [iModelId, setIsLoading]);

  return [mappings, setMappings];
};

export const Mappings = () => {
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [mappingView, setMappingView] = useState<MappingView>(
    MappingView.MAPPINGS,
  );
  const [selectedMapping, setSelectedMapping] = useState<
    MappingReportingAPI | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mappings, setMappings] = useFetchMappings(iModelId, setIsLoading);

  useEffect(() => {
    const removeListener =
      Presentation.selection.selectionChange.addListener(onSelectionChanged);
    return () => {
      removeListener();
    };
  }, []);

  const refresh = useCallback(async () => {
    setMappingView(MappingView.MAPPINGS);
    setSelectedMapping(undefined);
    setMappings([]);
    await fetchMappings(setMappings, iModelId, setIsLoading);
  }, [iModelId, setMappings]);

  const addMapping = async () => {
    setMappingView(MappingView.ADDING);
  };

  const mappingsColumns = useMemo(
    () => [
      {
        Header: 'Table',
        columns: [
          {
            id: 'mappingName',
            Header: 'Mapping',
            accessor: 'mappingName',
            Cell: (value: CellProps<{ mappingName: string }>) => (
              <div
                className='iui-anchor'
                onClick={() => {
                  setSelectedMapping(value.row.original);
                  setMappingView(MappingView.GROUPS);
                }}
              >
                {value.row.original.mappingName}
              </div>
            ),
          },
          {
            id: 'description',
            Header: 'Description',
            accessor: 'description',
          },
          {
            id: 'dropdown',
            Header: '',
            width: 80,
            Cell: (value: CellProps<Mapping>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={0}
                      onClick={() => {
                        setSelectedMapping(value.row.original);
                        setMappingView(MappingView.MODIFYING);
                      }}
                      icon={<SvgEdit />}
                    >
                      Modify
                    </MenuItem>,

                    <MenuItem
                      key={1}
                      onClick={() => {
                        setSelectedMapping(value.row.original);
                        setShowDeleteModal(true);
                        close();
                      }}
                      icon={<SvgDelete />}
                    >
                      Remove
                    </MenuItem>,
                  ]}
                >
                  <IconButton styleType='borderless'>
                    <SvgMore
                      style={{
                        width: '16px',
                        height: '16px',
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
    [],
  );

  switch (mappingView) {
    case MappingView.ADDING:
      return <MappingAction iModelId={iModelId} returnFn={refresh} />;
    case MappingView.MODIFYING:
      return (
        <MappingAction
          iModelId={iModelId}
          mapping={selectedMapping}
          returnFn={refresh}
        />
      );
    case MappingView.GROUPS:
      return (
        <Groupings
          mapping={selectedMapping as MappingReportingAPI}
          goBack={refresh}
        />
      );
    default:
      return (
        <>
          <WidgetHeader title='Mappings' />
          <div className='mappings-container'>
            <Button
              startIcon={<SvgAdd />}
              onClick={() => addMapping()}
              styleType='high-visibility'
            >
              Add Mapping
            </Button>
            <Table<Mapping>
              data={mappings}
              density='extra-condensed'
              columns={mappingsColumns}
              emptyTableContent='No Mappings available.'
              isSortable
              isLoading={isLoading}
            />
          </div>
          <DeleteModal
            entityName={selectedMapping?.mappingName ?? ''}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              await reportingClientApi.deleteMapping(
                iModelId,
                selectedMapping?.id ?? '',
              );
            }}
            refresh={refresh}
          />
        </>
      );
  }
};
