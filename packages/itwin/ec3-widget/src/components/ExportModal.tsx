/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ExportModal.scss";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Button,
  LabeledInput,
  Modal,
  ProgressLinear,
  ProgressRadial,
  Text
} from "@itwin/itwinui-react";
import {
  SvgVisibilityHide,
  SvgVisibilityShow,
} from "@itwin/itwinui-icons-react";
import type { Link } from "@itwin/insights-client";
import { JobStatus } from "@itwin/insights-client";
import EC3Client from "./EC3/EC3Client";
import logo from '../../public/logo/EC3Logo.png';

interface ExportProps {
  isOpen: boolean;
  close: () => void;
  templateId: string | undefined;
}

interface E_c_3TokenCache {
  token: string;
  exp: number;
}

const ExportModal = (props: ExportProps) => {
  const EC3ClientApi = useMemo(() => new EC3Client(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordIsVisible, showPassword] = useState(false);
  const [signinError, showSigninError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [cache, cacheToken] = useState<E_c_3TokenCache>();

  const [jobStatus, setJobStatus] = useState<JobStatus.StatusEnum>();
  const [jobLink, setJobLink] = useState<Link>();

  const isValidEmail = useCallback(() => {
    return /\S+@\S+\.\S+/.test(email);
  }, [email]);

  const isValidPassword = useCallback(() => {
    return password !== "";
  }, [password]);

  const validateSignin = useCallback(() => {
    return cache?.token && cache?.exp > Date.now();
  }, [cache]);

  const [isSignedIn, setIsSignedIn] = useState(validateSignin());
  const [isSigningIn, startSigningIn] = useState(false);
  const intervalRef = useRef<number>();

  const isValidSignin = useCallback(() => {
    return isValidEmail() && isValidPassword();
  }, [isValidEmail, isValidPassword]);

  const resetSignin = useCallback(() => {
    setEmail("");
    setPassword("");
    showPassword(false);
    showSigninError(false);
  }, [setEmail, setPassword, showPassword, showSigninError]);

  const signin = useCallback(
    async (e: any) => {
      e.preventDefault();
      const result = await EC3ClientApi.getEC3AccessToken(email, password);
      console.log(result);
    },
    [
      email,
      password,
      resetSignin,
      cacheToken,
      showSigninError,
      EC3ClientApi,
    ]
  );

  const onClose = useCallback(() => {
    resetSignin();
    setJobStatus(undefined);
    setJobLink(undefined);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    props.close();
  }, [props, resetSignin]);

  const getStatusComponent = useCallback(
    (status: JobStatus.StatusEnum, link: string | undefined) => {
      switch (status) {
        case JobStatus.StatusEnum.Queued:
          return (
            <div className="e_c_3-progress-radial-container">
              <ProgressRadial indeterminate size="small" value={50} />
              <Text variant="leading" className="e_c_3-status-text">
                Export queued
              </Text>
            </div>
          );
        case JobStatus.StatusEnum.Running:
          return (
            <div className="e_c_3-progress-linear-container">
              <ProgressLinear indeterminate />
              <Text variant="leading" className="e_c_3-status-text">
                Export running
              </Text>
            </div>
          );
        case JobStatus.StatusEnum.Succeeded:
          return (
            link && (
              <div className="e_c_3-progress-radial-container">
                <ProgressRadial status="positive" size="small" value={50} />
                <a
                  className="e_c_3-report-button"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button styleType="cta">Open in E C 3</Button>
                </a>
              </div>
            )
          );
        case JobStatus.StatusEnum.Failed:
          return (
            <div className="e_c_3-progress-radial-container">
              <ProgressRadial status="negative" size="small" value={100} />
              <Text variant="leading" className="e_c_3-status-text">
                Export failed
              </Text>
            </div>
          );
        default:
          return (
            <div className="e_c_3-progress-radial-container">
              <Text>Invalid Job Status <span role="img" aria-label="sad">😔</span></Text>
            </div>
          );
      }
    },
    []
  );

  useEffect(() => {
    if (email !== "") {
      const timeoutId = setTimeout(() => setEmailError(!isValidEmail()), 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setEmailError(false);
      return;
    }
  }, [email, isValidEmail]);

  return (
    <Modal
      data-testid="export-modal"
      isOpen={props.isOpen}
      onClose={onClose}
      title={null}
      closeOnExternalClick={false}
    >
      {!isSignedIn && (
        <div className="e_c_3-signin">
          <img
            className="e_c_3-signin-icon"
            src={logo}
            alt="E C 3® software"
            data-height-percentage="80"
            data-actual-width="1200"
            data-actual-height="600"
          />
          <form onSubmit={signin} className="e_c_3-signin-form">
            <div className="e_c_3-signin-prompt">Sign in to E C 3.</div>
            {signinError && (
              <Alert type="negative" className="e_c_3-signin-error">
                Incorrect email or password.
              </Alert>
            )}
            <div className="e_c_3-signin-input">
              <LabeledInput
                label="Email"
                value={email}
                onChange={(v) => setEmail(v.target.value)}
                type="email"
                status={emailError ? "negative" : undefined}
                message={emailError ? "Invalid email address." : ""}
                required
              />
            </div>
            <div className="e_c_3-signin-input">
              <LabeledInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={passwordIsVisible ? "text" : "password"}
                svgIcon={
                  passwordIsVisible ? (
                    <SvgVisibilityHide
                      onClick={() => showPassword(!passwordIsVisible)}
                    />
                  ) : (
                    <SvgVisibilityShow />
                  )
                }
                iconDisplayStyle="inline"
                required
              />
            </div>

            <div className="e_c_3-signin-button-container">
              <Button
                className="e_c_3-signin-button"
                type="submit"
                styleType="cta"
                disabled={!isValidSignin()}
              >
                {isSigningIn ? (
                  <ProgressRadial
                    className="e_c_3-signin-wait"
                    indeterminate
                    size="small"
                    value={50}
                  />
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
      {isSignedIn && !jobStatus && (
        <div className="e_c_3-progress-radial-container">
          <ProgressRadial indeterminate size="large" value={50} />
        </div>
      )}
      {isSignedIn && jobStatus && getStatusComponent(jobStatus, jobLink?.href)}
    </Modal>
  );
};

export default ExportModal;
