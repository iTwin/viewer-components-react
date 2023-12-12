#----------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.36.2-jammy

# Set the working directory in the container
WORKDIR /workspaces/viewer-components-react/

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@8.11.0 --activate

# Copy the local files to the container and install/build
COPY . .
RUN pnpm install
RUN pnpm build --scope test-viewer
