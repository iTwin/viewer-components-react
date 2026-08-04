// see https://github.com/changesets/changesets/blob/main/docs/modifying-changelog-format.md
/** @type {import('@changesets/types').ChangelogFunctions} */
const changelogFunctions = {
  getReleaseLine: async ({ commit, summary }, _type, options) => {
    if (!options.repo) {
      throw new Error('Configure the changelog generator with a GitHub repository, for example: ["./changelog-github.mjs", { "repo": "org/repo" }]');
    }

    const [firstLine, ...followingLines] = summary.split("\n").map((line) => line.trimEnd());
    const pullRequestOrCommit = await getPullRequestLink(options.repo, commit);
    let releaseLine = `- ${pullRequestOrCommit}: ${firstLine}`;

    if (followingLines.length > 0) {
      releaseLine += `\n${followingLines.map((line) => `  ${line}`).join("\n")}`;
    }

    return releaseLine;
  },

  getDependencyReleaseLine: async (_changesets, dependenciesUpdated) => {
    if (dependenciesUpdated.length === 0) {
      return "";
    }

    const updatedDependencies = dependenciesUpdated.map((dependency) => `  - ${dependency.name}@${dependency.newVersion}`);
    return ["- Updated dependencies:", ...updatedDependencies].join("\n");
  },
};

export default changelogFunctions;

async function getPullRequestLink(repository, commit) {
  try {
    const headers = {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };

    const response = await fetch(`https://api.github.com/repos/${repository}/commits/${commit}/pulls`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status} while resolving commit ${commit}.`);
    }

    const pullRequests = await response.json();
    if (!Array.isArray(pullRequests)) {
      throw new Error("GitHub returned an unexpected pull request response.");
    }

    const pullRequest = pullRequests.find(({ merge_commit_sha: mergeCommit }) => mergeCommit?.startsWith(commit));

    if (pullRequest) {
      return `[#${pullRequest.number}](https://github.com/${repository}/pull/${pullRequest.number})`;
    }
  } catch {
    // Fall back to the commit when GitHub cannot resolve the pull request.
  }

  return commit;
}
