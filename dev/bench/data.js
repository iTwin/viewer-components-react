window.BENCHMARK_DATA = {
  "lastUpdate": 1747227380784,
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
      }
    ]
  }
}