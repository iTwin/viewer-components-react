window.BENCHMARK_DATA = {
  "lastUpdate": 1754467619809,
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
          "id": "ca930b1fc0f70467cf3fbe714517e0ee4adccd9d",
          "message": "Update `getFilteredPaths` documentation (#1335)\n\n* Add comments\n\n* Run extract and changeset\n\n* Update doc clarity\n\n* Update readme\n\n* Update extractions\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/UseModelsTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/UseModelsTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/UseModelsTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/UseModelsTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/UseModelsTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/UseModelsTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/README.md\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/README.md\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update change/@itwin-tree-widget-react-4979d818-712d-4f2a-b27e-ac9adef6517b.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update snippets\n\n* Update apps/learning-snippets/src/test/tree-widget/FilteredPaths.test.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update apps/learning-snippets/src/test/tree-widget/FilteredPaths.test.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update apps/learning-snippets/src/test/tree-widget/FilteredPaths.test.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* run update extractions\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-06-02T15:03:10+03:00",
          "tree_id": "4c5960bb7662170fa5545c24487cb8300360abd1",
          "url": "https://github.com/iTwin/viewer-components-react/commit/ca930b1fc0f70467cf3fbe714517e0ee4adccd9d"
        },
        "date": 1748866398148,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2342.38,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1682,
            "unit": "ms",
            "extra": "count: 6\nmax: 1682\np95: 1682\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 13509.62,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 782,
            "unit": "ms",
            "extra": "count: 33\nmax: 2625\np95: 782\nmedian: 62"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7980.43,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4719,
            "unit": "ms",
            "extra": "count: 8\nmax: 4719\np95: 4719\nmedian: 57.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2268.14,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 222,
            "unit": "ms",
            "extra": "count: 13\nmax: 222\np95: 222\nmedian: 36"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 53035.23,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 128,
            "unit": "ms",
            "extra": "count: 22\nmax: 295\np95: 128\nmedian: 42"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 53410.07,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 286,
            "unit": "ms",
            "extra": "count: 20\nmax: 286\np95: 286\nmedian: 69.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 53260.16,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 109,
            "unit": "ms",
            "extra": "count: 24\nmax: 365\np95: 109\nmedian: 42.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 54236.91,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 356,
            "unit": "ms",
            "extra": "count: 24\nmax: 515\np95: 356\nmedian: 60.5"
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
          "id": "4c5463565344a77cfd1b7e1811e4ef76037f8f66",
          "message": "applying package updates",
          "timestamp": "2025-06-02T13:19:21Z",
          "tree_id": "207f7c33b51e22713353ae15b6a232a3da3ca981",
          "url": "https://github.com/iTwin/viewer-components-react/commit/4c5463565344a77cfd1b7e1811e4ef76037f8f66"
        },
        "date": 1748870995608,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2410.6,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1703,
            "unit": "ms",
            "extra": "count: 6\nmax: 1703\np95: 1703\nmedian: 30.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 13754.09,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 774,
            "unit": "ms",
            "extra": "count: 35\nmax: 2585\np95: 774\nmedian: 65"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7361.63,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4542,
            "unit": "ms",
            "extra": "count: 7\nmax: 4542\np95: 4542\nmedian: 40"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2349.12,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 282,
            "unit": "ms",
            "extra": "count: 14\nmax: 282\np95: 282\nmedian: 34.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 54805.25,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 347,
            "unit": "ms",
            "extra": "count: 20\nmax: 347\np95: 347\nmedian: 66"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 55206.83,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 21\nmax: 313\np95: 113\nmedian: 57"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 54753.75,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 132,
            "unit": "ms",
            "extra": "count: 22\nmax: 361\np95: 132\nmedian: 60"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 58931.82,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 496,
            "unit": "ms",
            "extra": "count: 22\nmax: 508\np95: 496\nmedian: 61"
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
          "id": "6bb80f1c9307809d157332ba5a1438e062e0eb58",
          "message": "Bump itwinjs-core dependencies to v5.0.0 (#1349)\n\n* Bump itwinjs-core dependencies to v5.0.0\n\n* Add changefile\n\n* Run extract api\n\n* Undo import change update",
          "timestamp": "2025-06-20T13:35:27+03:00",
          "tree_id": "13d25169b39380b030fae9d52520b69294e4cfa3",
          "url": "https://github.com/iTwin/viewer-components-react/commit/6bb80f1c9307809d157332ba5a1438e062e0eb58"
        },
        "date": 1750416313374,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2510.66,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1686,
            "unit": "ms",
            "extra": "count: 6\nmax: 1686\np95: 1686\nmedian: 67.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10433.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3502,
            "unit": "ms",
            "extra": "count: 17\nmax: 3502\np95: 3502\nmedian: 34"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6665.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3980,
            "unit": "ms",
            "extra": "count: 7\nmax: 3980\np95: 3980\nmedian: 39"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2239.55,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 77,
            "unit": "ms",
            "extra": "count: 14\nmax: 77\np95: 77\nmedian: 32"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51880.27,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 294,
            "unit": "ms",
            "extra": "count: 12\nmax: 294\np95: 294\nmedian: 33.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50770.24,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 382,
            "unit": "ms",
            "extra": "count: 14\nmax: 382\np95: 382\nmedian: 32.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 50632.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 275,
            "unit": "ms",
            "extra": "count: 13\nmax: 275\np95: 275\nmedian: 38"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 52375.19,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 490,
            "unit": "ms",
            "extra": "count: 19\nmax: 490\np95: 490\nmedian: 39"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "834cdd649d3bbd9971d42e4023c886abe62bebca",
          "message": "Bump fast-xml-parser from 4.3.6 to 4.4.1 in /packages/itwin/tree-widget (#1351)\n\nBumps [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) from 4.3.6 to 4.4.1.\n- [Release notes](https://github.com/NaturalIntelligence/fast-xml-parser/releases)\n- [Changelog](https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md)\n- [Commits](https://github.com/NaturalIntelligence/fast-xml-parser/compare/v4.3.6...v4.4.1)\n\n---\nupdated-dependencies:\n- dependency-name: fast-xml-parser\n  dependency-version: 4.4.1\n  dependency-type: direct:development\n...\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2025-06-20T11:12:02Z",
          "tree_id": "36f132870a92182529a01bd9324af8bb2e88e417",
          "url": "https://github.com/iTwin/viewer-components-react/commit/834cdd649d3bbd9971d42e4023c886abe62bebca"
        },
        "date": 1750418492423,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2539.61,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1729,
            "unit": "ms",
            "extra": "count: 6\nmax: 1729\np95: 1729\nmedian: 66.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9643.12,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2931,
            "unit": "ms",
            "extra": "count: 18\nmax: 2931\np95: 2931\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6850.5,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3575,
            "unit": "ms",
            "extra": "count: 9\nmax: 3575\np95: 3575\nmedian: 52"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2300.17,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 305,
            "unit": "ms",
            "extra": "count: 14\nmax: 305\np95: 305\nmedian: 35"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50046.13,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 285,
            "unit": "ms",
            "extra": "count: 14\nmax: 285\np95: 285\nmedian: 37"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50137.95,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 277,
            "unit": "ms",
            "extra": "count: 13\nmax: 277\np95: 277\nmedian: 33"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 50754.25,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 268,
            "unit": "ms",
            "extra": "count: 13\nmax: 268\np95: 268\nmedian: 40"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 50722.52,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 488,
            "unit": "ms",
            "extra": "count: 18\nmax: 488\np95: 488\nmedian: 47.5"
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
          "id": "352f29c44afbada8234be295a67125f538e3b438",
          "message": "applying package updates",
          "timestamp": "2025-06-20T17:05:06Z",
          "tree_id": "6fd130b8beedabdeab71a06bc729963705419899",
          "url": "https://github.com/iTwin/viewer-components-react/commit/352f29c44afbada8234be295a67125f538e3b438"
        },
        "date": 1750439617367,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2362.32,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1608,
            "unit": "ms",
            "extra": "count: 8\nmax: 1608\np95: 1608\nmedian: 30.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 8791.66,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2705,
            "unit": "ms",
            "extra": "count: 17\nmax: 2705\np95: 2705\nmedian: 29"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6116.68,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2994,
            "unit": "ms",
            "extra": "count: 9\nmax: 2994\np95: 2994\nmedian: 34"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2128.03,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 71,
            "unit": "ms",
            "extra": "count: 12\nmax: 71\np95: 71\nmedian: 33.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 45078.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 251,
            "unit": "ms",
            "extra": "count: 11\nmax: 251\np95: 251\nmedian: 27"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 44934.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 235,
            "unit": "ms",
            "extra": "count: 15\nmax: 235\np95: 235\nmedian: 34"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 44676.15,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 235,
            "unit": "ms",
            "extra": "count: 12\nmax: 235\np95: 235\nmedian: 28.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 45649.8,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 447,
            "unit": "ms",
            "extra": "count: 14\nmax: 447\np95: 447\nmedian: 35.5"
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
          "id": "96beca02d7274f6ae5e846feee0d8b31e78f8036",
          "message": "Category count query fix (#1364)\n\n* Fix category count query throwing error with large imodels\n\n* Add changeset\n\n* Fix unit test\n\n* Adjust tests\n\n* Add comment\n\n* Adress comment\n\n* Increase waitFor timeout for large imodel test\n\n* Increase waitFor timeout for large imodel test",
          "timestamp": "2025-07-03T14:52:39+03:00",
          "tree_id": "1cb44a2a2b1ddc33f8eca3bbaa65abaccf9e002a",
          "url": "https://github.com/iTwin/viewer-components-react/commit/96beca02d7274f6ae5e846feee0d8b31e78f8036"
        },
        "date": 1751544112007,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2452.54,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1663,
            "unit": "ms",
            "extra": "count: 7\nmax: 1663\np95: 1663\nmedian: 39"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9030.65,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2554,
            "unit": "ms",
            "extra": "count: 15\nmax: 2554\np95: 2554\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6555.08,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3831,
            "unit": "ms",
            "extra": "count: 7\nmax: 3831\np95: 3831\nmedian: 39"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2262.07,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 289,
            "unit": "ms",
            "extra": "count: 10\nmax: 289\np95: 289\nmedian: 37.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50003.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 279,
            "unit": "ms",
            "extra": "count: 13\nmax: 279\np95: 279\nmedian: 37"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 46806.21,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 239,
            "unit": "ms",
            "extra": "count: 14\nmax: 239\np95: 239\nmedian: 34"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48085.98,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 243,
            "unit": "ms",
            "extra": "count: 14\nmax: 243\np95: 243\nmedian: 38"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49137.77,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 476,
            "unit": "ms",
            "extra": "count: 18\nmax: 476\np95: 476\nmedian: 38.5"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "24278440+saskliutas@users.noreply.github.com",
            "name": "Saulius Skliutas",
            "username": "saskliutas"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "358152a41bbb49c65445c5a4c9dfbd639edad74e",
          "message": "[test-viewer] Dependencies bump (#1368)\n\n* Bump test-viewer dependencies\n\n* change\n\n* Update script\n\n* Update screenshots\n\n* Fix e2e screenshots\n\n* change",
          "timestamp": "2025-07-04T18:13:26+03:00",
          "tree_id": "d2e63bb57c26716c4ce9a9529bda89f570de0577",
          "url": "https://github.com/iTwin/viewer-components-react/commit/358152a41bbb49c65445c5a4c9dfbd639edad74e"
        },
        "date": 1751642541458,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2436.07,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1669,
            "unit": "ms",
            "extra": "count: 6\nmax: 1669\np95: 1669\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9782.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3234,
            "unit": "ms",
            "extra": "count: 17\nmax: 3234\np95: 3234\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6789.27,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3577,
            "unit": "ms",
            "extra": "count: 8\nmax: 3577\np95: 3577\nmedian: 45.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2189.81,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 201,
            "unit": "ms",
            "extra": "count: 13\nmax: 201\np95: 201\nmedian: 45"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 46993.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 263,
            "unit": "ms",
            "extra": "count: 11\nmax: 263\np95: 263\nmedian: 32"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49489.62,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 380,
            "unit": "ms",
            "extra": "count: 13\nmax: 380\np95: 380\nmedian: 30"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 50123.1,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 267,
            "unit": "ms",
            "extra": "count: 14\nmax: 267\np95: 267\nmedian: 35"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49644.01,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 471,
            "unit": "ms",
            "extra": "count: 15\nmax: 471\np95: 471\nmedian: 39"
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
          "id": "146bf78378956cfbbf5bd72fd8d3a9e913cac491",
          "message": "Skip failing release test (#1370)\n\n* Skip test\n\n* Skip failing test",
          "timestamp": "2025-07-07T18:10:36Z",
          "tree_id": "602c305538583e1fa34af5e6cad07c0cef0874c9",
          "url": "https://github.com/iTwin/viewer-components-react/commit/146bf78378956cfbbf5bd72fd8d3a9e913cac491"
        },
        "date": 1751912373085,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2541.28,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1640,
            "unit": "ms",
            "extra": "count: 8\nmax: 1640\np95: 1640\nmedian: 37"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 8980.25,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2585,
            "unit": "ms",
            "extra": "count: 18\nmax: 2585\np95: 2585\nmedian: 30.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6906.36,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3673,
            "unit": "ms",
            "extra": "count: 9\nmax: 3673\np95: 3673\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2239.98,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 290,
            "unit": "ms",
            "extra": "count: 12\nmax: 290\np95: 290\nmedian: 31.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47834.58,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 273,
            "unit": "ms",
            "extra": "count: 12\nmax: 273\np95: 273\nmedian: 37"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47459.73,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 254,
            "unit": "ms",
            "extra": "count: 14\nmax: 254\np95: 254\nmedian: 29.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 46941.77,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 255,
            "unit": "ms",
            "extra": "count: 13\nmax: 255\np95: 255\nmedian: 34"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 47915.99,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 475,
            "unit": "ms",
            "extra": "count: 15\nmax: 475\np95: 475\nmedian: 42"
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
          "id": "20cd7635c386e05e74b856a1118381d2cf0449dc",
          "message": "applying package updates",
          "timestamp": "2025-07-07T19:55:02Z",
          "tree_id": "4f5d7dba6bbe6b586a9eb78fbc7cea295c119f17",
          "url": "https://github.com/iTwin/viewer-components-react/commit/20cd7635c386e05e74b856a1118381d2cf0449dc"
        },
        "date": 1751918663356,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2517.68,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1674,
            "unit": "ms",
            "extra": "count: 9\nmax: 1674\np95: 1674\nmedian: 33"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10325.27,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3623,
            "unit": "ms",
            "extra": "count: 17\nmax: 3623\np95: 3623\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6828.65,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3566,
            "unit": "ms",
            "extra": "count: 8\nmax: 3566\np95: 3566\nmedian: 56.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2180.67,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 69,
            "unit": "ms",
            "extra": "count: 13\nmax: 69\np95: 69\nmedian: 30"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49737.57,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 300,
            "unit": "ms",
            "extra": "count: 10\nmax: 300\np95: 300\nmedian: 68"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49359.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 265,
            "unit": "ms",
            "extra": "count: 16\nmax: 265\np95: 265\nmedian: 46.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 50086.26,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 271,
            "unit": "ms",
            "extra": "count: 15\nmax: 271\np95: 271\nmedian: 33"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 52097.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 493,
            "unit": "ms",
            "extra": "count: 17\nmax: 493\np95: 493\nmedian: 42"
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
          "id": "45a43724fbcdd432bb5a55aafb1d5e9a2d837a29",
          "message": "Move integration test to performance tests (#1371)\n\n* Move integration test to performance tests\n\n* Update apps/performance-tests/src/tree-widget/VisibilityUtilities.ts\n\nCo-authored-by: Saulius Skliutas <24278440+saskliutas@users.noreply.github.com>\n\n* Simplify condition\n\n---------\n\nCo-authored-by: Saulius Skliutas <24278440+saskliutas@users.noreply.github.com>",
          "timestamp": "2025-07-09T11:36:46+03:00",
          "tree_id": "4cd51dfe5660e905912c63c7b695c5b14c012424",
          "url": "https://github.com/iTwin/viewer-components-react/commit/45a43724fbcdd432bb5a55aafb1d5e9a2d837a29"
        },
        "date": 1752050779014,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2501.62,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1646,
            "unit": "ms",
            "extra": "count: 9\nmax: 1646\np95: 1646\nmedian: 37"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9365.94,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2999,
            "unit": "ms",
            "extra": "count: 17\nmax: 2999\np95: 2999\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7222.64,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3997,
            "unit": "ms",
            "extra": "count: 7\nmax: 3997\np95: 3997\nmedian: 63"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2269.65,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 296,
            "unit": "ms",
            "extra": "count: 13\nmax: 296\np95: 296\nmedian: 36"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15964.56,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 3781,
            "unit": "ms",
            "extra": "count: 11\nmax: 3781\np95: 3781\nmedian: 35"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48831.79,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 289,
            "unit": "ms",
            "extra": "count: 10\nmax: 289\np95: 289\nmedian: 53.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47639.33,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 254,
            "unit": "ms",
            "extra": "count: 18\nmax: 254\np95: 254\nmedian: 36"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48088.83,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 247,
            "unit": "ms",
            "extra": "count: 13\nmax: 247\np95: 247\nmedian: 34"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48109.13,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 452,
            "unit": "ms",
            "extra": "count: 14\nmax: 452\np95: 452\nmedian: 48"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "24278440+saskliutas@users.noreply.github.com",
            "name": "Saulius Skliutas",
            "username": "saskliutas"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ffeaba0dd2c6e5c62e89f25da999ec229a5f3c58",
          "message": "[Tree widget]: Add missing peers (#1376)\n\n* Add missing peer dependencies\n\n* change",
          "timestamp": "2025-07-14T14:37:32+03:00",
          "tree_id": "301a600363ae6a7d586d76564ad04cee5be462ba",
          "url": "https://github.com/iTwin/viewer-components-react/commit/ffeaba0dd2c6e5c62e89f25da999ec229a5f3c58"
        },
        "date": 1752493615777,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2467.36,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1647,
            "unit": "ms",
            "extra": "count: 7\nmax: 1647\np95: 1647\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9277.26,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2781,
            "unit": "ms",
            "extra": "count: 17\nmax: 2781\np95: 2781\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6782.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3572,
            "unit": "ms",
            "extra": "count: 10\nmax: 3572\np95: 3572\nmedian: 43"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2241.72,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 365,
            "unit": "ms",
            "extra": "count: 9\nmax: 365\np95: 365\nmedian: 31"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15092.44,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4159,
            "unit": "ms",
            "extra": "count: 11\nmax: 4159\np95: 4159\nmedian: 65"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48788.79,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 270,
            "unit": "ms",
            "extra": "count: 11\nmax: 270\np95: 270\nmedian: 34"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48610.02,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 255,
            "unit": "ms",
            "extra": "count: 14\nmax: 255\np95: 255\nmedian: 51"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48140.07,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 254,
            "unit": "ms",
            "extra": "count: 14\nmax: 254\np95: 254\nmedian: 35.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49445.49,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 487,
            "unit": "ms",
            "extra": "count: 14\nmax: 487\np95: 487\nmedian: 34.5"
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
          "id": "a6bcc7cea107ade0d570d9a36d0a5166e125ec64",
          "message": "applying package updates",
          "timestamp": "2025-07-14T12:38:56Z",
          "tree_id": "86ce4b42adb99f098f904d6abc5ed5eab6fb5db6",
          "url": "https://github.com/iTwin/viewer-components-react/commit/a6bcc7cea107ade0d570d9a36d0a5166e125ec64"
        },
        "date": 1752497305341,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2585.57,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1706,
            "unit": "ms",
            "extra": "count: 8\nmax: 1706\np95: 1706\nmedian: 32.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9419.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2969,
            "unit": "ms",
            "extra": "count: 16\nmax: 2969\np95: 2969\nmedian: 30.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6678.6,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3471,
            "unit": "ms",
            "extra": "count: 9\nmax: 3471\np95: 3471\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2215.98,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 296,
            "unit": "ms",
            "extra": "count: 9\nmax: 296\np95: 296\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15076.67,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4137,
            "unit": "ms",
            "extra": "count: 10\nmax: 4137\np95: 4137\nmedian: 452.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48100.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 315,
            "unit": "ms",
            "extra": "count: 14\nmax: 315\np95: 315\nmedian: 41"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47944.53,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 257,
            "unit": "ms",
            "extra": "count: 16\nmax: 257\np95: 257\nmedian: 36"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 47758.17,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 254,
            "unit": "ms",
            "extra": "count: 17\nmax: 254\np95: 254\nmedian: 35"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49644.76,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 463,
            "unit": "ms",
            "extra": "count: 13\nmax: 463\np95: 463\nmedian: 34"
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
          "id": "716fac477486d6a6ee5461677d6436d1230665b4",
          "message": "Update @itwin/presentation-hierarchies and @itwin/presentation-hierarchies-react dependency versions (#1379)\n\n* Update package versions\n\n* Fix takeUntil issues",
          "timestamp": "2025-07-18T10:48:05-04:00",
          "tree_id": "c6514ca526585b8cf3948ea66afb214a5fd345aa",
          "url": "https://github.com/iTwin/viewer-components-react/commit/716fac477486d6a6ee5461677d6436d1230665b4"
        },
        "date": 1752850693991,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2454.59,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1702,
            "unit": "ms",
            "extra": "count: 6\nmax: 1702\np95: 1702\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9659.61,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2930,
            "unit": "ms",
            "extra": "count: 16\nmax: 2930\np95: 2930\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6238.52,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3044,
            "unit": "ms",
            "extra": "count: 9\nmax: 3044\np95: 3044\nmedian: 37"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2369.63,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 296,
            "unit": "ms",
            "extra": "count: 13\nmax: 296\np95: 296\nmedian: 32"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16918.55,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4022,
            "unit": "ms",
            "extra": "count: 11\nmax: 4022\np95: 4022\nmedian: 38"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 52548.79,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 296,
            "unit": "ms",
            "extra": "count: 17\nmax: 296\np95: 296\nmedian: 33"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 52680.16,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 295,
            "unit": "ms",
            "extra": "count: 13\nmax: 295\np95: 295\nmedian: 46"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 52862.2,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 287,
            "unit": "ms",
            "extra": "count: 15\nmax: 287\np95: 287\nmedian: 44"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 53453.63,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 498,
            "unit": "ms",
            "extra": "count: 17\nmax: 498\np95: 498\nmedian: 37"
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
          "id": "8394f55100949c152f6061b3844a27e62986f7d5",
          "message": "Add prettier to the pipeline (#1384)\n\n* Add prettier\n\n* Add changeset",
          "timestamp": "2025-07-23T07:02:23-04:00",
          "tree_id": "10d585a6424af141f902da7fed1667e563f3fc76",
          "url": "https://github.com/iTwin/viewer-components-react/commit/8394f55100949c152f6061b3844a27e62986f7d5"
        },
        "date": 1753269117113,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2383.69,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1647,
            "unit": "ms",
            "extra": "count: 7\nmax: 1647\np95: 1647\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10170.41,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3858,
            "unit": "ms",
            "extra": "count: 18\nmax: 3858\np95: 3858\nmedian: 30.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6741.61,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3685,
            "unit": "ms",
            "extra": "count: 10\nmax: 3685\np95: 3685\nmedian: 43"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2307.68,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 381,
            "unit": "ms",
            "extra": "count: 13\nmax: 381\np95: 381\nmedian: 30"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15397.87,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4536,
            "unit": "ms",
            "extra": "count: 12\nmax: 4536\np95: 4536\nmedian: 61"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50388.61,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 297,
            "unit": "ms",
            "extra": "count: 11\nmax: 297\np95: 297\nmedian: 43"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48193.28,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 266,
            "unit": "ms",
            "extra": "count: 13\nmax: 266\np95: 266\nmedian: 50"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48822.67,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 270,
            "unit": "ms",
            "extra": "count: 15\nmax: 270\np95: 270\nmedian: 31"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48712.43,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 479,
            "unit": "ms",
            "extra": "count: 16\nmax: 479\np95: 479\nmedian: 44"
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
          "id": "b00fd369efde15ccabbecae582777139e4fac126",
          "message": "[Tree-widget]: Fix categories tree visibility inversion incorrectly changing per model category override (#1381)\n\n* Fix categories tree inversion incorrectly changing per model category override.\n\n* Refactor category inversion logic\n\n* Adress comment",
          "timestamp": "2025-07-23T12:23:00Z",
          "tree_id": "21143b31180c6d7c293b812cde3453a51f9ccdd5",
          "url": "https://github.com/iTwin/viewer-components-react/commit/b00fd369efde15ccabbecae582777139e4fac126"
        },
        "date": 1753273952367,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2425.02,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1714,
            "unit": "ms",
            "extra": "count: 5\nmax: 1714\np95: 1714\nmedian: 38"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10754.61,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3847,
            "unit": "ms",
            "extra": "count: 18\nmax: 3847\np95: 3847\nmedian: 33.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6596.2,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3256,
            "unit": "ms",
            "extra": "count: 8\nmax: 3256\np95: 3256\nmedian: 44"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2400.52,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 313,
            "unit": "ms",
            "extra": "count: 15\nmax: 313\np95: 313\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16723.53,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 3898,
            "unit": "ms",
            "extra": "count: 10\nmax: 3898\np95: 3898\nmedian: 55.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49284.74,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 270,
            "unit": "ms",
            "extra": "count: 15\nmax: 270\np95: 270\nmedian: 30"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48927.2,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 255,
            "unit": "ms",
            "extra": "count: 12\nmax: 255\np95: 255\nmedian: 37.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49537.32,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 264,
            "unit": "ms",
            "extra": "count: 15\nmax: 264\np95: 264\nmedian: 35"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 50109.61,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 476,
            "unit": "ms",
            "extra": "count: 14\nmax: 476\np95: 476\nmedian: 52"
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
          "id": "6e71184dad6598b1e92f07c88aba0cafdb8b3cbf",
          "message": "applying package updates",
          "timestamp": "2025-07-24T16:07:32Z",
          "tree_id": "e6040096c272f1d54e24c58f533a2155b00cd105",
          "url": "https://github.com/iTwin/viewer-components-react/commit/6e71184dad6598b1e92f07c88aba0cafdb8b3cbf"
        },
        "date": 1753373867222,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2458.25,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1697,
            "unit": "ms",
            "extra": "count: 7\nmax: 1697\np95: 1697\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10188.05,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3437,
            "unit": "ms",
            "extra": "count: 16\nmax: 3437\np95: 3437\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6316.99,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3072,
            "unit": "ms",
            "extra": "count: 9\nmax: 3072\np95: 3072\nmedian: 46"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2350.41,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 314,
            "unit": "ms",
            "extra": "count: 15\nmax: 314\np95: 314\nmedian: 32"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15935.16,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4544,
            "unit": "ms",
            "extra": "count: 11\nmax: 4544\np95: 4544\nmedian: 79"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 53510.4,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 307,
            "unit": "ms",
            "extra": "count: 13\nmax: 307\np95: 307\nmedian: 33"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 52809.22,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 283,
            "unit": "ms",
            "extra": "count: 15\nmax: 283\np95: 283\nmedian: 48"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 54634.7,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 302,
            "unit": "ms",
            "extra": "count: 14\nmax: 302\np95: 302\nmedian: 39.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 55387.59,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 543,
            "unit": "ms",
            "extra": "count: 18\nmax: 543\np95: 543\nmedian: 38"
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
          "id": "4bec3e01cbe01fe9843f6bd54b43f9cba333536f",
          "message": "[Tree-widget]: Add option to get a smaller part of models tree (#1375)\n\n* Add subsetTree\n\n* Run extract api and changeset\n\n* Bump perentation-hierarchies version\n\n* Fix merge problems\n\n* Add back new line\n\n* Change subsetTreeConfig to getSubsetTreePaths\n\n* Rename getSubsetTreePaths to getSubTreePaths\n\n* Update name\n\n* Adress comments\n\n* Bump hierarchies versions and update comments\n\n* Update packages/itwin/tree-widget/public/locales/en/TreeWidget.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Add tests\n\n* Adress comments\n\n* Remove wait For\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-07-30T08:16:59-04:00",
          "tree_id": "efbb09a9d9bca7ac43e1ce957a2fb52ced2baf80",
          "url": "https://github.com/iTwin/viewer-components-react/commit/4bec3e01cbe01fe9843f6bd54b43f9cba333536f"
        },
        "date": 1753878389337,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2618.24,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1781,
            "unit": "ms",
            "extra": "count: 9\nmax: 1781\np95: 1781\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9049.54,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2575,
            "unit": "ms",
            "extra": "count: 20\nmax: 2575\np95: 2575\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6810.02,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3519,
            "unit": "ms",
            "extra": "count: 8\nmax: 3519\np95: 3519\nmedian: 47.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2309.29,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 340,
            "unit": "ms",
            "extra": "count: 12\nmax: 340\np95: 340\nmedian: 34.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16142.39,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4546,
            "unit": "ms",
            "extra": "count: 11\nmax: 4546\np95: 4546\nmedian: 74"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48217.1,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 271,
            "unit": "ms",
            "extra": "count: 12\nmax: 271\np95: 271\nmedian: 41.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47863.5,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 255,
            "unit": "ms",
            "extra": "count: 16\nmax: 255\np95: 255\nmedian: 35"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48469.77,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 259,
            "unit": "ms",
            "extra": "count: 15\nmax: 259\np95: 259\nmedian: 36"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49334.29,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 471,
            "unit": "ms",
            "extra": "count: 15\nmax: 471\np95: 471\nmedian: 43"
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
          "id": "583279de3e961dc1bf5c63599acfbc795a462729",
          "message": "applying package updates",
          "timestamp": "2025-07-30T13:10:01Z",
          "tree_id": "1b303f4f383061e26070dc504fcc6c125693dd01",
          "url": "https://github.com/iTwin/viewer-components-react/commit/583279de3e961dc1bf5c63599acfbc795a462729"
        },
        "date": 1753881570513,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2444.81,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1686,
            "unit": "ms",
            "extra": "count: 7\nmax: 1686\np95: 1686\nmedian: 34"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10356.38,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3998,
            "unit": "ms",
            "extra": "count: 15\nmax: 3998\np95: 3998\nmedian: 29"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6596.02,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3390,
            "unit": "ms",
            "extra": "count: 8\nmax: 3390\np95: 3390\nmedian: 52"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2308.47,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 332,
            "unit": "ms",
            "extra": "count: 11\nmax: 332\np95: 332\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 14602.88,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4088,
            "unit": "ms",
            "extra": "count: 11\nmax: 4088\np95: 4088\nmedian: 61"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49329.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 369,
            "unit": "ms",
            "extra": "count: 10\nmax: 369\np95: 369\nmedian: 64.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48541.95,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 246,
            "unit": "ms",
            "extra": "count: 14\nmax: 246\np95: 246\nmedian: 41"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48429.92,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 237,
            "unit": "ms",
            "extra": "count: 18\nmax: 237\np95: 237\nmedian: 32"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49451.71,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 500,
            "unit": "ms",
            "extra": "count: 15\nmax: 500\np95: 500\nmedian: 38"
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
          "id": "04dbd95e32655bd3fbbce950f79c8595d60480bc",
          "message": "[Tree-widget]: Add learning snippet for `getSubTreePaths` (#1388)\n\n* Add learning snippet\n\n* Add change file\n\n* Run prettier\n\n* Update apps/learning-snippets/src/test/tree-widget/SubTreePaths.test.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update apps/learning-snippets/src/test/tree-widget/SubTreePaths.test.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Run check-extractions\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-07-31T15:29:36+03:00",
          "tree_id": "ed5e3ebe338da69390a0b5043f04d95d6cf6b197",
          "url": "https://github.com/iTwin/viewer-components-react/commit/04dbd95e32655bd3fbbce950f79c8595d60480bc"
        },
        "date": 1753965558641,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2442.84,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1678,
            "unit": "ms",
            "extra": "count: 6\nmax: 1678\np95: 1678\nmedian: 35.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9582.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3084,
            "unit": "ms",
            "extra": "count: 18\nmax: 3084\np95: 3084\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7059.12,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3823,
            "unit": "ms",
            "extra": "count: 9\nmax: 3823\np95: 3823\nmedian: 61"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2359.78,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 320,
            "unit": "ms",
            "extra": "count: 13\nmax: 320\np95: 320\nmedian: 41"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15449.45,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4179,
            "unit": "ms",
            "extra": "count: 12\nmax: 4179\np95: 4179\nmedian: 51"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51303.86,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 296,
            "unit": "ms",
            "extra": "count: 13\nmax: 296\np95: 296\nmedian: 39"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47227.46,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 265,
            "unit": "ms",
            "extra": "count: 15\nmax: 265\np95: 265\nmedian: 35"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 47298.42,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 242,
            "unit": "ms",
            "extra": "count: 10\nmax: 242\np95: 242\nmedian: 55.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 47483.64,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 474,
            "unit": "ms",
            "extra": "count: 14\nmax: 474\np95: 474\nmedian: 44"
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
          "id": "297d985c3f7f8177abcc1d0a35209f6a286e2bf6",
          "message": "[Tree-widget]: Fix auto-expand when using getSubTreePaths together with filtering (#1391)\n\n* Fix subTree autoExpand\n\n* Add changeset\n\n* Remove getSubTreePaths from test app\n\n* Update tests\n\n* Make test stable",
          "timestamp": "2025-08-06T10:57:39+03:00",
          "tree_id": "2963c1c611a9b69a01bc57157337805f1ea30b5e",
          "url": "https://github.com/iTwin/viewer-components-react/commit/297d985c3f7f8177abcc1d0a35209f6a286e2bf6"
        },
        "date": 1754467617638,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2540.41,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1644,
            "unit": "ms",
            "extra": "count: 10\nmax: 1644\np95: 1644\nmedian: 35.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9643.47,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3171,
            "unit": "ms",
            "extra": "count: 16\nmax: 3171\np95: 3171\nmedian: 29.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6248.19,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2986,
            "unit": "ms",
            "extra": "count: 8\nmax: 2986\np95: 2986\nmedian: 44"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2342.32,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 297,
            "unit": "ms",
            "extra": "count: 13\nmax: 297\np95: 297\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15197.19,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4126,
            "unit": "ms",
            "extra": "count: 12\nmax: 4126\np95: 4126\nmedian: 47.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47974.94,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 269,
            "unit": "ms",
            "extra": "count: 14\nmax: 269\np95: 269\nmedian: 43.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48082.67,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 255,
            "unit": "ms",
            "extra": "count: 13\nmax: 255\np95: 255\nmedian: 29"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48098.47,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 254,
            "unit": "ms",
            "extra": "count: 13\nmax: 254\np95: 254\nmedian: 49"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48851.42,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 459,
            "unit": "ms",
            "extra": "count: 13\nmax: 459\np95: 459\nmedian: 45"
          }
        ]
      }
    ]
  }
}