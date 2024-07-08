#----------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.45.1-jammy

# Set the working directory in the container
WORKDIR /workspaces/viewer-components-react/

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@9.1.2 --activate

# Copy the local files to the container (see `test-viewer.Dockerfile.dockerignore` for skipped files)
COPY . .

# Install dependencies
RUN pnpm install

# This is a workaround for https://github.com/microsoft/lage/issues/689.
# We don't want to copy the `.git` directory into container (skipped using `.dockerignore`) to avoid changing
# workspace hash on pull/stage/stash/etc., but that makes this a non-git repository and lage seems to require
# this to be a git repository. As a workaround, make this a git repository...
RUN git config --global user.name "iTwin.js admin"
RUN git config --global user.email "itwinjs-admin@bentley.com"
RUN git init
RUN git commit -m"Initial" --allow-empty

# Build test-viewer and its dependencies
RUN pnpm lage build --to test-viewer --no-cache
