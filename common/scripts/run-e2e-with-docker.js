/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const { spawn } = require("child_process");
const packageName = process.argv[2];
const dockerImageName = `viewer-components-react/${packageName}-e2e-tests`;
const dockerContainerName = `${dockerImageName.replace("/", ".")}-container`;
const srcFolderLocation = `packages/itwin/${packageName}/src`;

const execute = (command, args = []) => new Promise((resolve, reject) => {
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
  // A list of environment variables that we want to cary over from the host to the container
  const envVariableNames = ["CI", "IMJS_AUTH_CLIENT_CLIENT_ID", "IMJS_USER_EMAIL", "IMJS_USER_PASSWORD"];
  const envVariableArgs = envVariableNames.reduce((args, name) => [...args, "--env", name], []);
  try {
    // Build the test-viewer Docker image
    await execute("docker", ["build", "-t", "viewer-components-react/test-viewer", "-f", "test-viewer.Dockerfile", "."]);
    // Build the e2e tests Docker image
    await execute("docker", ["build", "--build-arg", `PACKAGE_NAME=${packageName}`, "-t", dockerImageName, "-f", "e2e.Dockerfile", "."]);
    // Run Docker container
    await execute("docker", ["run", "--name", dockerContainerName, ...envVariableArgs, dockerImageName]);
    // Copy snapshots from docker container to the local repo
    await execute("docker", ["cp", `${dockerContainerName}:/workspaces/viewer-components-react/${srcFolderLocation}/e2e-tests`, `./${srcFolderLocation}`]);
  } catch {
    process.exitCode = 1;
  } finally {
    // Remove the Docker container
    await execute("docker", ["rm", "-f", `${dockerContainerName}`]);
  };
}

buildAndRunDocker();