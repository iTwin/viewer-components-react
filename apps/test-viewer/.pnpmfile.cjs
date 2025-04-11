//@ts-check

module.exports = {
  hooks: {
    readPackage(pkg, _context) {
      if (pkg.name === "@itwin/tree-widget-react") {
        pkg.dependencies["@itwin/itwinui-react"] = pkg.peerDependencies["@itwin/itwinui-react"];
        delete pkg.peerDependencies["@itwin/itwinui-react"];
      }
      if (pkg.name === "@itwin/presentation-hierarchies-react") {
        pkg.dependencies["@itwin/itwinui-react"] = pkg.peerDependencies["@itwin/itwinui-react"];
        delete pkg.peerDependencies["@itwin/itwinui-react"];
      }
      return pkg;
    },
  },
};
