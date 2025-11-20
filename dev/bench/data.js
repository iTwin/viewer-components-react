window.BENCHMARK_DATA = {
  "lastUpdate": 1763636969409,
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
          "id": "82986aeb2b5e10cb53912c9ddafed17be5b7f7ef",
          "message": "applying package updates",
          "timestamp": "2025-08-06T10:14:27Z",
          "tree_id": "bf7b1d060fb3a6bfccbddfb553a26642b5b115a1",
          "url": "https://github.com/iTwin/viewer-components-react/commit/82986aeb2b5e10cb53912c9ddafed17be5b7f7ef"
        },
        "date": 1754475830496,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2424.95,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1677,
            "unit": "ms",
            "extra": "count: 6\nmax: 1677\np95: 1677\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10101.51,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3655,
            "unit": "ms",
            "extra": "count: 19\nmax: 3655\np95: 3655\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7437.8,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4692,
            "unit": "ms",
            "extra": "count: 8\nmax: 4692\np95: 4692\nmedian: 54.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2256.18,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 356,
            "unit": "ms",
            "extra": "count: 10\nmax: 356\np95: 356\nmedian: 32.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15017.9,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4170,
            "unit": "ms",
            "extra": "count: 11\nmax: 4170\np95: 4170\nmedian: 60"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48475.84,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 285,
            "unit": "ms",
            "extra": "count: 13\nmax: 285\np95: 285\nmedian: 46"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47551.4,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 249,
            "unit": "ms",
            "extra": "count: 18\nmax: 249\np95: 249\nmedian: 35.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 47470.88,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 238,
            "unit": "ms",
            "extra": "count: 12\nmax: 238\np95: 238\nmedian: 47"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 47753.21,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 486,
            "unit": "ms",
            "extra": "count: 15\nmax: 486\np95: 486\nmedian: 63"
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
          "id": "481f02ca133c5cc43b058a881fc8ce7fa9daf0c4",
          "message": "[Tree widget]: Support custom tree node actions (#1395)\n\n* Add ability to render custom actions in Tree components\n\n* change\n\n* Update change/@itwin-tree-widget-react-c716863c-3bc7-4d61-8c40-789c56f2a818.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-08-06T16:27:46+03:00",
          "tree_id": "65ff7f733cbc9f9c6f8788719ead288a07402c9c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/481f02ca133c5cc43b058a881fc8ce7fa9daf0c4"
        },
        "date": 1754487460156,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2530.82,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1729,
            "unit": "ms",
            "extra": "count: 9\nmax: 1729\np95: 1729\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9454.45,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2744,
            "unit": "ms",
            "extra": "count: 17\nmax: 2744\np95: 2744\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6376.75,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3091,
            "unit": "ms",
            "extra": "count: 7\nmax: 3091\np95: 3091\nmedian: 56"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2235.42,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 163,
            "unit": "ms",
            "extra": "count: 11\nmax: 163\np95: 163\nmedian: 34"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 17390.98,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4134,
            "unit": "ms",
            "extra": "count: 10\nmax: 4134\np95: 4134\nmedian: 60"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51425.35,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 312,
            "unit": "ms",
            "extra": "count: 14\nmax: 312\np95: 312\nmedian: 33.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 51400,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 280,
            "unit": "ms",
            "extra": "count: 14\nmax: 280\np95: 280\nmedian: 56.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 51466.88,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 274,
            "unit": "ms",
            "extra": "count: 12\nmax: 274\np95: 274\nmedian: 53.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 52527.16,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 487,
            "unit": "ms",
            "extra": "count: 20\nmax: 487\np95: 487\nmedian: 34"
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
          "id": "44c526a05bed480f36cadaef52b023f1de0b284d",
          "message": "applying package updates",
          "timestamp": "2025-08-06T13:46:52Z",
          "tree_id": "a490f5c8a1f579ff58d72b46fcf3c75f51f4096c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/44c526a05bed480f36cadaef52b023f1de0b284d"
        },
        "date": 1754488576802,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2531.49,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1669,
            "unit": "ms",
            "extra": "count: 8\nmax: 1669\np95: 1669\nmedian: 35"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9514.55,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3190,
            "unit": "ms",
            "extra": "count: 17\nmax: 3190\np95: 3190\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6326.05,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3111,
            "unit": "ms",
            "extra": "count: 8\nmax: 3111\np95: 3111\nmedian: 53"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2216.81,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 296,
            "unit": "ms",
            "extra": "count: 9\nmax: 296\np95: 296\nmedian: 40"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15535.35,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4401,
            "unit": "ms",
            "extra": "count: 11\nmax: 4401\np95: 4401\nmedian: 53"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 45866.25,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 252,
            "unit": "ms",
            "extra": "count: 12\nmax: 252\np95: 252\nmedian: 33"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 46551.95,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 246,
            "unit": "ms",
            "extra": "count: 12\nmax: 246\np95: 246\nmedian: 48"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 46068.5,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 244,
            "unit": "ms",
            "extra": "count: 15\nmax: 244\np95: 244\nmedian: 30"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 46772.99,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 469,
            "unit": "ms",
            "extra": "count: 14\nmax: 469\np95: 469\nmedian: 36"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas",
            "username": "grigasp"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d9158a7f82f1c69be0e7913bc1d3bb2f435a5f10",
          "message": "Tree widget: Make model category elements query chunks smaller (#1396)\n\n* Make model-category-elements query chunks smaller (2900 -> 100)\n\n* change",
          "timestamp": "2025-08-07T12:16:42+03:00",
          "tree_id": "5d11dcae60e56a70e72e6c2729ccde11eac04bf9",
          "url": "https://github.com/iTwin/viewer-components-react/commit/d9158a7f82f1c69be0e7913bc1d3bb2f435a5f10"
        },
        "date": 1754558759239,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2378.31,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1664,
            "unit": "ms",
            "extra": "count: 7\nmax: 1664\np95: 1664\nmedian: 30"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10293.04,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3939,
            "unit": "ms",
            "extra": "count: 19\nmax: 3939\np95: 3939\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6586.62,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3585,
            "unit": "ms",
            "extra": "count: 9\nmax: 3585\np95: 3585\nmedian: 47"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2278.02,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 301,
            "unit": "ms",
            "extra": "count: 12\nmax: 301\np95: 301\nmedian: 37"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15972.23,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4061,
            "unit": "ms",
            "extra": "count: 9\nmax: 4061\np95: 4061\nmedian: 111"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47627.94,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 264,
            "unit": "ms",
            "extra": "count: 18\nmax: 264\np95: 264\nmedian: 31"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47020.22,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 250,
            "unit": "ms",
            "extra": "count: 12\nmax: 250\np95: 250\nmedian: 61.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 46524.38,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 247,
            "unit": "ms",
            "extra": "count: 12\nmax: 247\np95: 247\nmedian: 54"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48991.91,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 490,
            "unit": "ms",
            "extra": "count: 17\nmax: 490\np95: 490\nmedian: 34"
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
          "id": "0b54955dbcaa8e37e977ebd80ed4e72418514e6e",
          "message": "applying package updates",
          "timestamp": "2025-08-07T12:12:57Z",
          "tree_id": "f411a373ee74d7129700d62c62637b051bb73c19",
          "url": "https://github.com/iTwin/viewer-components-react/commit/0b54955dbcaa8e37e977ebd80ed4e72418514e6e"
        },
        "date": 1754569361564,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2408.11,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1684,
            "unit": "ms",
            "extra": "count: 5\nmax: 1684\np95: 1684\nmedian: 38"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10382.99,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3866,
            "unit": "ms",
            "extra": "count: 17\nmax: 3866\np95: 3866\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7408.29,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4255,
            "unit": "ms",
            "extra": "count: 10\nmax: 4255\np95: 4255\nmedian: 35.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2293.53,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 302,
            "unit": "ms",
            "extra": "count: 13\nmax: 302\np95: 302\nmedian: 34"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15973.31,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4320,
            "unit": "ms",
            "extra": "count: 16\nmax: 4320\np95: 4320\nmedian: 73.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49458.98,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 289,
            "unit": "ms",
            "extra": "count: 14\nmax: 289\np95: 289\nmedian: 41.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 51197.61,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 265,
            "unit": "ms",
            "extra": "count: 15\nmax: 265\np95: 265\nmedian: 39"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49706.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 392,
            "unit": "ms",
            "extra": "count: 12\nmax: 392\np95: 392\nmedian: 42"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 50487.15,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 493,
            "unit": "ms",
            "extra": "count: 17\nmax: 493\np95: 493\nmedian: 38"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas Petraitis",
            "username": "grigasp"
          },
          "committer": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas Petraitis",
            "username": "grigasp"
          },
          "distinct": true,
          "id": "067937bf5048479d756e6eb2c6ec335e6bef4468",
          "message": "Models tree: Stop unnecessarily executing an expensive model elements' count query, whose results we weren't even using",
          "timestamp": "2025-08-07T20:48:15+03:00",
          "tree_id": "71e56e46adf14f76a57f8577fc70c16209b28e5d",
          "url": "https://github.com/iTwin/viewer-components-react/commit/067937bf5048479d756e6eb2c6ec335e6bef4468"
        },
        "date": 1754589474761,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2554.9,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1668,
            "unit": "ms",
            "extra": "count: 8\nmax: 1668\np95: 1668\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9570.06,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3086,
            "unit": "ms",
            "extra": "count: 15\nmax: 3086\np95: 3086\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6751.21,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3515,
            "unit": "ms",
            "extra": "count: 8\nmax: 3515\np95: 3515\nmedian: 41.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2242.79,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 202,
            "unit": "ms",
            "extra": "count: 10\nmax: 202\np95: 202\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 14837.36,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4143,
            "unit": "ms",
            "extra": "count: 11\nmax: 4143\np95: 4143\nmedian: 65"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48817.1,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 287,
            "unit": "ms",
            "extra": "count: 14\nmax: 287\np95: 287\nmedian: 49.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 51044.54,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 275,
            "unit": "ms",
            "extra": "count: 12\nmax: 275\np95: 275\nmedian: 57"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48310.94,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 261,
            "unit": "ms",
            "extra": "count: 13\nmax: 261\np95: 261\nmedian: 43"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49452.75,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 472,
            "unit": "ms",
            "extra": "count: 15\nmax: 472\np95: 472\nmedian: 45"
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
          "id": "eb966b87278e99bee5b5273ab075a91785159e4a",
          "message": "applying package updates",
          "timestamp": "2025-08-07T18:43:06Z",
          "tree_id": "4c173e41bb319e1a8b4046886d52e6d65ff9bb69",
          "url": "https://github.com/iTwin/viewer-components-react/commit/eb966b87278e99bee5b5273ab075a91785159e4a"
        },
        "date": 1754592767107,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2553.03,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1659,
            "unit": "ms",
            "extra": "count: 10\nmax: 1659\np95: 1659\nmedian: 33"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10742.36,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4021,
            "unit": "ms",
            "extra": "count: 16\nmax: 4021\np95: 4021\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7081.46,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4401,
            "unit": "ms",
            "extra": "count: 7\nmax: 4401\np95: 4401\nmedian: 35"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2225.56,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 173,
            "unit": "ms",
            "extra": "count: 12\nmax: 173\np95: 173\nmedian: 33.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15355.21,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4176,
            "unit": "ms",
            "extra": "count: 11\nmax: 4176\np95: 4176\nmedian: 60"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50326.31,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 293,
            "unit": "ms",
            "extra": "count: 16\nmax: 293\np95: 293\nmedian: 31"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48735.48,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 273,
            "unit": "ms",
            "extra": "count: 13\nmax: 273\np95: 273\nmedian: 35"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49357.9,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 268,
            "unit": "ms",
            "extra": "count: 16\nmax: 268\np95: 268\nmedian: 30.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 53039.41,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 498,
            "unit": "ms",
            "extra": "count: 12\nmax: 498\np95: 498\nmedian: 63.5"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas",
            "username": "grigasp"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f2871a30c65e1c6fa31eedbae362620df73db5e7",
          "message": "Tree widget: Allow returning `undefined` paths from `getFilteredPaths` prop function (#1417)\n\n* Models tree: Don't filter the tree when `getFilteredPaths` returns `undefined`\n\n* Don't disable filtering button if `getFilteredPaths` is defined\n\n* Only apply matches highlighting on filter targets\n\n* prettier\n\n* fix tests\n\n* grouping nodes don't get `filteredChildrenIdentifierPaths` attribute - we still need to recurse into their children",
          "timestamp": "2025-08-21T13:21:12+03:00",
          "tree_id": "11dc8da965597ec990a8bed469488b7498d3d5fd",
          "url": "https://github.com/iTwin/viewer-components-react/commit/f2871a30c65e1c6fa31eedbae362620df73db5e7"
        },
        "date": 1755772288505,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2494.5,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1689,
            "unit": "ms",
            "extra": "count: 6\nmax: 1689\np95: 1689\nmedian: 33"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9940.55,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3391,
            "unit": "ms",
            "extra": "count: 17\nmax: 3391\np95: 3391\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6431.18,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3165,
            "unit": "ms",
            "extra": "count: 8\nmax: 3165\np95: 3165\nmedian: 55.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2269.22,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 145,
            "unit": "ms",
            "extra": "count: 11\nmax: 145\np95: 145\nmedian: 38"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16265.16,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4408,
            "unit": "ms",
            "extra": "count: 11\nmax: 4408\np95: 4408\nmedian: 659"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50096.99,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 293,
            "unit": "ms",
            "extra": "count: 14\nmax: 293\np95: 293\nmedian: 33"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50217.59,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 280,
            "unit": "ms",
            "extra": "count: 16\nmax: 280\np95: 280\nmedian: 37"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49953.15,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 283,
            "unit": "ms",
            "extra": "count: 12\nmax: 283\np95: 283\nmedian: 53.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 51232.78,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 495,
            "unit": "ms",
            "extra": "count: 14\nmax: 495\np95: 495\nmedian: 39"
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
          "id": "0fc3841be5af1109bdc48fc397ef6125e673ecfa",
          "message": "applying package updates",
          "timestamp": "2025-08-21T11:00:38Z",
          "tree_id": "f5dac11cd58f559977938727b1625d2885879df8",
          "url": "https://github.com/iTwin/viewer-components-react/commit/0fc3841be5af1109bdc48fc397ef6125e673ecfa"
        },
        "date": 1755774643358,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2540.59,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1708,
            "unit": "ms",
            "extra": "count: 6\nmax: 1708\np95: 1708\nmedian: 35"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9110.9,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2572,
            "unit": "ms",
            "extra": "count: 18\nmax: 2572\np95: 2572\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7006.21,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3721,
            "unit": "ms",
            "extra": "count: 8\nmax: 3721\np95: 3721\nmedian: 43"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2301.14,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 307,
            "unit": "ms",
            "extra": "count: 14\nmax: 307\np95: 307\nmedian: 36"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15655.34,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4198,
            "unit": "ms",
            "extra": "count: 11\nmax: 4198\np95: 4198\nmedian: 71"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51017.23,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 274,
            "unit": "ms",
            "extra": "count: 15\nmax: 274\np95: 274\nmedian: 35"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50829.47,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 371,
            "unit": "ms",
            "extra": "count: 12\nmax: 371\np95: 371\nmedian: 38.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 50646.54,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 269,
            "unit": "ms",
            "extra": "count: 16\nmax: 269\np95: 269\nmedian: 33"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 51199.66,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 498,
            "unit": "ms",
            "extra": "count: 16\nmax: 498\np95: 498\nmedian: 37"
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
          "id": "269adae6c9d1949d651eb1341b29bf594f6bfc66",
          "message": "[Tree widget]: Preserve non-filtered tree ids cache (#1431)\n\n* Preserve models and categories tree cache on filter change.\n\n* Add changeset\n\n* Fix lint problems\n\n* Fix act warning",
          "timestamp": "2025-08-28T21:13:16+03:00",
          "tree_id": "32423fc4eda20060b38be8ce7d4f690726ba7502",
          "url": "https://github.com/iTwin/viewer-components-react/commit/269adae6c9d1949d651eb1341b29bf594f6bfc66"
        },
        "date": 1756405435871,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2531.87,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1708,
            "unit": "ms",
            "extra": "count: 6\nmax: 1708\np95: 1708\nmedian: 30.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 11019.25,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4011,
            "unit": "ms",
            "extra": "count: 15\nmax: 4011\np95: 4011\nmedian: 34"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6777.88,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3329,
            "unit": "ms",
            "extra": "count: 9\nmax: 3329\np95: 3329\nmedian: 33"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2377.49,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 302,
            "unit": "ms",
            "extra": "count: 14\nmax: 302\np95: 302\nmedian: 31"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15651.32,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4230,
            "unit": "ms",
            "extra": "count: 11\nmax: 4230\np95: 4230\nmedian: 80"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 53265.32,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 302,
            "unit": "ms",
            "extra": "count: 11\nmax: 302\np95: 302\nmedian: 48"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 53569.8,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 289,
            "unit": "ms",
            "extra": "count: 12\nmax: 289\np95: 289\nmedian: 60"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 53107.66,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 301,
            "unit": "ms",
            "extra": "count: 13\nmax: 301\np95: 301\nmedian: 34"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 53839.71,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 511,
            "unit": "ms",
            "extra": "count: 18\nmax: 511\np95: 511\nmedian: 41"
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
          "id": "4157251f07410906294b18d74b090246b9dff370",
          "message": "applying package updates",
          "timestamp": "2025-08-28T19:47:46Z",
          "tree_id": "cca201d75f89dd2b7b207b15acdaff2a854ac5d6",
          "url": "https://github.com/iTwin/viewer-components-react/commit/4157251f07410906294b18d74b090246b9dff370"
        },
        "date": 1756411062345,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2558.78,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1719,
            "unit": "ms",
            "extra": "count: 9\nmax: 1719\np95: 1719\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10403.21,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3627,
            "unit": "ms",
            "extra": "count: 18\nmax: 3627\np95: 3627\nmedian: 33.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6924.38,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3575,
            "unit": "ms",
            "extra": "count: 8\nmax: 3575\np95: 3575\nmedian: 45.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2298.36,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 304,
            "unit": "ms",
            "extra": "count: 14\nmax: 304\np95: 304\nmedian: 31.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15595.63,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4276,
            "unit": "ms",
            "extra": "count: 10\nmax: 4276\np95: 4276\nmedian: 425.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48890.84,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 263,
            "unit": "ms",
            "extra": "count: 13\nmax: 263\np95: 263\nmedian: 61"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50146.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 278,
            "unit": "ms",
            "extra": "count: 13\nmax: 278\np95: 278\nmedian: 33"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48778.14,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 256,
            "unit": "ms",
            "extra": "count: 15\nmax: 256\np95: 256\nmedian: 35"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 47584.54,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 474,
            "unit": "ms",
            "extra": "count: 15\nmax: 474\np95: 474\nmedian: 34"
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
          "id": "ab5578d906f30883327aca85593bdc80db814fab",
          "message": "Add cspell to CI (#1435)\n\n* Add cspell\n\n* Add maplayers to cspell words\n\n* Add changesets",
          "timestamp": "2025-09-02T14:31:57+03:00",
          "tree_id": "6be96b7602b6901190577c00b25a32c99401383b",
          "url": "https://github.com/iTwin/viewer-components-react/commit/ab5578d906f30883327aca85593bdc80db814fab"
        },
        "date": 1756813355375,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2567.46,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1738,
            "unit": "ms",
            "extra": "count: 9\nmax: 1738\np95: 1738\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 11065.28,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4143,
            "unit": "ms",
            "extra": "count: 17\nmax: 4143\np95: 4143\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7401.37,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3973,
            "unit": "ms",
            "extra": "count: 10\nmax: 3973\np95: 3973\nmedian: 32.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2369.47,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 304,
            "unit": "ms",
            "extra": "count: 13\nmax: 304\np95: 304\nmedian: 30"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16059.18,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4270,
            "unit": "ms",
            "extra": "count: 11\nmax: 4270\np95: 4270\nmedian: 72"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 52444.19,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 423,
            "unit": "ms",
            "extra": "count: 14\nmax: 423\np95: 423\nmedian: 40"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 52559.7,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 291,
            "unit": "ms",
            "extra": "count: 15\nmax: 291\np95: 291\nmedian: 35"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 52637.42,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 280,
            "unit": "ms",
            "extra": "count: 13\nmax: 280\np95: 280\nmedian: 38"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 52263.12,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 510,
            "unit": "ms",
            "extra": "count: 12\nmax: 510\np95: 510\nmedian: 47"
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
          "id": "928c52eefbb504eb05918754ded635dfdae6d315",
          "message": "applying package updates",
          "timestamp": "2025-09-02T13:55:23Z",
          "tree_id": "ef40b8b530cbcbace3a03a36d6c1676aed9b9898",
          "url": "https://github.com/iTwin/viewer-components-react/commit/928c52eefbb504eb05918754ded635dfdae6d315"
        },
        "date": 1756821917146,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2555.95,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1690,
            "unit": "ms",
            "extra": "count: 8\nmax: 1690\np95: 1690\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9334.14,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2826,
            "unit": "ms",
            "extra": "count: 18\nmax: 2826\np95: 2826\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6266.28,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2975,
            "unit": "ms",
            "extra": "count: 8\nmax: 2975\np95: 2975\nmedian: 57.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2207.25,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 289,
            "unit": "ms",
            "extra": "count: 10\nmax: 289\np95: 289\nmedian: 32"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15126.53,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4127,
            "unit": "ms",
            "extra": "count: 11\nmax: 4127\np95: 4127\nmedian: 61"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49256.19,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 283,
            "unit": "ms",
            "extra": "count: 14\nmax: 283\np95: 283\nmedian: 34.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49369.5,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 256,
            "unit": "ms",
            "extra": "count: 15\nmax: 256\np95: 256\nmedian: 42"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49592.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 247,
            "unit": "ms",
            "extra": "count: 18\nmax: 247\np95: 247\nmedian: 30.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 50848.53,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 489,
            "unit": "ms",
            "extra": "count: 12\nmax: 489\np95: 489\nmedian: 49"
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
          "id": "f6de2da24ad79161b33a3fbbe632a942a68fcf43",
          "message": "[Tree widget]: Fix child element visibility problem in models tree (#1452)\n\n* Fix child element visibility problem\n\n* Adjust test name\n\n* Run prettier\n\n* Update change/@itwin-tree-widget-react-19ac682c-463b-4c62-b5cf-f36a1606bda6.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Apply suggestions\n\n* Fix rename issue\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-09-15T17:49:00+03:00",
          "tree_id": "793e38ec9ef0f63c49b383ada47e5f6484c54e2b",
          "url": "https://github.com/iTwin/viewer-components-react/commit/f6de2da24ad79161b33a3fbbe632a942a68fcf43"
        },
        "date": 1757948682739,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2500.4,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1676,
            "unit": "ms",
            "extra": "count: 6\nmax: 1676\np95: 1676\nmedian: 67"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 8864.03,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2545,
            "unit": "ms",
            "extra": "count: 15\nmax: 2545\np95: 2545\nmedian: 29"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6233.66,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3013,
            "unit": "ms",
            "extra": "count: 7\nmax: 3013\np95: 3013\nmedian: 48"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2255.88,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 330,
            "unit": "ms",
            "extra": "count: 9\nmax: 330\np95: 330\nmedian: 37"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 15743.45,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 3817,
            "unit": "ms",
            "extra": "count: 10\nmax: 3817\np95: 3817\nmedian: 47"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 46751.48,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 275,
            "unit": "ms",
            "extra": "count: 14\nmax: 275\np95: 275\nmedian: 38.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47221.83,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 258,
            "unit": "ms",
            "extra": "count: 12\nmax: 258\np95: 258\nmedian: 32.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 46555.25,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 239,
            "unit": "ms",
            "extra": "count: 14\nmax: 239\np95: 239\nmedian: 49.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 47382.72,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 563,
            "unit": "ms",
            "extra": "count: 13\nmax: 563\np95: 563\nmedian: 47"
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
          "id": "44c679e3eaea98d771a40868ebb42875a4dd4cbf",
          "message": "[Tree-widget]: Fix AlwaysDrawn query being executed too often (#1439)\n\n* Add cspell\n\n* Add maplayers to cspell words\n\n* Add changesets\n\n* Try fix always never draw requerying\n\n* Update test\n\n* Add exports\n\n* Apply changes\n\n* Add changeset\n\n* Fix tests and remove exports\n\n* Apply suggestion for changeset\n\n* Remove .only from test\n\n* Fix issues\n\n* Remove unused import\n\n* Remove #suppressionCount",
          "timestamp": "2025-09-16T12:52:22+03:00",
          "tree_id": "d628d95e3a06add9a8dc0f618fd5a68fbdbdae20",
          "url": "https://github.com/iTwin/viewer-components-react/commit/44c679e3eaea98d771a40868ebb42875a4dd4cbf"
        },
        "date": 1758016931234,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2424.1,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1700,
            "unit": "ms",
            "extra": "count: 7\nmax: 1700\np95: 1700\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10008.33,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3531,
            "unit": "ms",
            "extra": "count: 16\nmax: 3531\np95: 3531\nmedian: 29.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7622.59,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4934,
            "unit": "ms",
            "extra": "count: 7\nmax: 4934\np95: 4934\nmedian: 46"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2230.13,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 252,
            "unit": "ms",
            "extra": "count: 12\nmax: 252\np95: 252\nmedian: 31.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 17310.24,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 5412,
            "unit": "ms",
            "extra": "count: 12\nmax: 5412\np95: 5412\nmedian: 64"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49953.47,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 273,
            "unit": "ms",
            "extra": "count: 15\nmax: 273\np95: 273\nmedian: 33"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49893.33,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 284,
            "unit": "ms",
            "extra": "count: 18\nmax: 284\np95: 284\nmedian: 45"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 50666.28,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 275,
            "unit": "ms",
            "extra": "count: 15\nmax: 275\np95: 275\nmedian: 40"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 51188.77,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 495,
            "unit": "ms",
            "extra": "count: 14\nmax: 495\np95: 495\nmedian: 34"
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
          "id": "e8b44ff5a9fd5a44294afcb251517d6a88ea4d2f",
          "message": "applying package updates",
          "timestamp": "2025-09-16T11:13:44Z",
          "tree_id": "48cc5be63dae71e0ee211bb68ef12a8c97fe0cef",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e8b44ff5a9fd5a44294afcb251517d6a88ea4d2f"
        },
        "date": 1758021801627,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2523.11,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1670,
            "unit": "ms",
            "extra": "count: 6\nmax: 1670\np95: 1670\nmedian: 69.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9032.29,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 727,
            "unit": "ms",
            "extra": "count: 22\nmax: 2564\np95: 727\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6099.02,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2897,
            "unit": "ms",
            "extra": "count: 9\nmax: 2897\np95: 2897\nmedian: 33"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2259.31,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 294,
            "unit": "ms",
            "extra": "count: 12\nmax: 294\np95: 294\nmedian: 36"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16418.84,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 4654,
            "unit": "ms",
            "extra": "count: 12\nmax: 4654\np95: 4654\nmedian: 47.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47756.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 266,
            "unit": "ms",
            "extra": "count: 14\nmax: 266\np95: 266\nmedian: 35.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49655.08,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 272,
            "unit": "ms",
            "extra": "count: 12\nmax: 272\np95: 272\nmedian: 40"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48214.3,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 257,
            "unit": "ms",
            "extra": "count: 17\nmax: 257\np95: 257\nmedian: 39"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48603.3,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 478,
            "unit": "ms",
            "extra": "count: 18\nmax: 478\np95: 478\nmedian: 41.5"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas",
            "username": "grigasp"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "98475bec25818d5e9f2d912032d6f74c9fd4c1e2",
          "message": "Tree widget: Add \"loading\" state to `TreeNodeCheckboxState` type (#1458)",
          "timestamp": "2025-09-24T09:50:44+03:00",
          "tree_id": "80de863caadc35b7227656fd8758f0e21c49ad48",
          "url": "https://github.com/iTwin/viewer-components-react/commit/98475bec25818d5e9f2d912032d6f74c9fd4c1e2"
        },
        "date": 1758697240443,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2376.32,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1693,
            "unit": "ms",
            "extra": "count: 7\nmax: 1693\np95: 1693\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10188.03,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3912,
            "unit": "ms",
            "extra": "count: 17\nmax: 3912\np95: 3912\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6815.96,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3722,
            "unit": "ms",
            "extra": "count: 9\nmax: 3722\np95: 3722\nmedian: 53"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2297.2,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 213,
            "unit": "ms",
            "extra": "count: 10\nmax: 213\np95: 213\nmedian: 32.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 16630.37,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 5100,
            "unit": "ms",
            "extra": "count: 10\nmax: 5100\np95: 5100\nmedian: 388"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48372.17,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 274,
            "unit": "ms",
            "extra": "count: 14\nmax: 274\np95: 274\nmedian: 35.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48534.85,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 266,
            "unit": "ms",
            "extra": "count: 16\nmax: 266\np95: 266\nmedian: 38"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48517.74,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 265,
            "unit": "ms",
            "extra": "count: 15\nmax: 265\np95: 265\nmedian: 37"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49134.46,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 464,
            "unit": "ms",
            "extra": "count: 14\nmax: 464\np95: 464\nmedian: 37.5"
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
          "id": "90a099db2f8e5db9771f93c6babb100d7b11e3a7",
          "message": "Fix model visibility not loading (#1461)",
          "timestamp": "2025-09-24T11:53:30Z",
          "tree_id": "aee2a084f140469bccdca80d5dae65a851ad03d1",
          "url": "https://github.com/iTwin/viewer-components-react/commit/90a099db2f8e5db9771f93c6babb100d7b11e3a7"
        },
        "date": 1758715414943,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2580.03,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1663,
            "unit": "ms",
            "extra": "count: 9\nmax: 1663\np95: 1663\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10808.3,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4152,
            "unit": "ms",
            "extra": "count: 17\nmax: 4152\np95: 4152\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6368.76,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3069,
            "unit": "ms",
            "extra": "count: 8\nmax: 3069\np95: 3069\nmedian: 57.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2202.46,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 214,
            "unit": "ms",
            "extra": "count: 13\nmax: 214\np95: 214\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 19591.39,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6365,
            "unit": "ms",
            "extra": "count: 13\nmax: 6365\np95: 6365\nmedian: 34"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49682.05,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 273,
            "unit": "ms",
            "extra": "count: 13\nmax: 273\np95: 273\nmedian: 34"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49347.16,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 272,
            "unit": "ms",
            "extra": "count: 12\nmax: 272\np95: 272\nmedian: 52.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49332.13,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 269,
            "unit": "ms",
            "extra": "count: 13\nmax: 269\np95: 269\nmedian: 34"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49929.62,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 485,
            "unit": "ms",
            "extra": "count: 16\nmax: 485\np95: 485\nmedian: 35"
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
          "id": "2ebfb498e79d48a468585ffd2438a5117096d0c9",
          "message": "[Tree widget]: Reduce models tree visibility icon flickering (#1462)\n\n* Adjust how event handler fires events\n\n* Move check to a different place\n\n* Undo comment\n\n* Add internal tag\n\n* Fix issues\n\n* Revert some changes\n\n* Fix problems\n\n* Apply suggestions\n\n* Try to fix no elements in sequence issue",
          "timestamp": "2025-09-30T16:33:39+03:00",
          "tree_id": "b3335c695ab01f161eb680eaa825813ffae5fea0",
          "url": "https://github.com/iTwin/viewer-components-react/commit/2ebfb498e79d48a468585ffd2438a5117096d0c9"
        },
        "date": 1759239803069,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2520.08,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1697,
            "unit": "ms",
            "extra": "count: 8\nmax: 1697\np95: 1697\nmedian: 30.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9633.38,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3174,
            "unit": "ms",
            "extra": "count: 18\nmax: 3174\np95: 3174\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6200.21,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2928,
            "unit": "ms",
            "extra": "count: 7\nmax: 2928\np95: 2928\nmedian: 62"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2260.34,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 299,
            "unit": "ms",
            "extra": "count: 11\nmax: 299\np95: 299\nmedian: 35"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 19272.28,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6295,
            "unit": "ms",
            "extra": "count: 14\nmax: 6295\np95: 6295\nmedian: 51"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49167.81,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 272,
            "unit": "ms",
            "extra": "count: 15\nmax: 272\np95: 272\nmedian: 47"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49881.58,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 264,
            "unit": "ms",
            "extra": "count: 13\nmax: 264\np95: 264\nmedian: 35"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49125.84,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 270,
            "unit": "ms",
            "extra": "count: 17\nmax: 270\np95: 270\nmedian: 38"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49955.99,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 487,
            "unit": "ms",
            "extra": "count: 18\nmax: 487\np95: 487\nmedian: 33"
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
          "id": "e8ded234bb1e93765233a7a4b0db42b618d11fae",
          "message": "applying package updates",
          "timestamp": "2025-10-03T11:22:06Z",
          "tree_id": "ef8a92c4140bf7d239950d9a3e877f1bf9b1dcea",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e8ded234bb1e93765233a7a4b0db42b618d11fae"
        },
        "date": 1759491120148,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2559.09,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1683,
            "unit": "ms",
            "extra": "count: 8\nmax: 1683\np95: 1683\nmedian: 35.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9077.43,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2610,
            "unit": "ms",
            "extra": "count: 19\nmax: 2610\np95: 2610\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6706.47,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3435,
            "unit": "ms",
            "extra": "count: 8\nmax: 3435\np95: 3435\nmedian: 44"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2253.3,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 299,
            "unit": "ms",
            "extra": "count: 8\nmax: 299\np95: 299\nmedian: 41"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 19110.7,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6280,
            "unit": "ms",
            "extra": "count: 13\nmax: 6280\np95: 6280\nmedian: 74"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48705.44,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 269,
            "unit": "ms",
            "extra": "count: 13\nmax: 269\np95: 269\nmedian: 46"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48868.97,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 261,
            "unit": "ms",
            "extra": "count: 9\nmax: 261\np95: 261\nmedian: 75"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49572.05,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 262,
            "unit": "ms",
            "extra": "count: 16\nmax: 262\np95: 262\nmedian: 31.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49240.68,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 474,
            "unit": "ms",
            "extra": "count: 16\nmax: 474\np95: 474\nmedian: 34.5"
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
          "id": "8680dc341dc9c97890bfc5171a409ab7a12ad5c7",
          "message": "applying package updates",
          "timestamp": "2025-10-07T08:45:30Z",
          "tree_id": "5e8a02d9f358752a8c86049de812ff75242115d0",
          "url": "https://github.com/iTwin/viewer-components-react/commit/8680dc341dc9c97890bfc5171a409ab7a12ad5c7"
        },
        "date": 1759827323999,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2512.7,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1665,
            "unit": "ms",
            "extra": "count: 6\nmax: 1665\np95: 1665\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10981,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4301,
            "unit": "ms",
            "extra": "count: 17\nmax: 4301\np95: 4301\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6975.83,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3740,
            "unit": "ms",
            "extra": "count: 9\nmax: 3740\np95: 3740\nmedian: 57"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2205.92,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 99,
            "unit": "ms",
            "extra": "count: 12\nmax: 99\np95: 99\nmedian: 29.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 19870.07,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6737,
            "unit": "ms",
            "extra": "count: 14\nmax: 6737\np95: 6737\nmedian: 55"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49743.59,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 278,
            "unit": "ms",
            "extra": "count: 14\nmax: 278\np95: 278\nmedian: 46"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50648.88,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 270,
            "unit": "ms",
            "extra": "count: 14\nmax: 270\np95: 270\nmedian: 50.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 48123.4,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 250,
            "unit": "ms",
            "extra": "count: 15\nmax: 250\np95: 250\nmedian: 32"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48609.92,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 489,
            "unit": "ms",
            "extra": "count: 13\nmax: 489\np95: 489\nmedian: 63"
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
          "id": "e0bd80a5ed0db4bfbff66aa998dafee771fd9745",
          "message": "[Tree widget]: Fix visibility tests (#1468)\n\n* Fix visibility tests\n\n* Add import back",
          "timestamp": "2025-10-07T21:07:33+03:00",
          "tree_id": "28d8470f264afa11448d839ceea0319199d73ead",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e0bd80a5ed0db4bfbff66aa998dafee771fd9745"
        },
        "date": 1759861047453,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2543.96,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1673,
            "unit": "ms",
            "extra": "count: 8\nmax: 1673\np95: 1673\nmedian: 30.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9437.42,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2644,
            "unit": "ms",
            "extra": "count: 19\nmax: 2644\np95: 2644\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6947.24,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3715,
            "unit": "ms",
            "extra": "count: 7\nmax: 3715\np95: 3715\nmedian: 64"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2237.76,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 343,
            "unit": "ms",
            "extra": "count: 11\nmax: 343\np95: 343\nmedian: 42"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 18852.43,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 5889,
            "unit": "ms",
            "extra": "count: 11\nmax: 5889\np95: 5889\nmedian: 847"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48145.26,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 261,
            "unit": "ms",
            "extra": "count: 19\nmax: 261\np95: 261\nmedian: 30"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47570.5,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 242,
            "unit": "ms",
            "extra": "count: 17\nmax: 242\np95: 242\nmedian: 32"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 46673.08,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 242,
            "unit": "ms",
            "extra": "count: 13\nmax: 242\np95: 242\nmedian: 30"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 47461.01,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 468,
            "unit": "ms",
            "extra": "count: 15\nmax: 468\np95: 468\nmedian: 36"
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
          "id": "b04345408875fe8747296c0902ed5fdecbd7c22b",
          "message": "[Tree widget]: Prerequisite for children visibility changes (#1472)\n\n* Prerequisite for children visibility changes\n\n* Cleanup\n\n* Prettier\n\n* Change getVisibilityChangeTargets to accept node\n\n* Fix isFiltered to hasDirectNonFilteredTargets\n\n* Prettier\n\n* Apply suggestion\n\n* Add back getElementDisplayStatus\n\n* Address comments\n\n* Change filtered tree to accept correct nodes\n\n* Fix lint issues",
          "timestamp": "2025-10-10T15:10:15+03:00",
          "tree_id": "245ecbdf3007eea6760d6d9103a293217f898f45",
          "url": "https://github.com/iTwin/viewer-components-react/commit/b04345408875fe8747296c0902ed5fdecbd7c22b"
        },
        "date": 1760098830026,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2627.16,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1725,
            "unit": "ms",
            "extra": "count: 7\nmax: 1725\np95: 1725\nmedian: 40"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10031.99,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3309,
            "unit": "ms",
            "extra": "count: 17\nmax: 3309\np95: 3309\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7555.14,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4160,
            "unit": "ms",
            "extra": "count: 9\nmax: 4160\np95: 4160\nmedian: 33"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2285.56,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 299,
            "unit": "ms",
            "extra": "count: 11\nmax: 299\np95: 299\nmedian: 32"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 20004.14,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6795,
            "unit": "ms",
            "extra": "count: 12\nmax: 6795\np95: 6795\nmedian: 415.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51500.01,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 304,
            "unit": "ms",
            "extra": "count: 13\nmax: 304\np95: 304\nmedian: 59"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50964.45,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 276,
            "unit": "ms",
            "extra": "count: 13\nmax: 276\np95: 276\nmedian: 72"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 52143.72,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 282,
            "unit": "ms",
            "extra": "count: 13\nmax: 282\np95: 282\nmedian: 32"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 53085.74,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 491,
            "unit": "ms",
            "extra": "count: 16\nmax: 491\np95: 491\nmedian: 32.5"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas",
            "username": "grigasp"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "5ce3b8b2a99667d9085a009bf1ab852285d72edb",
          "message": "Test viewer: Update dependencies (#1475)\n\n* Update test viewer's deps (core, presentation. itwinui)\n\n* fix click position in `shows outlines when focused using keyboard` test",
          "timestamp": "2025-10-13T10:15:21Z",
          "tree_id": "0a388bd2917bbdf7ffc13efb602acb909ce52dee",
          "url": "https://github.com/iTwin/viewer-components-react/commit/5ce3b8b2a99667d9085a009bf1ab852285d72edb"
        },
        "date": 1760351094889,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2486.06,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1711,
            "unit": "ms",
            "extra": "count: 7\nmax: 1711\np95: 1711\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9425.32,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3083,
            "unit": "ms",
            "extra": "count: 17\nmax: 3083\np95: 3083\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6663.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3412,
            "unit": "ms",
            "extra": "count: 9\nmax: 3412\np95: 3412\nmedian: 56"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2192.65,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 213,
            "unit": "ms",
            "extra": "count: 9\nmax: 213\np95: 213\nmedian: 32"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 19028.06,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6614,
            "unit": "ms",
            "extra": "count: 12\nmax: 6614\np95: 6614\nmedian: 392"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47467.42,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 366,
            "unit": "ms",
            "extra": "count: 13\nmax: 366\np95: 366\nmedian: 35"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47453.47,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 267,
            "unit": "ms",
            "extra": "count: 15\nmax: 267\np95: 267\nmedian: 41"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 47254.24,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 254,
            "unit": "ms",
            "extra": "count: 16\nmax: 254\np95: 254\nmedian: 38"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48056.59,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 474,
            "unit": "ms",
            "extra": "count: 14\nmax: 474\np95: 474\nmedian: 47.5"
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
          "id": "fac613d3a61eb742f4691c1e79d035565b4b5636",
          "message": "applying package updates",
          "timestamp": "2025-10-13T14:06:11Z",
          "tree_id": "7266b22cff246345030430cb72a23f64fef64180",
          "url": "https://github.com/iTwin/viewer-components-react/commit/fac613d3a61eb742f4691c1e79d035565b4b5636"
        },
        "date": 1760364959274,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2454.82,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1689,
            "unit": "ms",
            "extra": "count: 7\nmax: 1689\np95: 1689\nmedian: 34"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10084.58,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3697,
            "unit": "ms",
            "extra": "count: 19\nmax: 3697\np95: 3697\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7093.51,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3921,
            "unit": "ms",
            "extra": "count: 5\nmax: 3921\np95: 3921\nmedian: 529"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2264.72,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 295,
            "unit": "ms",
            "extra": "count: 13\nmax: 295\np95: 295\nmedian: 37"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 18977.1,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6522,
            "unit": "ms",
            "extra": "count: 11\nmax: 6522\np95: 6522\nmedian: 718"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 48942.89,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 295,
            "unit": "ms",
            "extra": "count: 11\nmax: 295\np95: 295\nmedian: 36"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 48042.19,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 273,
            "unit": "ms",
            "extra": "count: 14\nmax: 273\np95: 273\nmedian: 48.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 47152.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 372,
            "unit": "ms",
            "extra": "count: 14\nmax: 372\np95: 372\nmedian: 32.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 48641.75,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 475,
            "unit": "ms",
            "extra": "count: 19\nmax: 475\np95: 475\nmedian: 38"
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
          "id": "d14f5282b9b47591fc49a29ac3eb0403277eb390",
          "message": "[Tree widget]: Prerequisite for children visibility changes pt.2 (#1473)\n\n* Change always never drawn element info to store children tree\n\n* Fix test problems\n\n* Fix cspell problem\n\n* Resolve comments\n\n* Address comments\n\n* Update comment\n\n* Address comments\n\n* Run prettier\n\n* Apply suggestions\n\n* Fix import",
          "timestamp": "2025-10-14T13:04:42Z",
          "tree_id": "81d17dd444c3587f00d53f12e356a26955a6ec3c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/d14f5282b9b47591fc49a29ac3eb0403277eb390"
        },
        "date": 1760447689586,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2429.93,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1670,
            "unit": "ms",
            "extra": "count: 7\nmax: 1670\np95: 1670\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9657.03,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3323,
            "unit": "ms",
            "extra": "count: 17\nmax: 3323\np95: 3323\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6688.94,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3502,
            "unit": "ms",
            "extra": "count: 9\nmax: 3502\np95: 3502\nmedian: 56"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2269.64,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 349,
            "unit": "ms",
            "extra": "count: 11\nmax: 349\np95: 349\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 18597.6,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 5853,
            "unit": "ms",
            "extra": "count: 12\nmax: 5853\np95: 5853\nmedian: 430"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47911.37,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 278,
            "unit": "ms",
            "extra": "count: 18\nmax: 278\np95: 278\nmedian: 40.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 51957.85,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 384,
            "unit": "ms",
            "extra": "count: 12\nmax: 384\np95: 384\nmedian: 40"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 52132.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 284,
            "unit": "ms",
            "extra": "count: 15\nmax: 284\np95: 284\nmedian: 31"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 53757.81,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 521,
            "unit": "ms",
            "extra": "count: 24\nmax: 655\np95: 521\nmedian: 34.5"
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
          "id": "63cb59418fc98739c5f95c440157ff457636aec6",
          "message": "[Tree widget & Property grid]: Replace `_` usage with `#` (#1476)\n\n* Replace `_` usage with `#`\n\n* Fix missed files",
          "timestamp": "2025-10-15T09:35:30+03:00",
          "tree_id": "4304dc50b59d708503b47bff0efd8105f0fd6314",
          "url": "https://github.com/iTwin/viewer-components-react/commit/63cb59418fc98739c5f95c440157ff457636aec6"
        },
        "date": 1760510755949,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2464.04,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1703,
            "unit": "ms",
            "extra": "count: 4\nmax: 1703\np95: 1703\nmedian: 151.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10114.97,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3412,
            "unit": "ms",
            "extra": "count: 19\nmax: 3412\np95: 3412\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7466.71,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4097,
            "unit": "ms",
            "extra": "count: 9\nmax: 4097\np95: 4097\nmedian: 57"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2309.54,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 290,
            "unit": "ms",
            "extra": "count: 15\nmax: 290\np95: 290\nmedian: 46"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 20185.38,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6271,
            "unit": "ms",
            "extra": "count: 12\nmax: 6271\np95: 6271\nmedian: 416.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51081.92,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 310,
            "unit": "ms",
            "extra": "count: 16\nmax: 310\np95: 310\nmedian: 35"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 51521.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 292,
            "unit": "ms",
            "extra": "count: 15\nmax: 292\np95: 292\nmedian: 39"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49355.14,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 271,
            "unit": "ms",
            "extra": "count: 12\nmax: 271\np95: 271\nmedian: 45.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 51195.87,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 1121,
            "unit": "ms",
            "extra": "count: 19\nmax: 1121\np95: 1121\nmedian: 38"
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
          "id": "9195eabf5029dd473682bba04a4c7a7bf2648c69",
          "message": "[Tree widget]: Fix restart token cancelling queries (#1478)\n\n* Fix restart token cancelling queries\n\n* prettier\n\n* Add componentId to executed queries\n\n* Add buffer number\n\n* Fix import order\n\n* add componentId to useCategoriesTreeButtonProps\n\n* Address comments\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/external-sources-tree/ExternalSourcesTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Address comments\n\n* Add comments\n\n* Update presentation packages versions\n\n* Add changeset\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-10-17T09:04:04-04:00",
          "tree_id": "d9b244a388e910863ec3ab79f0adc5dcee7a7851",
          "url": "https://github.com/iTwin/viewer-components-react/commit/9195eabf5029dd473682bba04a4c7a7bf2648c69"
        },
        "date": 1760706930871,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2503.15,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1769,
            "unit": "ms",
            "extra": "count: 6\nmax: 1769\np95: 1769\nmedian: 36.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 13905.45,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 760,
            "unit": "ms",
            "extra": "count: 35\nmax: 2690\np95: 760\nmedian: 63"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6877.27,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3762,
            "unit": "ms",
            "extra": "count: 9\nmax: 3762\np95: 3762\nmedian: 51"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2383.43,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 240,
            "unit": "ms",
            "extra": "count: 17\nmax: 240\np95: 240\nmedian: 39"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 22903.09,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6605,
            "unit": "ms",
            "extra": "count: 15\nmax: 6605\np95: 6605\nmedian: 40"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 60396.04,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 145,
            "unit": "ms",
            "extra": "count: 26\nmax: 336\np95: 145\nmedian: 41.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 57369.4,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 155,
            "unit": "ms",
            "extra": "count: 22\nmax: 324\np95: 155\nmedian: 63"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 57459.31,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 152,
            "unit": "ms",
            "extra": "count: 23\nmax: 325\np95: 152\nmedian: 59"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 61125.01,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 283,
            "unit": "ms",
            "extra": "count: 30\nmax: 1136\np95: 283\nmedian: 52"
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
          "id": "e2338988197f6d82b0d626d07a93c9a290208bde",
          "message": "[Tree widget & Property grid]: Bump versions of presentation packages (#1480)\n\n* Bump versions of presentation packages\n\n* Add changeset\n\n* Provide different component id when requesting sub tree paths",
          "timestamp": "2025-10-17T15:13:58Z",
          "tree_id": "cf9850398fdc9de3f000f17fe0f541b1810fc279",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e2338988197f6d82b0d626d07a93c9a290208bde"
        },
        "date": 1760714612370,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2360.12,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1669,
            "unit": "ms",
            "extra": "count: 6\nmax: 1669\np95: 1669\nmedian: 30.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9614.77,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3311,
            "unit": "ms",
            "extra": "count: 20\nmax: 3311\np95: 3311\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6166.46,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2967,
            "unit": "ms",
            "extra": "count: 9\nmax: 2967\np95: 2967\nmedian: 49"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2233.64,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 328,
            "unit": "ms",
            "extra": "count: 12\nmax: 328\np95: 328\nmedian: 36.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 18815.19,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 5871,
            "unit": "ms",
            "extra": "count: 11\nmax: 5871\np95: 5871\nmedian: 827"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 47211.33,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 268,
            "unit": "ms",
            "extra": "count: 14\nmax: 268\np95: 268\nmedian: 62"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 47109.94,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 266,
            "unit": "ms",
            "extra": "count: 12\nmax: 266\np95: 266\nmedian: 33"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 47099.11,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 378,
            "unit": "ms",
            "extra": "count: 14\nmax: 378\np95: 378\nmedian: 30"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 49006.82,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 1240,
            "unit": "ms",
            "extra": "count: 20\nmax: 1240\np95: 1240\nmedian: 36"
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
          "id": "ca3c258dd650134355430ffe58430c0a551b45f7",
          "message": "applying package updates",
          "timestamp": "2025-10-17T15:36:01Z",
          "tree_id": "2040fc98b8d1e49cac28bc0e8f82629fed490cb7",
          "url": "https://github.com/iTwin/viewer-components-react/commit/ca3c258dd650134355430ffe58430c0a551b45f7"
        },
        "date": 1760715973364,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2387.08,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1680,
            "unit": "ms",
            "extra": "count: 7\nmax: 1680\np95: 1680\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9950,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3413,
            "unit": "ms",
            "extra": "count: 20\nmax: 3413\np95: 3413\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6219.88,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 2981,
            "unit": "ms",
            "extra": "count: 8\nmax: 2981\np95: 2981\nmedian: 56"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2275.67,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 293,
            "unit": "ms",
            "extra": "count: 13\nmax: 293\np95: 293\nmedian: 34"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 20358.86,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 7169,
            "unit": "ms",
            "extra": "count: 12\nmax: 7169\np95: 7169\nmedian: 453"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 49489.45,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 285,
            "unit": "ms",
            "extra": "count: 15\nmax: 285\np95: 285\nmedian: 59"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 50352.83,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 287,
            "unit": "ms",
            "extra": "count: 13\nmax: 287\np95: 287\nmedian: 50"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49049.41,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 258,
            "unit": "ms",
            "extra": "count: 14\nmax: 258\np95: 258\nmedian: 34"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 52173.67,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 1067,
            "unit": "ms",
            "extra": "count: 17\nmax: 1067\np95: 1067\nmedian: 44"
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
          "id": "8f5f801d727e61d1376d23a551be9721f5c7ac17",
          "message": "[Models tree]: Fix restartToken problem with category elements count query (#1484)\n\n* Fix restart problem\n\n* Add changeset",
          "timestamp": "2025-10-22T07:53:22Z",
          "tree_id": "09e486645441a3e89c67473e4a50491c6718abb2",
          "url": "https://github.com/iTwin/viewer-components-react/commit/8f5f801d727e61d1376d23a551be9721f5c7ac17"
        },
        "date": 1761120208217,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2449.24,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1686,
            "unit": "ms",
            "extra": "count: 5\nmax: 1686\np95: 1686\nmedian: 37"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9774.12,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3315,
            "unit": "ms",
            "extra": "count: 17\nmax: 3315\np95: 3315\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7752.92,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4516,
            "unit": "ms",
            "extra": "count: 7\nmax: 4516\np95: 4516\nmedian: 62"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2172.89,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 84,
            "unit": "ms",
            "extra": "count: 12\nmax: 84\np95: 84\nmedian: 28.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 19777.8,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6509,
            "unit": "ms",
            "extra": "count: 13\nmax: 6509\np95: 6509\nmedian: 66"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50284.72,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 323,
            "unit": "ms",
            "extra": "count: 15\nmax: 323\np95: 323\nmedian: 40"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49576.54,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 390,
            "unit": "ms",
            "extra": "count: 13\nmax: 390\np95: 390\nmedian: 53"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49809.09,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 263,
            "unit": "ms",
            "extra": "count: 14\nmax: 263\np95: 263\nmedian: 29.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 52265.12,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 288,
            "unit": "ms",
            "extra": "count: 22\nmax: 829\np95: 288\nmedian: 48.5"
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
          "id": "b61e6e8c6ea055a5347ebec7c0e21bc5a6f83fc1",
          "message": "applying package updates",
          "timestamp": "2025-10-22T08:09:53Z",
          "tree_id": "805f42c48fae34ece683246a9cd35aa997efb885",
          "url": "https://github.com/iTwin/viewer-components-react/commit/b61e6e8c6ea055a5347ebec7c0e21bc5a6f83fc1"
        },
        "date": 1761121206774,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2488.48,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1675,
            "unit": "ms",
            "extra": "count: 7\nmax: 1675\np95: 1675\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9414.7,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2934,
            "unit": "ms",
            "extra": "count: 18\nmax: 2934\np95: 2934\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7012.02,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3756,
            "unit": "ms",
            "extra": "count: 10\nmax: 3756\np95: 3756\nmedian: 42.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2244.72,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 294,
            "unit": "ms",
            "extra": "count: 11\nmax: 294\np95: 294\nmedian: 35"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 20008.87,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6432,
            "unit": "ms",
            "extra": "count: 12\nmax: 6432\np95: 6432\nmedian: 562.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 50047.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 292,
            "unit": "ms",
            "extra": "count: 12\nmax: 292\np95: 292\nmedian: 68.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 49043.78,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 276,
            "unit": "ms",
            "extra": "count: 15\nmax: 276\np95: 276\nmedian: 61"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 49417.34,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 264,
            "unit": "ms",
            "extra": "count: 11\nmax: 264\np95: 264\nmedian: 71"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 51273.39,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 284,
            "unit": "ms",
            "extra": "count: 21\nmax: 922\np95: 284\nmedian: 36"
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
          "id": "3304757bff254fb6aefb6218bef82c6401f2625b",
          "message": "Prettier: change import sorter plugin (#1488)\n\n* Add configuration\n\n* Fix imports in files\n\n* Fix css not being affected and remove extension recommendations\n\n* Add change files\n\n* Change built in modules to be sorted like all others\n\n* Ignore readme files when ordering imports\n\n* Change importOrderTypeScriptVersion value",
          "timestamp": "2025-10-24T10:17:23+03:00",
          "tree_id": "3b76a9b0bb8df49c48e7a3473e55b117c1813975",
          "url": "https://github.com/iTwin/viewer-components-react/commit/3304757bff254fb6aefb6218bef82c6401f2625b"
        },
        "date": 1761290885033,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2600.1,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1733,
            "unit": "ms",
            "extra": "count: 7\nmax: 1733\np95: 1733\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10498.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3760,
            "unit": "ms",
            "extra": "count: 17\nmax: 3760\np95: 3760\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7220.08,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3797,
            "unit": "ms",
            "extra": "count: 9\nmax: 3797\np95: 3797\nmedian: 57"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2308.46,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 275,
            "unit": "ms",
            "extra": "count: 13\nmax: 275\np95: 275\nmedian: 34"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 21208.19,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6613,
            "unit": "ms",
            "extra": "count: 13\nmax: 6613\np95: 6613\nmedian: 78"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 53952.38,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 316,
            "unit": "ms",
            "extra": "count: 18\nmax: 316\np95: 316\nmedian: 40"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 53660.4,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 439,
            "unit": "ms",
            "extra": "count: 14\nmax: 439\np95: 439\nmedian: 47"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 54130.31,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 298,
            "unit": "ms",
            "extra": "count: 15\nmax: 298\np95: 298\nmedian: 33"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 56512.15,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 1138,
            "unit": "ms",
            "extra": "count: 20\nmax: 1138\np95: 1138\nmedian: 34.5"
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
          "id": "5b7994eefa45055e8dc32554d0c06a330ec0b3b8",
          "message": "[Tree widget]: Add option to show categories that don't contain any elements (#1486)\n\n* Add option to show categories that don't contain any elements\n\n* Run prettier\n\n* Add internal defaultCategoriesTreeHierarchyConfiguration export\n\n* Add applyElementsFilter\n\n* Add option to provide hierarchyConfig to CategoriesTreeComponent & explain change better",
          "timestamp": "2025-10-24T16:37:53+03:00",
          "tree_id": "cbc924f2902a67600b58fd62dd7d92ee6f50ae94",
          "url": "https://github.com/iTwin/viewer-components-react/commit/5b7994eefa45055e8dc32554d0c06a330ec0b3b8"
        },
        "date": 1761313698575,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2500.77,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1657,
            "unit": "ms",
            "extra": "count: 8\nmax: 1657\np95: 1657\nmedian: 31.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 10701.19,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3984,
            "unit": "ms",
            "extra": "count: 16\nmax: 3984\np95: 3984\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7238.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3921,
            "unit": "ms",
            "extra": "count: 8\nmax: 3921\np95: 3921\nmedian: 58"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 2266.9,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 221,
            "unit": "ms",
            "extra": "count: 11\nmax: 221\np95: 221\nmedian: 42"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 20674.09,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6830,
            "unit": "ms",
            "extra": "count: 13\nmax: 6830\np95: 6830\nmedian: 70"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 51530.06,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 301,
            "unit": "ms",
            "extra": "count: 13\nmax: 301\np95: 301\nmedian: 82"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 51247.72,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 303,
            "unit": "ms",
            "extra": "count: 13\nmax: 303\np95: 303\nmedian: 40"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 51096.99,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 281,
            "unit": "ms",
            "extra": "count: 11\nmax: 281\np95: 281\nmedian: 66"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 53374.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 1150,
            "unit": "ms",
            "extra": "count: 18\nmax: 1150\np95: 1150\nmedian: 36"
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
          "id": "deee011ffb942a80d484dd4c9f7461d5f761d878",
          "message": "Cleanup performance tests (#1487)\n\n* Cleanup performance tests\n\n* Add datasets file changes\n\n* Make pipeline run on performance test changes\n\n* Fix dataset creation\n\n* Fix issues with checking visibility\n\n* Fix import order",
          "timestamp": "2025-10-28T12:10:48+02:00",
          "tree_id": "0aa6befa9e663ba26dc1cb72f0d07cd3062b1c9c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/deee011ffb942a80d484dd4c9f7461d5f761d878"
        },
        "date": 1761646648840,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2230.25,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1518,
            "unit": "ms",
            "extra": "count: 5\nmax: 1518\np95: 1518\nmedian: 31"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 13977.05,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 8069,
            "unit": "ms",
            "extra": "count: 4\nmax: 8069\np95: 8069\nmedian: 1126"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 9861.82,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 6161,
            "unit": "ms",
            "extra": "count: 4\nmax: 6161\np95: 6161\nmedian: 1364"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 945.89,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 142,
            "unit": "ms",
            "extra": "count: 8\nmax: 142\np95: 142\nmedian: 26.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 31873.02,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 11265,
            "unit": "ms",
            "extra": "count: 10\nmax: 11265\np95: 11265\nmedian: 526.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 16269.79,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 4896,
            "unit": "ms",
            "extra": "count: 11\nmax: 4896\np95: 4896\nmedian: 900"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 16316.63,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 7796,
            "unit": "ms",
            "extra": "count: 10\nmax: 7796\np95: 7796\nmedian: 915.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 15849.97,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 7337,
            "unit": "ms",
            "extra": "count: 10\nmax: 7337\np95: 7337\nmedian: 884"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 17166.64,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 5039,
            "unit": "ms",
            "extra": "count: 13\nmax: 5039\np95: 5039\nmedian: 904"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "35135765+grigasp@users.noreply.github.com",
            "name": "Grigas",
            "username": "grigasp"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "51671c7f2de3d35cfb211872c1e65155ae88802b",
          "message": "Analyze perf test datasets (#1493)",
          "timestamp": "2025-10-29T10:07:46+02:00",
          "tree_id": "7bdb9d8c948fa972219e058689ed41aad78b93fd",
          "url": "https://github.com/iTwin/viewer-components-react/commit/51671c7f2de3d35cfb211872c1e65155ae88802b"
        },
        "date": 1761725688722,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 2588.6,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 1774,
            "unit": "ms",
            "extra": "count: 6\nmax: 1774\np95: 1774\nmedian: 29"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 9915.17,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3390,
            "unit": "ms",
            "extra": "count: 5\nmax: 3390\np95: 3390\nmedian: 743"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 8688.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4326,
            "unit": "ms",
            "extra": "count: 5\nmax: 4326\np95: 4326\nmedian: 947"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1066.48,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 136,
            "unit": "ms",
            "extra": "count: 9\nmax: 136\np95: 136\nmedian: 33"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 35702.52,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 13772,
            "unit": "ms",
            "extra": "count: 10\nmax: 13772\np95: 13772\nmedian: 409"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 18910.75,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 9193,
            "unit": "ms",
            "extra": "count: 11\nmax: 9193\np95: 9193\nmedian: 976"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 19526,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 9945,
            "unit": "ms",
            "extra": "count: 11\nmax: 9945\np95: 9945\nmedian: 978"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 19028.33,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 9391,
            "unit": "ms",
            "extra": "count: 10\nmax: 9391\np95: 9391\nmedian: 1000.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 20626.99,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 6028,
            "unit": "ms",
            "extra": "count: 13\nmax: 6028\np95: 6028\nmedian: 1000"
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
          "id": "76476ab75ef9a0e842b76d33a0b73f015b711511",
          "message": "[Tree widget]: Change caches of models and categories tree to use observables (#1494)\n\n* Change models and categories tree cache to query using observables\n\n* Add change file\n\n* Change to patch change file\n\n* Change promises to observables\n\n* Run prettier\n\n* Use forkJoin\n\n* Change getCategoryElementsCount to observable\n\n* Update patch message",
          "timestamp": "2025-10-31T08:49:46+02:00",
          "tree_id": "b3cd24975c038c46b3da13175bd23dd78f21e84a",
          "url": "https://github.com/iTwin/viewer-components-react/commit/76476ab75ef9a0e842b76d33a0b73f015b711511"
        },
        "date": 1761893829177,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4205.03,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3512,
            "unit": "ms",
            "extra": "count: 5\nmax: 3512\np95: 3512\nmedian: 36"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 15745.96,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3434,
            "unit": "ms",
            "extra": "count: 19\nmax: 3434\np95: 3434\nmedian: 30"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 9428.42,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4294,
            "unit": "ms",
            "extra": "count: 5\nmax: 4294\np95: 4294\nmedian: 1384"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 988.05,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 111,
            "unit": "ms",
            "extra": "count: 10\nmax: 111\np95: 111\nmedian: 30.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 31098.83,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 12175,
            "unit": "ms",
            "extra": "count: 11\nmax: 12175\np95: 12175\nmedian: 132"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 21480.8,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 9485,
            "unit": "ms",
            "extra": "count: 11\nmax: 9485\np95: 9485\nmedian: 1217"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 21188.28,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 9310,
            "unit": "ms",
            "extra": "count: 11\nmax: 9310\np95: 9310\nmedian: 1188"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 21909.9,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 5710,
            "unit": "ms",
            "extra": "count: 12\nmax: 5710\np95: 5710\nmedian: 1228.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 22625.4,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 5828,
            "unit": "ms",
            "extra": "count: 14\nmax: 5828\np95: 5828\nmedian: 1259"
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
          "id": "5ca518d982efe132c0cda9e3db82b97cfb5055e5",
          "message": "Adjust performance tests (#1496)",
          "timestamp": "2025-10-31T09:15:16Z",
          "tree_id": "728f5777f01c5bb296ac9bb3f996185431c6cc60",
          "url": "https://github.com/iTwin/viewer-components-react/commit/5ca518d982efe132c0cda9e3db82b97cfb5055e5"
        },
        "date": 1761902521750,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4024.65,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3325,
            "unit": "ms",
            "extra": "count: 6\nmax: 3325\np95: 3325\nmedian: 38.5"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 4193.4,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 3330,
            "unit": "ms",
            "extra": "count: 1\nmax: 3330\np95: 3330\nmedian: 3330"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6646.73,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3836,
            "unit": "ms",
            "extra": "count: 2\nmax: 3836\np95: 3836\nmedian: 2698.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 994.51,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 104,
            "unit": "ms",
            "extra": "count: 12\nmax: 104\np95: 104\nmedian: 31"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 21027.83,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6655,
            "unit": "ms",
            "extra": "count: 16\nmax: 6655\np95: 6655\nmedian: 50"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2713.62,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 127,
            "unit": "ms",
            "extra": "count: 2\nmax: 127\np95: 127\nmedian: 75.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2764.93,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 1\nmax: 113\np95: 113\nmedian: 113"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 2934.03,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 85,
            "unit": "ms",
            "extra": "count: 3\nmax: 85\np95: 85\nmedian: 55"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 3240.69,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 421,
            "unit": "ms",
            "extra": "count: 5\nmax: 421\np95: 421\nmedian: 59"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "43886789+MartynasStrazdas@users.noreply.github.com",
            "name": "Martynas",
            "username": "MartynasStrazdas"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "70397d85f2c152c407c389c828ae746bc602f259",
          "message": "[Tree-widget]: fix scroll not persisting on widget change (#1497)\n\n* fix\n\n* change",
          "timestamp": "2025-10-31T14:56:53+02:00",
          "tree_id": "0ca9189b2c49eb982d1adf2452aa06856ed2d67e",
          "url": "https://github.com/iTwin/viewer-components-react/commit/70397d85f2c152c407c389c828ae746bc602f259"
        },
        "date": 1761915823297,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4132.04,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3335,
            "unit": "ms",
            "extra": "count: 9\nmax: 3335\np95: 3335\nmedian: 34"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 5329.17,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4378,
            "unit": "ms",
            "extra": "count: 2\nmax: 4378\np95: 4378\nmedian: 2199.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7855.69,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 4953,
            "unit": "ms",
            "extra": "count: 2\nmax: 4953\np95: 4953\nmedian: 3317"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1004.44,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 115,
            "unit": "ms",
            "extra": "count: 11\nmax: 115\np95: 115\nmedian: 30"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 21035.69,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6839,
            "unit": "ms",
            "extra": "count: 15\nmax: 6839\np95: 6839\nmedian: 54"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 3011.06,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 3189.27,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 139,
            "unit": "ms",
            "extra": "count: 3\nmax: 139\np95: 139\nmedian: 29"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 3126.75,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 136,
            "unit": "ms",
            "extra": "count: 2\nmax: 136\np95: 136\nmedian: 83"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 3915.54,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 286,
            "unit": "ms",
            "extra": "count: 6\nmax: 286\np95: 286\nmedian: 128.5"
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
          "id": "2a672f5d3189532643ee360ccdd2466982c52e4c",
          "message": "applying package updates",
          "timestamp": "2025-11-03T07:50:14Z",
          "tree_id": "5aa0917837334f4df2ae6df1273085090fd1fbac",
          "url": "https://github.com/iTwin/viewer-components-react/commit/2a672f5d3189532643ee360ccdd2466982c52e4c"
        },
        "date": 1762156619168,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4055.32,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3407,
            "unit": "ms",
            "extra": "count: 5\nmax: 3407\np95: 3407\nmedian: 32"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories",
            "value": 3847.99,
            "unit": "ms"
          },
          {
            "name": "categories tree changing category visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 2881,
            "unit": "ms",
            "extra": "count: 1\nmax: 2881\np95: 2881\nmedian: 2881"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 6611.34,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 3625,
            "unit": "ms",
            "extra": "count: 2\nmax: 3625\np95: 3625\nmedian: 2644"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1130.92,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 12\nmax: 113\np95: 113\nmedian: 40"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 21756.24,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6962,
            "unit": "ms",
            "extra": "count: 16\nmax: 6962\np95: 6962\nmedian: 59"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2880.34,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 126,
            "unit": "ms",
            "extra": "count: 1\nmax: 126\np95: 126\nmedian: 126"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 3284.06,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 150,
            "unit": "ms",
            "extra": "count: 2\nmax: 150\np95: 150\nmedian: 91.5"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 3192.62,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 156,
            "unit": "ms",
            "extra": "count: 2\nmax: 156\np95: 156\nmedian: 93.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 3483.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 320,
            "unit": "ms",
            "extra": "count: 7\nmax: 320\np95: 320\nmedian: 56"
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
          "id": "95e7eada08073af0f60d357352862d96894e1502",
          "message": "Change perf tests (#1500)",
          "timestamp": "2025-11-04T15:47:10+02:00",
          "tree_id": "521f3e2ab868d499059a26c5bdf2a85ee2ca59d6",
          "url": "https://github.com/iTwin/viewer-components-react/commit/95e7eada08073af0f60d357352862d96894e1502"
        },
        "date": 1762264439829,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 3813.46,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3167,
            "unit": "ms",
            "extra": "count: 4\nmax: 3167\np95: 3167\nmedian: 137.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 8050.18,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 6760,
            "unit": "ms",
            "extra": "count: 2\nmax: 6760\np95: 6760\nmedian: 3518.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10050.55,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 6993,
            "unit": "ms",
            "extra": "count: 3\nmax: 6993\np95: 6993\nmedian: 1608"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 971.71,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 10\nmax: 113\np95: 113\nmedian: 31.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 20305.08,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 6008,
            "unit": "ms",
            "extra": "count: 13\nmax: 6008\np95: 6008\nmedian: 54"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2919.3,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 3145.15,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 148,
            "unit": "ms",
            "extra": "count: 1\nmax: 148\np95: 148\nmedian: 148"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 3021.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 147,
            "unit": "ms",
            "extra": "count: 2\nmax: 147\np95: 147\nmedian: 85.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 3671.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 311,
            "unit": "ms",
            "extra": "count: 5\nmax: 311\np95: 311\nmedian: 150"
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
          "id": "15a94dc04b5b7664947e764d56a0503e26fd6e83",
          "message": "[Tree widget]: Reduce main thread blockage when determining visibility (#1499)\n\n* Reduce main thread blockage\n\n* Fix\n\n* Add release\n\n* Address comments\n\n* Prettier\n\n* Address comments",
          "timestamp": "2025-11-07T09:13:16+02:00",
          "tree_id": "6b49dbe3d1963f09fe65c561ddd45668b13196d0",
          "url": "https://github.com/iTwin/viewer-components-react/commit/15a94dc04b5b7664947e764d56a0503e26fd6e83"
        },
        "date": 1762499962815,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1390.44,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 319,
            "unit": "ms",
            "extra": "count: 7\nmax: 319\np95: 319\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 5676.1,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 54,
            "unit": "ms",
            "extra": "count: 2\nmax: 54\np95: 54\nmedian: 38"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 8036.46,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 93,
            "unit": "ms",
            "extra": "count: 51\nmax: 220\np95: 93\nmedian: 49"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 850.8,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 85,
            "unit": "ms",
            "extra": "count: 7\nmax: 85\np95: 85\nmedian: 29"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 9420.64,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 89,
            "unit": "ms",
            "extra": "count: 13\nmax: 89\np95: 89\nmedian: 27"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2459.27,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2506.41,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 2528.16,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 3105.36,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 89,
            "unit": "ms",
            "extra": "count: 8\nmax: 89\np95: 89\nmedian: 39.5"
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
          "id": "36aa209cbd1aaed8c8e8a9aabeafab469c254b65",
          "message": "[Tree widget]: Fix element visibility ignoring children elements (#1477)\n\n* Update child elements visibility\n\n* Merge fixes\n\n* Run prettier\n\n* Run changeset\n\n* Remove api changes\n\n* Set parentInstanceNodesIds up to nearest model\n\n* Run prettier\n\n* Address comments\n\n* Run prettier\n\n* Add retry to performance tests\n\n* Run prettier\n\n* Fix bugs\n\n* Fix merge issue\n\n* Remove redundant changes\n\n* Add parentIds to tests\n\n* Add tests\n\n* Run pnpm install\n\n* Make each children query restart token unique\n\n* Rename tests\n\n* Add comments\n\n* Add more comments\n\n* Add more comments\n\n* Run pnpm install\n\n* Run fresh install\n\n* Remove test-utilities from dev dependencies\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/FilteredTree.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/FilteredTree.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Address some comments\n\n* Add comment\n\n* Address comments\n\n* Return a single promise instead of array of promises\n\n* Address comments\n\n* Update element nodes query to be more efficient\n\n* Remove changes from lock file\n\n* Undo changes to lock files\n\n* Undo root lock file changes\n\n* Run prettier\n\n* Add release main thread after validating visibility\n\n* Remove toArray, replace with takeLast\n\n* Prettier\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-11-13T11:12:24+02:00",
          "tree_id": "37064461e7940a185a4c8dd843dce97a0f51033c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/36aa209cbd1aaed8c8e8a9aabeafab469c254b65"
        },
        "date": 1763025506426,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1460.72,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 417,
            "unit": "ms",
            "extra": "count: 8\nmax: 417\np95: 417\nmedian: 30.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 5775.82,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 51,
            "unit": "ms",
            "extra": "count: 1\nmax: 51\np95: 51\nmedian: 51"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 7932.08,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 83,
            "unit": "ms",
            "extra": "count: 34\nmax: 109\np95: 83\nmedian: 39.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 804.27,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 68,
            "unit": "ms",
            "extra": "count: 7\nmax: 68\np95: 68\nmedian: 28"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 7893.99,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 89,
            "unit": "ms",
            "extra": "count: 1\nmax: 89\np95: 89\nmedian: 89"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2368.24,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2492.52,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 2634.18,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 4574.42,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 78,
            "unit": "ms",
            "extra": "count: 6\nmax: 78\np95: 78\nmedian: 44.5"
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
          "id": "9f6e677eea55e0abea0c62265b44b8d9bafa8676",
          "message": "applying package updates",
          "timestamp": "2025-11-13T09:36:43Z",
          "tree_id": "6119a4c2c9cfb22df00e3b59b4122cbeadfa1c8c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/9f6e677eea55e0abea0c62265b44b8d9bafa8676"
        },
        "date": 1763026962420,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1333.65,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 281,
            "unit": "ms",
            "extra": "count: 9\nmax: 281\np95: 281\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 7562.56,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 57,
            "unit": "ms",
            "extra": "count: 2\nmax: 57\np95: 57\nmedian: 40"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10759.7,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 97,
            "unit": "ms",
            "extra": "count: 66\nmax: 136\np95: 97\nmedian: 61.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 817.99,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 144,
            "unit": "ms",
            "extra": "count: 5\nmax: 144\np95: 144\nmedian: 43"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 7821.27,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 82,
            "unit": "ms",
            "extra": "count: 3\nmax: 82\np95: 82\nmedian: 38"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2369.85,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2624.12,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 121,
            "unit": "ms",
            "extra": "count: 1\nmax: 121\np95: 121\nmedian: 121"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 2489.13,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 4443.8,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 67,
            "unit": "ms",
            "extra": "count: 7\nmax: 67\np95: 67\nmedian: 47"
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
          "id": "c74b50f8eeddf07052b467eb891d188f2435a387",
          "message": "[Tree widget]: Fix subjects/models having partial visibility when always drawn exclusive is true (#1514)\n\n* Fix\n\n* Adjust changeset\n\n* Update change/@itwin-tree-widget-react-a3a14fab-9f88-4b7a-a33b-d8d2e7e04083.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2025-11-18T14:11:25Z",
          "tree_id": "5e8abb8155d6d062062a000eadbb375bb4fb795e",
          "url": "https://github.com/iTwin/viewer-components-react/commit/c74b50f8eeddf07052b467eb891d188f2435a387"
        },
        "date": 1763475469549,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1421.49,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 303,
            "unit": "ms",
            "extra": "count: 8\nmax: 303\np95: 303\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6112.83,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 59,
            "unit": "ms",
            "extra": "count: 2\nmax: 59\np95: 59\nmedian: 42"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 8574.76,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 100,
            "unit": "ms",
            "extra": "count: 38\nmax: 126\np95: 100\nmedian: 40.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 863.83,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 108,
            "unit": "ms",
            "extra": "count: 6\nmax: 108\np95: 108\nmedian: 59.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 9197.99,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 91,
            "unit": "ms",
            "extra": "count: 2\nmax: 91\np95: 91\nmedian: 58"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2613.6,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2872.26,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 2997.01,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 132,
            "unit": "ms",
            "extra": "count: 1\nmax: 132\np95: 132\nmedian: 132"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 5204.91,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 84,
            "unit": "ms",
            "extra": "count: 7\nmax: 84\np95: 84\nmedian: 60"
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
          "id": "34a1a3a3bb709965069db990b9a023b8aeba26fc",
          "message": "applying package updates",
          "timestamp": "2025-11-18T15:20:07Z",
          "tree_id": "44321d4c2e2fd1c9b7a128e8a3236249e1fd82db",
          "url": "https://github.com/iTwin/viewer-components-react/commit/34a1a3a3bb709965069db990b9a023b8aeba26fc"
        },
        "date": 1763479645151,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1789.81,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 249,
            "unit": "ms",
            "extra": "count: 9\nmax: 249\np95: 249\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6391.2,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 63,
            "unit": "ms",
            "extra": "count: 2\nmax: 63\np95: 63\nmedian: 61"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 13069.77,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 170,
            "unit": "ms",
            "extra": "count: 47\nmax: 282\np95: 170\nmedian: 53"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1146.17,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 103,
            "unit": "ms",
            "extra": "count: 12\nmax: 103\np95: 103\nmedian: 52"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 13005.43,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 13\nmax: 113\np95: 113\nmedian: 35"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 4237.97,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 54,
            "unit": "ms",
            "extra": "count: 4\nmax: 54\np95: 54\nmedian: 25"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 4149.26,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 63,
            "unit": "ms",
            "extra": "count: 3\nmax: 63\np95: 63\nmedian: 42"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 4179.76,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 153,
            "unit": "ms",
            "extra": "count: 2\nmax: 153\np95: 153\nmedian: 99.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 7512.91,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 126,
            "unit": "ms",
            "extra": "count: 10\nmax: 126\np95: 126\nmedian: 66"
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
          "id": "58fc2bcf609603602a3f198dae190e0667229777",
          "message": "[tree-widget] Do not setState in render (#1519)\n\n* Avoid setState in render\n\n* change",
          "timestamp": "2025-11-20T13:02:48+02:00",
          "tree_id": "442dbec4ca3ac0b4333b5eb41f3a7c3e729ba2d8",
          "url": "https://github.com/iTwin/viewer-components-react/commit/58fc2bcf609603602a3f198dae190e0667229777"
        },
        "date": 1763636966249,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1739.43,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 367,
            "unit": "ms",
            "extra": "count: 8\nmax: 367\np95: 367\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6288.71,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 54,
            "unit": "ms",
            "extra": "count: 1\nmax: 54\np95: 54\nmedian: 54"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10978.62,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 143,
            "unit": "ms",
            "extra": "count: 43\nmax: 270\np95: 143\nmedian: 43"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1014.78,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 218,
            "unit": "ms",
            "extra": "count: 8\nmax: 218\np95: 218\nmedian: 30"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 11461.05,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 84,
            "unit": "ms",
            "extra": "count: 10\nmax: 84\np95: 84\nmedian: 31.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 3720.18,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 123,
            "unit": "ms",
            "extra": "count: 2\nmax: 123\np95: 123\nmedian: 72"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 3724.2,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 66,
            "unit": "ms",
            "extra": "count: 2\nmax: 66\np95: 66\nmedian: 52"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 3741.15,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 59,
            "unit": "ms",
            "extra": "count: 2\nmax: 59\np95: 59\nmedian: 47.5"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements",
            "value": 7086.73,
            "unit": "ms"
          },
          {
            "name": "models tree changing element visibility changes only parent nodes visibility with 50k elements (P95 of main thread blocks)",
            "value": 190,
            "unit": "ms",
            "extra": "count: 12\nmax: 190\np95: 190\nmedian: 61.5"
          }
        ]
      }
    ]
  }
}