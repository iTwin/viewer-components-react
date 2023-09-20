/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const { spawn } = require("child_process");
const packageName = process.argv[2];
const dockerImageName = `${packageName}-e2e-test-image`;
const dockerContainerName = `${packageName}-e2e-test-container`;
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
  try {
    // Build the Docker image
    await execute("docker", ["build", "--build-arg", `PACKAGE_NAME=${packageName}`, "-t", `${dockerImageName}`, "-f", "e2e.Dockerfile", "."]);
    // Run Docker container
    await execute("docker", ["run", "--name", `${dockerContainerName}`, "-e", `UPDATE_SNAPSHOTS=${process.env.UPDATE_SNAPSHOTS}`, `${dockerImageName}`]);

    if (process.env.UPDATE_SNAPSHOTS) {
      // Copy snapshots from docker container to the local repo
      await execute("docker", ["cp", `${dockerContainerName}:/workspaces/viewer-components-react/${srcFolderLocation}/e2e-tests`, `./${srcFolderLocation}`]);
    }
  } catch(_e) {
    process.exitCode = 1;
  } finally {
    // Remove the Docker container
      await execute("docker", ["rm", "-f", `${dockerContainerName}`]);
  };
}

buildAndRunDocker();