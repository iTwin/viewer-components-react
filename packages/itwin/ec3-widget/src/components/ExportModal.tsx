/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ExportModal.scss";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IModelApp } from "@itwin/core-frontend";
import {
  Button,
  Modal,
  ProgressLinear,
  ProgressRadial,
  Text,
  toaster,
} from "@itwin/itwinui-react";
import type { JobCreation, Link } from "@itwin/insights-client";
import { JobStatus } from "@itwin/insights-client";
import { useEC3JobClient } from "./api/context/EC3JobClientContext";

interface ExportProps {
  projectName: string;
  isOpen: boolean;
  close: () => void;
  templateId: string | undefined;
  token: string | undefined;
}

const ExportModal = (props: ExportProps) => {
  const PIN_INTERVAL = 1000;
  const ec3JobClient = useEC3JobClient();

  const [jobStatus, setJobStatus] = useState<JobStatus.StatusEnum>();
  const [jobLink, setJobLink] = useState<Link>();

  const intervalRef = useRef<number>();

  const pinStatus = useCallback(
    (job: JobCreation) => {
      const intervalId = window.setInterval(async () => {
        const token =
          (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
        if (job.id && token) {
          const currentJobStatus =
            await ec3JobClient.getEC3JobStatus(token, job?.id);
          if (currentJobStatus.job?.status) {
            if (
              currentJobStatus.job?.status === JobStatus.StatusEnum.Succeeded
            ) {
              setJobLink(currentJobStatus?.job._links?.ec3Project);
            }
            setJobStatus(currentJobStatus.job?.status);
          } else {
            setJobStatus(JobStatus.StatusEnum.Failed);
            toaster.negative("Failed to get job status. 😔");
          }
        }
      }, PIN_INTERVAL);
      intervalRef.current = intervalId;
    },
    [setJobLink, setJobStatus, ec3JobClient]
  );

  const runJob = useCallback(
    async (token: string) => {
      const accessToken =
        (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
      if (props.templateId && token) {
        try {
          const jobCreated = await ec3JobClient.createJob(
            accessToken,
            token,
            props.templateId,
            props.projectName
          );
          if (jobCreated?.job?.id) {
            pinStatus(jobCreated?.job);
          } else {
            setJobStatus(JobStatus.StatusEnum.Failed);
            toaster.negative("Failed to create EC3 job. 😔");
          }
        } catch (e) {
          setJobStatus(JobStatus.StatusEnum.Failed);
          toaster.negative("You do not have the required permissions. Please contact the project administrator.");
          /* eslint-disable no-console */
          console.error(e);
        }
      } else {
        setJobStatus(JobStatus.StatusEnum.Failed);
        toaster.negative("Invalid reportId.");
      }
    },
    [props, pinStatus, ec3JobClient]
  );

  const onClose = useCallback(() => {
    setJobStatus(undefined);
    setJobLink(undefined);
    window.clearInterval(intervalRef.current);
    props.close();
  }, [props]);

  const getStatusComponent = useCallback(
    (status: JobStatus.StatusEnum, link: string | undefined) => {
      switch (status) {
        case JobStatus.StatusEnum.Queued:
          return (
            <div className="ec3w-progress-radial-container">
              <ProgressRadial indeterminate size="small" value={50} />
              <Text variant="leading" className="ec3w-status-text">
                Export queued
              </Text>
            </div>
          );
        case JobStatus.StatusEnum.Running:
          return (
            <div className="ec3w-progress-linear-container">
              <ProgressLinear indeterminate />
              <Text variant="leading" className="ec3w-status-text">
                Export running
              </Text>
            </div>
          );
        case JobStatus.StatusEnum.Succeeded:
          return (
            link && (
              <div className="ec3w-progress-radial-container">
                <ProgressRadial status="positive" size="small" value={50} />
                <a
                  className="ec3w-report-button"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button styleType="cta">Open in EC3</Button>
                </a>
              </div>
            )
          );
        case JobStatus.StatusEnum.Failed:
          return (
            <div className="ec3w-progress-radial-container">
              <ProgressRadial status="negative" size="small" value={100} />
              <Text variant="leading" className="ec3w-status-text">
                Export failed
              </Text>
            </div>
          );
        default:
          return (
            <div className="ec3w-progress-radial-container">
              <Text>Invalid Job Status <span role="img" aria-label="sad">😔</span></Text>
            </div>
          );
      }
    },
    []
  );

  useEffect(() => {
    if (props.isOpen && props.token) {
      runJob(props.token).catch((err) => {
        setJobStatus(JobStatus.StatusEnum.Failed);
        toaster.negative("Error occurs while running the job. 😔");
        /* eslint-disable no-console */
        console.error(err);
      });
    }
  }, [props.isOpen, props.token, runJob]);

  useEffect(() => {
    if (
      jobStatus === JobStatus.StatusEnum.Succeeded ||
      jobStatus === JobStatus.StatusEnum.Failed
    ) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
  }, [jobStatus]);

  return (
    <Modal
      data-testid="export-modal"
      isOpen={props.isOpen}
      onClose={onClose}
      title={null}
      closeOnExternalClick={false}
    >
      {!jobStatus && (
        <div className="ec3w-progress-radial-container">
          <ProgressRadial indeterminate size="large" value={50} />
        </div>
      )}
      {jobStatus && getStatusComponent(jobStatus, jobLink?.href)}
    </Modal>
  );
};

export default ExportModal;
