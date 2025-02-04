//@ts-check

module.exports = {
  hooks: {
    readPackage(pkg, _context) {
      if (pkg.name === "@itwin/tree-widget-react") {
        ["@itwin/itwinui-icons", "@itwin/itwinui-react"].forEach((dep) => {
          pkg.dependencies[dep] = pkg.peerDependencies[dep];
          delete pkg.peerDependencies[dep];
        });
      }
      return pkg;
    },
  },
};
