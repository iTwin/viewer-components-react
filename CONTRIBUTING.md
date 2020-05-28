# Contributing

This project accepts contributions from other teams at Bentley.

## Table of Contents

- [Adding a New Project](#adding-a-new-project)
- [Creating Issues and Enhancements](#creating-issues-and-enhancements)
  - [Writing Good Bug Reports and Feature Requests](#writing-good-bug-reports-and-feature-requests)
- [Pull Requests](#pull-requests)

## Adding a New Project

A Project is defined as a self-contained piece of functionality. Each new project is in a sub-folder of the ui-snippets folder in this repository. The name of the folder should share a similar name of the package that will be published and should contain the source code for that project.

Because each Project is self-contained, it is necessary for the contributor of the Project to specify a contact for PRs and bug reports. To do this, add an entry to the CODEOWNERS file in the root directory of the repository, e.g.:

    # Clara Developer owns the new extension snippet
    /imodel-select-react/clara.developer@bentley.com

Remember that the last entry for a matching directory or file name pattern takes precedence over any earlier entries.

### Naming conventions

- All names should be hyphenated lower case (e.g., imodel-select-react).

## Creating Issues and Enhancements

Have you identified a reproducible problem in this code? Have a feature requests? Please enter a Bug or Product Backlog Item, but first make sure that you search the work items to make sure that it has not been entered yet. If you find your issue already exists, make relevant comments. It is best to contact the developer listed for the Snippet in CODEOWNERS to discuss the bug or enhancement before filing.

All work in this repository and every pull request must have a linked work item.

### Writing Good Bug Reports and Feature Requests

File a single issue per problem and feature request. Do not enumerate multiple bugs or feature requests in the same issue.

Do not add your issue as a comment to an existing issue unless it's for the identical input. Many issues look similar, but have different causes.

The more information you can provide, the more likely someone will be successful at reproducing the issue and finding a fix.

Please include the following with each issue:

- Version of the code
- Your operating system
- Reproducible steps (1... 2... 3...) that cause the issue
- What you expected to see, versus what you actually saw
- Images, animations, or a link to a video showing the issue occurring
- A code snippet that demonstrates the issue or a link to a code repository the developers can easily pull down to recreate the issue locally

## Pull Requests

We follow a [feature branch and pull request workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow) to ensure that all code changes in this repository are code reviewed and all tests pass. This means that there will be a number of reviewers that formally review and sign off for changes. Reviewers should check for redundancy, optimization, stylization, and standardization in each changeset. While we will try to keep this repository as collaborative and open-source as possible, it must also be reliable.

Every change must be tested with proper unit tests. Integration tests are highly encouraged in libraries with critical workflows to ensure end-to-end consistency.

Every change must be described with a change log: Run "rush change" on your committed and always choose "patch" as the change type. Commit your change log along with your pull request.
