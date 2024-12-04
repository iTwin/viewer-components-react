/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const { spawn } = require("child_process");
const packageName = process.argv[2];
const dockerImageName = `viewer-components-react/${packageName}-e2e-tests`;
const dockerContainerName = `${dockerImageName.replace("/", ".")}-container`;

const execute = (command, args = []) =>
  new Promise((resolve, reject) => {
    const spawnProcess = spawn(command, args, { stdio: "inherit" });
    spawnProcess.on("close", (status) => {
      if (status !== 0) {
        console.error(`Command failed with code ${status}`);
        return reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
      }
      resolve();
    });
  });

try {
  const currentDirectory = process.cwd();
  const rootDirectory = path.resolve(currentDirectory, "../../../");
  process.chdir(rootDirectory);
} catch (err) {
  console.error(`Failed to change directory: ${err}`);
  return;
}

async function buildAndRunDocker() {
  // A list of build args that we want to pass when building the Docker image
  const buildArgValues = {
    PACKAGE_NAME: packageName,
    TEST_VIEWER_DIST: process.env.TEST_VIEWER_DIST
      ? path.relative(process.cwd(), process.env.TEST_VIEWER_DIST).replaceAll(path.sep, path.posix.sep)
      : "/apps/test-viewer/dist",
  };
  const buildArgs = Object.entries(buildArgValues).reduce((args, [name, value]) => [...args, "--build-arg", `${name}=${value}`], []);
  // Build the e2e tests Docker image
  await execute("docker", ["build", "-t", dockerImageName, "-f", "e2e.Dockerfile", "--progress=plain", ...buildArgs, "."]);

  try {
    // A list of environment variables that we want to cary over from the host to the container
    const envVariableNames = ["CI", "IMJS_AUTH_CLIENT_CLIENT_ID", "IMJS_USER_EMAIL", "IMJS_USER_PASSWORD"];
    const envVariableArgs = envVariableNames.reduce((args, name) => [...args, "--env", name], []);
    // Run Docker container
    await execute("docker", ["run", "--name", dockerContainerName, ...envVariableArgs, dockerImageName]);
  } catch {
    process.exitCode = 1;
  } finally {
    const relativePackageDir = `packages/itwin/${packageName}`;
    const containerPackageDir = `${dockerContainerName}:/workspaces/viewer-components-react/${relativePackageDir}`;
    const hostPackageDir = `./${relativePackageDir}`;
    // Copy snapshots from docker container to the local repo
    await execute("docker", ["cp", `${containerPackageDir}/src/e2e-tests`, `${hostPackageDir}/src`]);
    // Also copy the `e2e-out` folder for reports, traces, etc.
    await execute("docker", ["cp", `${containerPackageDir}/e2e-out`, `${hostPackageDir}`]);
    // Remove the Docker container
    await execute("docker", ["rm", "-f", `${dockerContainerName}`]);
  }
}

buildAndRunDocker();
