const lintStaged = require("lint-staged");

async function preCommit() {
  const success = await lintStaged({
    config: {
      "*.{ts,tsx}": ["node ./common/scripts/copyright-linter.js --"],
      "*.{scss,css}": ["node ./common/scripts/copyright-linter.js --"],
    },
    verbose: true,
  });

  if (!success) {
    process.exit(1);
  }
}

preCommit();
