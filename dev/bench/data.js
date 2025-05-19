window.BENCHMARK_DATA = {
  "lastUpdate": 1747674531135,
  "repoUrl": "https://github.com/iTwin/viewer-components-react",
  "entries": {
    "Tree-Widget benchmark": [
      {
        "commit": {
          "author": {
            "name": "iTwin",
            "username": "iTwin"
          },
          "committer": {
            "name": "iTwin",
            "username": "iTwin"
          },
          "id": "d60709aa383d111fc93184b990976178bd02a46a",
          "message": "Add performance tests",
          "timestamp": "2025-05-05T14:27:08Z",
          "url": "https://github.com/iTwin/viewer-components-react/pull/1310/commits/d60709aa383d111fc93184b990976178bd02a46a"
        },
        "date": 1746638211025,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2422.39,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1681,
            "unit": "ms",
            "extra": "count: 7\nmax: 1681\np95: 1681\nmedian: 31"
          },
          {
            "name": "categories tree creates initial filtered view for 5k items",
            "value": 178.46,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 5k items (P95 of main thread blocks)",
            "value": 45,
            "unit": "ms",
            "extra": "count: 2\nmax: 45\np95: 45\nmedian: 40.5"
          },
          {
            "name": "categories tree changes visibility for 5k items",
            "value": 2032.8,
            "unit": "ms"
          },
          {
            "name": "categories tree changes visibility for 5k items (P95 of main thread blocks)",
            "value": 212,
            "unit": "ms",
            "extra": "count: 21\nmax: 304\np95: 212\nmedian: 34"
          },
          {
            "name": "categories tree changes visibility for 50k items",
            "value": 24876.9,
            "unit": "ms"
          },
          {
            "name": "categories tree changes visibility for 50k items (P95 of main thread blocks)",
            "value": 2028,
            "unit": "ms",
            "extra": "count: 27\nmax: 6942\np95: 2028\nmedian: 36"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2305.42,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 360,
            "unit": "ms",
            "extra": "count: 11\nmax: 360\np95: 360\nmedian: 35"
          },
          {
            "name": "models tree creates initial filtered view for 5k target items",
            "value": 156.82,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 5k target items (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changes visibility for 5k items",
            "value": 10053.66,
            "unit": "ms"
          },
          {
            "name": "models tree changes visibility for 5k items (P95 of main thread blocks)",
            "value": 421,
            "unit": "ms",
            "extra": "count: 10\nmax: 421\np95: 421\nmedian: 28"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "100586436+JonasDov@users.noreply.github.com",
            "name": "JonasDov",
            "username": "JonasDov"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ccdccffd2d9c2e1cafead78c1b57744eb6abeca5",
          "message": "Add performance tests (#1310)\n\n* Add performance tests\n\n* Run prettier and lint\n\n* Run extract\n\n* add benchmark command to root package.json\n\n* Create initial gh pages branch with data\n\n* Remove autopush\n\n* Update apps/performance-tests/src/tree-widget/StatelessHierarchyProvider.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Adress comments\n\n* Remove IS_REACT_ACT_ENVIRONMENT\n\n* Eslint fix\n\n* Update apps/performance-tests/src/util/Datasets.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update apps/performance-tests/src/util/Datasets.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Adress comments\n\n* Run lint\n\n* Adress comments\n\n* Update apps/performance-tests/src/tree-widget/VisibilityUtilities.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Adjust how definition container id is retrieved\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-05-14T08:46:51-04:00",
          "tree_id": "cb906ce514a7503781e70cdbfe262f83a38724f3",
          "url": "https://github.com/iTwin/viewer-components-react/commit/ccdccffd2d9c2e1cafead78c1b57744eb6abeca5"
        },
        "date": 1747227378443,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2344.12,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1677,
            "unit": "ms",
            "extra": "count: 6\nmax: 1677\np95: 1677\nmedian: 35"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9722.96,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3263,
            "unit": "ms",
            "extra": "count: 18\nmax: 3263\np95: 3263\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6967.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4280,
            "unit": "ms",
            "extra": "count: 7\nmax: 4280\np95: 4280\nmedian: 43"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2302.16,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 368,
            "unit": "ms",
            "extra": "count: 10\nmax: 368\np95: 368\nmedian: 33.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48154.59,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 284,
            "unit": "ms",
            "extra": "count: 14\nmax: 284\np95: 284\nmedian: 40"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48020.48,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 356,
            "unit": "ms",
            "extra": "count: 16\nmax: 356\np95: 356\nmedian: 30"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 46572.02,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 252,
            "unit": "ms",
            "extra": "count: 17\nmax: 252\np95: 252\nmedian: 29"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49901.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 477,
            "unit": "ms",
            "extra": "count: 19\nmax: 477\np95: 477\nmedian: 32"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "mdastous-bentley@users.noreply.github.com",
            "name": "Michel D'Astous",
            "username": "mdastous-bentley"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d2ea00ead2c5c4a297907b64456a0b5c9628a251",
          "message": "Google Maps support (#1304)\n\n* wip\n\n* get viewer working\n\n* wip\n\n* fix build\n\n* wip\n\n* fix tests\n\n* clean up\n\n* wip\n\n* fixed deprecated properties\n\n* code clean up\n\n* code clean up\n\n* update presentation deps to versions that properly support core @ 5.0-rc\n\n* Removed `import *` from map-layers-formats\n\n* beachball change\n\n* pnpm change\n\n* update root readme to mention itwinjs 5 compatible pkgs\n\n* revert file\n\n---------\n\nCo-authored-by: Arun George <aruniverse@users.noreply.github.com>\nCo-authored-by: Grigas Petraitis <35135765+grigasp@users.noreply.github.com>\nCo-authored-by: Arun George <11051042+aruniverse@users.noreply.github.com>",
          "timestamp": "2025-05-14T17:09:33-04:00",
          "tree_id": "dfb6511ac887bf8eeea842659f48e10fa07401c6",
          "url": "https://github.com/iTwin/viewer-components-react/commit/d2ea00ead2c5c4a297907b64456a0b5c9628a251"
        },
        "date": 1747257497562,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2354.11,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1641,
            "unit": "ms",
            "extra": "count: 4\nmax: 1641\np95: 1641\nmedian: 106"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10864.18,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4369,
            "unit": "ms",
            "extra": "count: 19\nmax: 4369\np95: 4369\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7059.2,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3878,
            "unit": "ms",
            "extra": "count: 7\nmax: 3878\np95: 3878\nmedian: 56"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2179.79,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 261,
            "unit": "ms",
            "extra": "count: 9\nmax: 261\np95: 261\nmedian: 27"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 44622.29,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 278,
            "unit": "ms",
            "extra": "count: 14\nmax: 278\np95: 278\nmedian: 40"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 45259.93,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 248,
            "unit": "ms",
            "extra": "count: 14\nmax: 248\np95: 248\nmedian: 31.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 45230.2,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 267,
            "unit": "ms",
            "extra": "count: 17\nmax: 267\np95: 267\nmedian: 34"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48001.91,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 499,
            "unit": "ms",
            "extra": "count: 16\nmax: 499\np95: 499\nmedian: 50"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "imodeljs-admin@users.noreply.github.com",
            "name": "imodeljs-admin",
            "username": "imodeljs-admin"
          },
          "committer": {
            "email": "imodeljs-admin@users.noreply.github.com",
            "name": "imodeljs-admin",
            "username": "imodeljs-admin"
          },
          "distinct": true,
          "id": "63987cc2d20b2a258819d4ac76774deaf7b627b1",
          "message": "applying package updates",
          "timestamp": "2025-05-15T05:33:32Z",
          "tree_id": "0f9f03451972efae84e42f594bf11b9209d66d90",
          "url": "https://github.com/iTwin/viewer-components-react/commit/63987cc2d20b2a258819d4ac76774deaf7b627b1"
        },
        "date": 1747287807659,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2382.83,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1652,
            "unit": "ms",
            "extra": "count: 4\nmax: 1652\np95: 1652\nmedian: 111"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 15457.25,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 738,
            "unit": "ms",
            "extra": "count: 37\nmax: 4506\np95: 738\nmedian: 62"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7399.18,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4199,
            "unit": "ms",
            "extra": "count: 8\nmax: 4199\np95: 4199\nmedian: 64.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2406.92,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 183,
            "unit": "ms",
            "extra": "count: 12\nmax: 183\np95: 183\nmedian: 41"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 53988.17,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 110,
            "unit": "ms",
            "extra": "count: 25\nmax: 315\np95: 110\nmedian: 44"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 53633.73,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 138,
            "unit": "ms",
            "extra": "count: 26\nmax: 327\np95: 138\nmedian: 53.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 53491.59,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 25\nmax: 286\np95: 113\nmedian: 40"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 54435.06,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 341,
            "unit": "ms",
            "extra": "count: 22\nmax: 489\np95: 341\nmedian: 57.5"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "11051042+aruniverse@users.noreply.github.com",
            "name": "Arun George",
            "username": "aruniverse"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "8365a53de8e40dcbf9dc35882f8480219099afe5",
          "message": "[tree-widget] [property-grid] add peers on itwinjs 5 (#1326)",
          "timestamp": "2025-05-19T07:43:07-04:00",
          "tree_id": "7f4d226e78d95c24ba105d653c72ae2e237fc40a",
          "url": "https://github.com/iTwin/viewer-components-react/commit/8365a53de8e40dcbf9dc35882f8480219099afe5"
        },
        "date": 1747655598665,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2520.3,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1670,
            "unit": "ms",
            "extra": "count: 9\nmax: 1670\np95: 1670\nmedian: 34"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 14672.48,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 793,
            "unit": "ms",
            "extra": "count: 36\nmax: 2720\np95: 793\nmedian: 67.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6654.13,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3204,
            "unit": "ms",
            "extra": "count: 9\nmax: 3204\np95: 3204\nmedian: 54"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2413.35,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 332,
            "unit": "ms",
            "extra": "count: 16\nmax: 332\np95: 332\nmedian: 35.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 57423.32,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 147,
            "unit": "ms",
            "extra": "count: 24\nmax: 319\np95: 147\nmedian: 47.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 55985.68,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 313,
            "unit": "ms",
            "extra": "count: 20\nmax: 313\np95: 313\nmedian: 63.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 53717.1,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 110,
            "unit": "ms",
            "extra": "count: 23\nmax: 284\np95: 110\nmedian: 38"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 54101.55,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 382,
            "unit": "ms",
            "extra": "count: 22\nmax: 497\np95: 382\nmedian: 59.5"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "imodeljs-admin@users.noreply.github.com",
            "name": "imodeljs-admin",
            "username": "imodeljs-admin"
          },
          "committer": {
            "email": "imodeljs-admin@users.noreply.github.com",
            "name": "imodeljs-admin",
            "username": "imodeljs-admin"
          },
          "distinct": true,
          "id": "de399eff2271081277c75a3ce8a73cd776cdf7ed",
          "message": "applying package updates",
          "timestamp": "2025-05-19T16:58:21Z",
          "tree_id": "750b087e521710ed927b661d36ab7e1f9132637b",
          "url": "https://github.com/iTwin/viewer-components-react/commit/de399eff2271081277c75a3ce8a73cd776cdf7ed"
        },
        "date": 1747674528179,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2376.45,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1685,
            "unit": "ms",
            "extra": "count: 7\nmax: 1685\np95: 1685\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 14834.22,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 746,
            "unit": "ms",
            "extra": "count: 39\nmax: 3818\np95: 746\nmedian: 65"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7788.89,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 5068,
            "unit": "ms",
            "extra": "count: 8\nmax: 5068\np95: 5068\nmedian: 42.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2270.06,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 90,
            "unit": "ms",
            "extra": "count: 16\nmax: 90\np95: 90\nmedian: 34"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 53519.33,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 109,
            "unit": "ms",
            "extra": "count: 22\nmax: 324\np95: 109\nmedian: 42.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 57418.05,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 119,
            "unit": "ms",
            "extra": "count: 22\nmax: 345\np95: 119\nmedian: 46.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 57269.61,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 298,
            "unit": "ms",
            "extra": "count: 20\nmax: 298\np95: 298\nmedian: 78.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 58776.95,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 401,
            "unit": "ms",
            "extra": "count: 27\nmax: 513\np95: 401\nmedian: 52"
          }
        ]
      }
    ]
  }
}