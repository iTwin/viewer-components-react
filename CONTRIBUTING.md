# Contributing

Thank you for your interest in contributing! There are several ways you can help.

Please take a read through this document to help streamline the process of getting your contributions added.

## Table of Contents

- [Adding a New Project](#adding-a-new-project)
- [Creating Issues and Enhancements](#creating-issues-and-enhancements)
  - [Writing Good Bug Reports and Feature Requests](#writing-good-bug-reports-and-feature-requests)
- [Pull Requests](#pull-requests)
- [Development Workflow](#development-workflow)
- [Changesets and Releases](#changesets-and-releases)

## Adding a New Project

A Project is defined as a self-contained piece of functionality. Each new project is in a sub-folder of the `./packages` folder in this repository. The name of the folder should share a similar name of the package that will be published and should contain the source code for that project.

Because each Project is self-contained, it is necessary for the contributor of the Project to specify a contact for PRs and bug reports. To do this, add an entry to the [CODEOWNERS](./.github/CODEOWNERS) file in the root directory of the repository, e.g.:

    # Clara Developer owns the new extension snippet
    /packages/imodel-select  @clara.developer

Remember that the last entry for a matching directory or file name pattern takes precedence over any earlier entries.

### Naming conventions

- All names should be hyphenated lower case (e.g., imodel-select).

## Creating Issues and Enhancements

Have you identified a reproducible problem in this code? Have a feature requests? Please create an Issue, but first make sure that you search the work items to make sure that it has not been entered yet. If you find your issue already exists, please add relevant comments or just a thumbs up to let us know that more people face this issue.

### Writing Good Bug Reports and Feature Requests

File a single issue per problem and feature request. Do not enumerate multiple bugs or feature requests in the same issue.

Do not add your issue as a comment to an existing issue unless it's for the identical input. Many issues look similar, but have different causes.

The more information you can provide, the more likely someone will be successful at reproducing the issue and finding a fix.

Please include the following with each issue:

- Version of the package
- Version of iTwin.js used
- Your operating system or browser
- Reproducible steps (1... 2... 3...) that cause the issue
- What you expected to see, versus what you actually saw
- Images, animations, or a link to a video showing the issue occurring
- A code snippet that demonstrates the issue or a link to a code repository the developers can easily pull down to recreate the issue locally

## Pull Requests

We follow the normal [GitHub pull request workflow](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request) to ensure that all code changes in this repository are code reviewed and all tests pass. This means that there will be a number of reviewers that formally review and sign off for changes. Reviewers should check for redundancy, optimization, stylization, and standardization in each changeset. While we will try to keep this repository as collaborative and open-source as possible, it must also be reliable.

Every change must be tested with proper unit tests. Integration tests are highly encouraged in libraries with critical workflows to ensure end-to-end consistency.

## Development Workflow

1. Clone the repository or pull the latest changes from `master`.
2. Install dependencies: `pnpm install`.
3. Create a branch and make your changes.
4. Add or update tests for the changed behavior.
5. Run the relevant validation commands. The root commands include:

- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm format`
- `pnpm cspell`

6. Commit and push your changes, then open a pull request.

The above commands iterate and perform their action against each package in the monorepo.

> Note: It is a good idea to `pnpm install` after each `git pull` as dependencies may have changed.

## Changesets and Releases

Every change that requires a public package release must include a changeset. Documentation, tests, tooling, and other changes that do not affect a published package do not need one. Empty changesets are not used.

Before opening a pull request:

1. Run `pnpm changeset`.
2. Select each affected package and its release type:

- `patch` for backward-compatible fixes.
- `minor` for backward-compatible features.
- `major` for breaking changes.

3. Enter a concise summary suitable for the package changelog.
4. Review the generated `.changeset/*.md` file. Single-package changesets use the package name in the filename for package-specific reviewer routing. Changesets affecting multiple packages use the `multi-package` prefix. The Markdown content may be expanded with examples, code snippets, migration guidance, or any other context needed for useful release notes.
5. Commit the generated file from the `.changeset` directory with your pull request.

Do not edit package versions or package CHANGELOG.md files manually. After changesets are merged to `master`, the release workflow creates or updates a release pull request containing the generated version and changelog changes. Merging that release pull request publishes the packages to npm.

Here is a sample [changelog](https://github.com/microsoft/rushstack/blob/master/apps/rush/CHANGELOG.md) to demonstrate the level of detail expected.
