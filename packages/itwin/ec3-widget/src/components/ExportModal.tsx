/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "./ExportModal.scss";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, ProgressLinear, ProgressRadial, Text } from "@itwin/itwinui-react";
import type { EC3Job, EC3JobCreate } from "@itwin/insights-client";
import { CarbonUploadState } from "@itwin/insights-client";
import { useApiContext } from "./api/APIContext";

interface JobSuccess {
  status: CarbonUploadState.Succeeded;
  link: string;
}

interface JobFailed {
  status: CarbonUploadState.Failed;
  message: string;
}

interface JobQueued {
  status: CarbonUploadState.Queued;
}

interface JobRunning {
  status: CarbonUploadState.Running;
}

type JobStatus = JobSuccess | JobFailed | JobQueued | JobRunning;

interface ExportProps {
  projectName: string;
  isOpen: boolean;
  close: () => void;
  templateId: string | undefined;
  token: string | undefined;
}

export const ExportModal = (props: ExportProps) => {
  const PIN_INTERVAL = 5000;
  const ec3JobsClient = useApiContext().ec3JobsClient;
  const getAccessToken = useApiContext().config.getAccessToken;

  const [jobStatus, setJobStatus] = useState<JobStatus>({ status: CarbonUploadState.Queued });

  const intervalRef = useRef<number>();

  const pinStatus = useCallback(
    (job: EC3Job) => {
      const intervalId = window.setInterval(async () => {
        const token = await getAccessToken();
        if (!(job.id && token)) return;
        const currentJobStatus = await ec3JobsClient.getEC3JobStatus(token, job.id);
        if (currentJobStatus.status === CarbonUploadState.Succeeded)
          setJobStatus({ status: CarbonUploadState.Succeeded, link: currentJobStatus._links.ec3Project.href });
        else if (currentJobStatus.status === CarbonUploadState.Failed) setJobStatus({ status: CarbonUploadState.Failed, message: currentJobStatus.message! });
        else setJobStatus({ status: currentJobStatus.status });
      }, PIN_INTERVAL);
      intervalRef.current = intervalId;
    },
    [setJobStatus, ec3JobsClient, getAccessToken],
  );

  const runJob = useCallback(
    async (token: string) => {
      const accessToken = await getAccessToken();
      if (props.templateId && token) {
        try {
          const jobRequest: EC3JobCreate = {
            configurationId: props.templateId,
            projectName: props.projectName,
            ec3BearerToken: token,
          };
          const jobCreated = await ec3JobsClient.createJob(accessToken, jobRequest);
          if (jobCreated.id) {
            pinStatus(jobCreated);
          } else {
            setJobStatus({ status: CarbonUploadState.Failed, message: "Failed to create Job" });
          }
        } catch (e) {
          setJobStatus({ status: CarbonUploadState.Failed, message: "Missing required permissions. Please contact the project administrator." });
          /* eslint-disable no-console */
          console.error(e);
        }
      } else {
        setJobStatus({ status: CarbonUploadState.Failed, message: "Invalid reportId" });
      }
    },
    [props, pinStatus, ec3JobsClient, getAccessToken],
  );

  const onClose = useCallback(() => {
    window.clearInterval(intervalRef.current);
    props.close();
  }, [props]);

  const getStatusComponent = useCallback((state: JobStatus) => {
    switch (state.status) {
      case CarbonUploadState.Queued:
        return (
          <div className="ec3w-progress-radial-container">
            <ProgressRadial indeterminate size="small" value={50} />
            <Text variant="leading" className="ec3w-status-text">
              Export queued
            </Text>
          </div>
        );
      case CarbonUploadState.Running:
        return (
          <div className="ec3w-progress-linear-container">
            <ProgressLinear indeterminate />
            <Text variant="leading" className="ec3w-status-text">
              Export running
            </Text>
          </div>
        );
      case CarbonUploadState.Succeeded:
        return (
          <div className="ec3w-progress-radial-container">
            <ProgressRadial status="positive" size="small" value={50} />
            <a className="ec3w-report-button" href={state.link} target="_blank" rel="noopener noreferrer">
              <Button styleType="cta">Open in EC3</Button>
            </a>
          </div>
        );
      case CarbonUploadState.Failed:
        return (
          <div className="ec3w-progress-radial-container">
            <ProgressRadial status="negative" size="small" value={100} />
            <Text variant="leading" className="ec3w-status-text">
              Export failed <br />
              {state.message}
            </Text>
          </div>
        );
      default:
        return (
          <div className="ec3w-progress-radial-container">
            <Text>Invalid Job Status</Text>
          </div>
        );
    }
  }, []);

  useEffect(() => {
    return () => {
      window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (props.isOpen && props.token) {
      setJobStatus({ status: CarbonUploadState.Queued });
      runJob(props.token).catch((err) => {
        setJobStatus({ status: CarbonUploadState.Failed, message: "Error while running job" });
        /* eslint-disable no-console */
        console.error(err);
      });
    }
  }, [props.isOpen, props.token, runJob]);

  useEffect(() => {
    if (jobStatus.status === CarbonUploadState.Succeeded || jobStatus.status === CarbonUploadState.Failed) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
  }, [jobStatus]);

  return (
    <Modal data-testid="ec3-export-modal" isOpen={props.isOpen} onClose={onClose} title={null} closeOnExternalClick={false}>
      {!jobStatus && (
        <div className="ec3w-progress-radial-container">
          <ProgressRadial indeterminate size="large" value={50} />
        </div>
      )}
      {jobStatus && getStatusComponent(jobStatus)}
    </Modal>
  );
};
