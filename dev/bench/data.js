window.BENCHMARK_DATA = {
  "lastUpdate": 1758715417821,
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
      }
    ]
  }
}