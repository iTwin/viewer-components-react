# Change Log - @bentley/imodel-content-tree-react

This log was last generated on Thu, 13 May 2021 16:38:52 GMT and should not be manually modified.

## 0.3.0
Thu, 13 May 2021 16:38:52 GMT

### Minor changes

- update to imjs 2.15.2 to resolve breaking change to usePresentationTreeNodeLoader

## 0.2.0
Fri, 26 Feb 2021 18:43:33 GMT

### Minor changes

- Directly under non-geometric models node show only elements that have no parent
- Group elements under non-geometric models by class
- For every element node under non-geometric model load its child elements as child nodes

## 0.1.0
Fri, 19 Feb 2021 15:47:25 GMT

### Minor changes

- Update imodeljs dependencies to ^2.7

### Patches

- Load member elements for GroupInformationElement nodes

## 0.0.4
Fri, 16 Oct 2020 19:19:15 GMT

### Patches

- Handle GraphicalPartition3d similar to PhysicalPartition - it should not be displayed if there's a 'GraphicalPartition3d.Model.Content' attribute in JsonProperties

## 0.0.3
Wed, 07 Oct 2020 18:30:54 GMT

### Patches

- Fix 'main' and 'typings' fields by removing the '-react' to match the name of the barrel file instead of package name.

## 0.0.2
Wed, 26 Aug 2020 12:14:46 GMT

### Patches

- Initial commit

