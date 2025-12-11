window.BENCHMARK_DATA = {
  "lastUpdate": 1765458158839,
  "repoUrl": "https://github.com/iTwin/viewer-components-react",
  "entries": {
    "Tree-Widget Next benchmark": [
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
          "id": "958e3e570cff93968457f2353b1c44d85f397b51",
          "message": "[Tree-Widget]: Show benchmark results on next branch",
          "timestamp": "2025-11-21T16:14:18Z",
          "url": "https://github.com/iTwin/viewer-components-react/pull/1526/commits/958e3e570cff93968457f2353b1c44d85f397b51"
        },
        "date": 1764851638476,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 3701.32,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 2857,
            "unit": "ms",
            "extra": "count: 6\nmax: 2857\np95: 2857\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 8891.78,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 6421,
            "unit": "ms",
            "extra": "count: 2\nmax: 6421\np95: 6421\nmedian: 3413"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 15967.54,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 94,
            "unit": "ms",
            "extra": "count: 58\nmax: 4759\np95: 94\nmedian: 59.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 37.6,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1451.07,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 166,
            "unit": "ms",
            "extra": "count: 8\nmax: 166\np95: 166\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 938.52,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 121,
            "unit": "ms",
            "extra": "count: 6\nmax: 121\np95: 121\nmedian: 53.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 37616.54,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 17035,
            "unit": "ms",
            "extra": "count: 9\nmax: 17035\np95: 17035\nmedian: 111"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2479.05,
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
            "value": 2453.46,
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
            "value": 2443.37,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "3d575ce9c863d80eb78a294b46ddd1d612fd795a",
          "message": "[Tree-Widget]: Show benchmark results on next branch (#1526)\n\n* Show benchmark results on next branch\n\n* Update package versions\n\n* Create initial data for gh-pages-next\n\n* Revert change\n\n* Test adding write permission on pull requests",
          "timestamp": "2025-12-04T16:46:50+02:00",
          "tree_id": "7e99401b17be4bfa20392067d1d9675403681ee9",
          "url": "https://github.com/iTwin/viewer-components-react/commit/3d575ce9c863d80eb78a294b46ddd1d612fd795a"
        },
        "date": 1764860090497,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4171.51,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3209,
            "unit": "ms",
            "extra": "count: 7\nmax: 3209\np95: 3209\nmedian: 34"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 7710.82,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 5195,
            "unit": "ms",
            "extra": "count: 2\nmax: 5195\np95: 5195\nmedian: 2790"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 14679.57,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 1041,
            "unit": "ms",
            "extra": "count: 35\nmax: 4818\np95: 1041\nmedian: 39"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.67,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 21,
            "unit": "ms",
            "extra": "count: 1\nmax: 21\np95: 21\nmedian: 21"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1541.09,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 194,
            "unit": "ms",
            "extra": "count: 10\nmax: 194\np95: 194\nmedian: 32.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1030.34,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 181,
            "unit": "ms",
            "extra": "count: 8\nmax: 181\np95: 181\nmedian: 33.5"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories",
            "value": 40538.29,
            "unit": "ms"
          },
          {
            "name": "models tree validates categories visibility for imodel with 50k categories (P95 of main thread blocks)",
            "value": 15439,
            "unit": "ms",
            "extra": "count: 9\nmax: 15439\np95: 15439\nmedian: 587"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2479.33,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 21,
            "unit": "ms",
            "extra": "count: 1\nmax: 21\np95: 21\nmedian: 21"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2579.48,
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
            "value": 2193.25,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "c141d04b94ef2bc7a9066712a4706d17851327b1",
          "message": "[tree-widget]: Expose ClassificationsTree definition (#1524)\n\n* Initial attempt\n\n* Cleanup API\n\n* extract-api\n\n* extract-api\n\n* Support search by label\n\n* Cleanup\n\n* Header\n\n* Cleanup\n\n* Renames\n\n* build\n\n* extract-api\n\n* Pass abort signal\n\n* Skip flaky tests",
          "timestamp": "2025-12-04T17:16:36+02:00",
          "tree_id": "36357cd96678674195677696ce3e9d37897308a9",
          "url": "https://github.com/iTwin/viewer-components-react/commit/c141d04b94ef2bc7a9066712a4706d17851327b1"
        },
        "date": 1764861757181,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4158.01,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3215,
            "unit": "ms",
            "extra": "count: 7\nmax: 3215\np95: 3215\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 7364.41,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 5141,
            "unit": "ms",
            "extra": "count: 2\nmax: 5141\np95: 5141\nmedian: 2738"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12306.99,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 899,
            "unit": "ms",
            "extra": "count: 31\nmax: 3913\np95: 899\nmedian: 36"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.21,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1465.78,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 162,
            "unit": "ms",
            "extra": "count: 7\nmax: 162\np95: 162\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1000.39,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 171,
            "unit": "ms",
            "extra": "count: 7\nmax: 171\np95: 171\nmedian: 49"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2331.06,
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
            "value": 2344.77,
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
            "value": 2250.13,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "29a3eabec2040934479391d2752ec3ea114362a9",
          "message": "[tree-widget]: Filter classifications tree by instance keys (#1529)\n\n* Add ability to filter classifications tree by instance keys\n\n* Change\n\n* Update message\n\n* Cleanup",
          "timestamp": "2025-12-05T13:55:14+02:00",
          "tree_id": "784eea08b271e831bfa4c97845a071d7920a86d3",
          "url": "https://github.com/iTwin/viewer-components-react/commit/29a3eabec2040934479391d2752ec3ea114362a9"
        },
        "date": 1764936080598,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4216.69,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3260,
            "unit": "ms",
            "extra": "count: 7\nmax: 3260\np95: 3260\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6896.16,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4608,
            "unit": "ms",
            "extra": "count: 2\nmax: 4608\np95: 4608\nmedian: 2479.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12985.19,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 938,
            "unit": "ms",
            "extra": "count: 37\nmax: 3988\np95: 938\nmedian: 40"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.52,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 24,
            "unit": "ms",
            "extra": "count: 1\nmax: 24\np95: 24\nmedian: 24"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1411.47,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 159,
            "unit": "ms",
            "extra": "count: 7\nmax: 159\np95: 159\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 878.01,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 88,
            "unit": "ms",
            "extra": "count: 6\nmax: 88\np95: 88\nmedian: 50"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2319.56,
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
            "value": 2356.48,
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
            "value": 2036.17,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "b4cc8c3d1f838d2c78e17deec39778c236acf312",
          "message": "[tree-widget]: Bump `presentation-hierarchies-react` version (#1530)\n\n* Bump packages\n\n* Use new merged provider\n\n* bump presentation-components\n\n* Remove id\n\n* Ignore nested grouping nodes",
          "timestamp": "2025-12-05T15:03:21+02:00",
          "tree_id": "91b980290fcb14892fc06ceee8b0b91f0abf0b8c",
          "url": "https://github.com/iTwin/viewer-components-react/commit/b4cc8c3d1f838d2c78e17deec39778c236acf312"
        },
        "date": 1764940163072,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4124.79,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3199,
            "unit": "ms",
            "extra": "count: 8\nmax: 3199\np95: 3199\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6446.82,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4147,
            "unit": "ms",
            "extra": "count: 2\nmax: 4147\np95: 4147\nmedian: 2243.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 13604.66,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 958,
            "unit": "ms",
            "extra": "count: 33\nmax: 4429\np95: 958\nmedian: 37"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 43.03,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 25,
            "unit": "ms",
            "extra": "count: 1\nmax: 25\np95: 25\nmedian: 25"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1542.11,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 205,
            "unit": "ms",
            "extra": "count: 6\nmax: 205\np95: 205\nmedian: 32.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 972.18,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 99,
            "unit": "ms",
            "extra": "count: 8\nmax: 99\np95: 99\nmedian: 33.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2060.13,
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
            "value": 2027.17,
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
            "value": 1978.57,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "adfe5a63ebea6468eca43ccd824bff2a0f56a625",
          "message": "applying package updates",
          "timestamp": "2025-12-05T13:20:08Z",
          "tree_id": "1be4c5291df1918c031a7a95f49d2a6750ebb029",
          "url": "https://github.com/iTwin/viewer-components-react/commit/adfe5a63ebea6468eca43ccd824bff2a0f56a625"
        },
        "date": 1764941183708,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 4322.12,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 3285,
            "unit": "ms",
            "extra": "count: 8\nmax: 3285\np95: 3285\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 7053.76,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4767,
            "unit": "ms",
            "extra": "count: 2\nmax: 4767\np95: 4767\nmedian: 2563.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 13326.01,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 978,
            "unit": "ms",
            "extra": "count: 29\nmax: 4308\np95: 978\nmedian: 36"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 42.97,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1491.34,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 183,
            "unit": "ms",
            "extra": "count: 6\nmax: 183\np95: 183\nmedian: 32.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 941.13,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 110,
            "unit": "ms",
            "extra": "count: 6\nmax: 110\np95: 110\nmedian: 51"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2897.26,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 140,
            "unit": "ms",
            "extra": "count: 2\nmax: 140\np95: 140\nmedian: 82.5"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2666.02,
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
            "value": 2138.43,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "84632ae75e5e1b29634e060ffa8ca959f0c5eae1",
          "message": "[Tree widget]: Improve trees visibility performance (#1532)\n\n* Improve performance\n\n* Remove unused imports",
          "timestamp": "2025-12-09T15:17:18+02:00",
          "tree_id": "6f2c80ee9a62c52439f9d84c94ba22a6aad39346",
          "url": "https://github.com/iTwin/viewer-components-react/commit/84632ae75e5e1b29634e060ffa8ca959f0c5eae1"
        },
        "date": 1765286579416,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1363.76,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 163,
            "unit": "ms",
            "extra": "count: 5\nmax: 163\np95: 163\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 7103.47,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 5076,
            "unit": "ms",
            "extra": "count: 2\nmax: 5076\np95: 5076\nmedian: 2722.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 13371.79,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 107,
            "unit": "ms",
            "extra": "count: 59\nmax: 3469\np95: 107\nmedian: 62"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 36.27,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1423.02,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 198,
            "unit": "ms",
            "extra": "count: 5\nmax: 198\np95: 198\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 859.02,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 112,
            "unit": "ms",
            "extra": "count: 6\nmax: 112\np95: 112\nmedian: 46"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2153.96,
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
            "value": 2134.66,
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
            "value": 2137.71,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "a170f09fe97f8a2af0a34ed2f04e215222dbaefb",
          "message": "Tree widget: Expose tree action base (#1534)\n\n* Change unified-selection to non alpha version\n\n* Expose `TreeActionBase` for defining custom actions\n\n* extract-api",
          "timestamp": "2025-12-10T15:33:31+02:00",
          "tree_id": "ba3d78515e0bf4a6f599932d9e02dcac93e42b49",
          "url": "https://github.com/iTwin/viewer-components-react/commit/a170f09fe97f8a2af0a34ed2f04e215222dbaefb"
        },
        "date": 1765373947823,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1359.63,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 163,
            "unit": "ms",
            "extra": "count: 7\nmax: 163\np95: 163\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 8812.12,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 6732,
            "unit": "ms",
            "extra": "count: 2\nmax: 6732\np95: 6732\nmedian: 3551"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12715.25,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 95,
            "unit": "ms",
            "extra": "count: 54\nmax: 3214\np95: 95\nmedian: 61.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 35.64,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1375.07,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 182,
            "unit": "ms",
            "extra": "count: 5\nmax: 182\np95: 182\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 853.82,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 121,
            "unit": "ms",
            "extra": "count: 6\nmax: 121\np95: 121\nmedian: 49"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2301.26,
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
            "value": 2272.01,
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
            "value": 2268.1,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "82552ac69908235b24ef22f1e98216f3aea730cc",
          "message": "applying package updates",
          "timestamp": "2025-12-10T20:21:07Z",
          "tree_id": "81f8ccf460051844b58bd0a5a84141bc9455a564",
          "url": "https://github.com/iTwin/viewer-components-react/commit/82552ac69908235b24ef22f1e98216f3aea730cc"
        },
        "date": 1765398403195,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1432.86,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 185,
            "unit": "ms",
            "extra": "count: 7\nmax: 185\np95: 185\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6536.23,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4568,
            "unit": "ms",
            "extra": "count: 2\nmax: 4568\np95: 4568\nmedian: 2448.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10921.15,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 413,
            "unit": "ms",
            "extra": "count: 38\nmax: 3027\np95: 413\nmedian: 39.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 39.17,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1353.02,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 160,
            "unit": "ms",
            "extra": "count: 4\nmax: 160\np95: 160\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 781.76,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 131,
            "unit": "ms",
            "extra": "count: 6\nmax: 131\np95: 131\nmedian: 31"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2006.12,
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
            "value": 2024.87,
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
            "value": 1961.66,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
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
          "id": "55de8d710aec1434831d0c769a60c00ba192698a",
          "message": "[Tree widget]: Fix changing subCategory visibility not triggering icon update (#1535)\n\n* Fix changing subCategory visibility not updating tree visibility icons\n\n* Add test that checks if events are fired",
          "timestamp": "2025-12-11T14:56:31+02:00",
          "tree_id": "05e9c14cdf9eca31a7cc6591e790c2e44624b152",
          "url": "https://github.com/iTwin/viewer-components-react/commit/55de8d710aec1434831d0c769a60c00ba192698a"
        },
        "date": 1765458154660,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1443.6,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 163,
            "unit": "ms",
            "extra": "count: 9\nmax: 163\np95: 163\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6428.54,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4242,
            "unit": "ms",
            "extra": "count: 2\nmax: 4242\np95: 4242\nmedian: 2321.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12030.73,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 499,
            "unit": "ms",
            "extra": "count: 38\nmax: 3494\np95: 499\nmedian: 39.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 43.15,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 23,
            "unit": "ms",
            "extra": "count: 1\nmax: 23\np95: 23\nmedian: 23"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1456.54,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 193,
            "unit": "ms",
            "extra": "count: 6\nmax: 193\np95: 193\nmedian: 30.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 833.06,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 91,
            "unit": "ms",
            "extra": "count: 6\nmax: 91\np95: 91\nmedian: 43.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2364.98,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 21,
            "unit": "ms",
            "extra": "count: 1\nmax: 21\np95: 21\nmedian: 21"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2403.13,
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
            "value": 2367.82,
            "unit": "ms"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 0,
            "unit": "ms",
            "extra": "count: 0\nmax: N/A\np95: N/A\nmedian: N/A"
          }
        ]
      }
    ]
  }
}