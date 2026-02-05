window.BENCHMARK_DATA = {
  "lastUpdate": 1770296836313,
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
          "id": "da7f898cef17813109dcaa1794201c646ecb2e76",
          "message": "Remove limit when filtering classifications tree by target items (#1536)",
          "timestamp": "2025-12-11T16:12:35+02:00",
          "tree_id": "fda4fd7843646edbc863357af6e226ae15f1ad12",
          "url": "https://github.com/iTwin/viewer-components-react/commit/da7f898cef17813109dcaa1794201c646ecb2e76"
        },
        "date": 1765462697932,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1389.13,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 173,
            "unit": "ms",
            "extra": "count: 5\nmax: 173\np95: 173\nmedian: 31"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6803.45,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4814,
            "unit": "ms",
            "extra": "count: 2\nmax: 4814\np95: 4814\nmedian: 2588.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 13840.57,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 107,
            "unit": "ms",
            "extra": "count: 68\nmax: 3384\np95: 107\nmedian: 67.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 39.03,
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
            "value": 1378.64,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 172,
            "unit": "ms",
            "extra": "count: 7\nmax: 172\np95: 172\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 866.75,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 84,
            "unit": "ms",
            "extra": "count: 6\nmax: 84\np95: 84\nmedian: 50"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2220.96,
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
            "value": 2214.36,
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
            "value": 2170.33,
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
          "id": "e7b7272241904b6253e8789c9cdb9d7f8ea9faef",
          "message": "applying package updates",
          "timestamp": "2025-12-11T14:30:05Z",
          "tree_id": "61efe4b9035202b8acec1562a52b339d5cea871d",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e7b7272241904b6253e8789c9cdb9d7f8ea9faef"
        },
        "date": 1765463752283,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1428.97,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 175,
            "unit": "ms",
            "extra": "count: 9\nmax: 175\np95: 175\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6900.52,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4869,
            "unit": "ms",
            "extra": "count: 2\nmax: 4869\np95: 4869\nmedian: 2601.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10687.34,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 453,
            "unit": "ms",
            "extra": "count: 31\nmax: 3076\np95: 453\nmedian: 36"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.78,
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
            "value": 1420.32,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 195,
            "unit": "ms",
            "extra": "count: 6\nmax: 195\np95: 195\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 951.82,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 110,
            "unit": "ms",
            "extra": "count: 8\nmax: 110\np95: 110\nmedian: 43.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2196.91,
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
            "value": 2460.85,
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
            "value": 2509.49,
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
          "id": "a1a6c9815d9edea4ccb32ec82d8685a753cadcc5",
          "message": "Bump hierarchies-react and react to changes (#1538)\n\n* Bump and fix build\n\n* prettier\n\n* Fix benchmark tests\n\n* Cleanup\n\n* prettier\n\n* Fix tests",
          "timestamp": "2025-12-12T17:13:34+02:00",
          "tree_id": "14ee1102b31e88fbdee61d4329fa2c40ad1d26bf",
          "url": "https://github.com/iTwin/viewer-components-react/commit/a1a6c9815d9edea4ccb32ec82d8685a753cadcc5"
        },
        "date": 1765552768146,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1451.84,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 159,
            "unit": "ms",
            "extra": "count: 8\nmax: 159\np95: 159\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6963.01,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4926,
            "unit": "ms",
            "extra": "count: 2\nmax: 4926\np95: 4926\nmedian: 2631.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11476.15,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 448,
            "unit": "ms",
            "extra": "count: 35\nmax: 3204\np95: 448\nmedian: 39"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.99,
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
            "value": 1554.65,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 177,
            "unit": "ms",
            "extra": "count: 8\nmax: 177\np95: 177\nmedian: 33.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 992.01,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 152,
            "unit": "ms",
            "extra": "count: 8\nmax: 152\np95: 152\nmedian: 51.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2085.59,
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
            "value": 2029.02,
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
            "value": 2295.99,
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
          "id": "bbd3238e28dd4e24e34c713f3a1ac4b72c6821e0",
          "message": "[Tree widget]: Rename filter to search (#1539)\n\n* Rename `filter` related APIs to `search`\n\n* More renames\n\n* More renames\n\n* prettier\n\n* Fixes\n\n* Change\n\n* Remove postfix\n\n* prettier\n\n* Missed renames\n\n* Rename css class names\n\n* More renames\n\n* extract-api",
          "timestamp": "2025-12-17T14:46:16+02:00",
          "tree_id": "a0f2866f732fadc2392ae21ee7bf877803d06f9a",
          "url": "https://github.com/iTwin/viewer-components-react/commit/bbd3238e28dd4e24e34c713f3a1ac4b72c6821e0"
        },
        "date": 1765975936652,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1531.54,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 161,
            "unit": "ms",
            "extra": "count: 8\nmax: 161\np95: 161\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6765.93,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 4705,
            "unit": "ms",
            "extra": "count: 2\nmax: 4705\np95: 4705\nmedian: 2521.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11015.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 438,
            "unit": "ms",
            "extra": "count: 31\nmax: 3243\np95: 438\nmedian: 36"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 43.74,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1375.53,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 172,
            "unit": "ms",
            "extra": "count: 5\nmax: 172\np95: 172\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 961.3,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 122,
            "unit": "ms",
            "extra": "count: 8\nmax: 122\np95: 122\nmedian: 60"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2217.16,
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
            "value": 2172.7,
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
            "value": 2262.12,
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
          "id": "d79f88a921cf01e56a9a6c9dffa18f6dd20c0b1e",
          "message": "[Tree Widget]: Adjust sub-category visibility handling (#1537)\n\n* Add sub-categories to caches\n\n* Fix build problems\n\n* Address comments\n\n* Update packages/itwin/tree-widget/src/test/trees/categories-tree/internal/CategoriesTreeIdsCache.test.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/test/trees/categories-tree/internal/CategoriesTreeIdsCache.test.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n* Fix main thread blockage\n\n* Prettier\n\n---------\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>",
          "timestamp": "2025-12-18T07:41:26+02:00",
          "tree_id": "682c530e8236d5334655c147c41df9911f4706ba",
          "url": "https://github.com/iTwin/viewer-components-react/commit/d79f88a921cf01e56a9a6c9dffa18f6dd20c0b1e"
        },
        "date": 1766036846805,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1499.13,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 147,
            "unit": "ms",
            "extra": "count: 8\nmax: 147\np95: 147\nmedian: 34"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6537.51,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 70,
            "unit": "ms",
            "extra": "count: 3\nmax: 70\np95: 70\nmedian: 26"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11668.12,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 395,
            "unit": "ms",
            "extra": "count: 10\nmax: 395\np95: 395\nmedian: 341.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 42.25,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1386.59,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 171,
            "unit": "ms",
            "extra": "count: 5\nmax: 171\np95: 171\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 963.77,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 111,
            "unit": "ms",
            "extra": "count: 9\nmax: 111\np95: 111\nmedian: 45"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2211.77,
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
            "value": 2240.19,
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
            "value": 2059.33,
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
          "id": "4857caba54a3e982ce3ce5f9e2fbb69f308c8665",
          "message": "applying package updates",
          "timestamp": "2026-01-07T15:43:15Z",
          "tree_id": "d040ca79781da3e62bd31295ae112b17d42ef616",
          "url": "https://github.com/iTwin/viewer-components-react/commit/4857caba54a3e982ce3ce5f9e2fbb69f308c8665"
        },
        "date": 1767800955484,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1519.02,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 145,
            "unit": "ms",
            "extra": "count: 9\nmax: 145\np95: 145\nmedian: 34"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6269.8,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 78,
            "unit": "ms",
            "extra": "count: 4\nmax: 78\np95: 78\nmedian: 27"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12007.62,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 385,
            "unit": "ms",
            "extra": "count: 8\nmax: 385\np95: 385\nmedian: 368.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.37,
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
            "value": 1385.11,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 164,
            "unit": "ms",
            "extra": "count: 5\nmax: 164\np95: 164\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 986,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 104,
            "unit": "ms",
            "extra": "count: 9\nmax: 104\np95: 104\nmedian: 55"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2278.2,
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
            "value": 2268.02,
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
            "value": 2154.97,
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
          "id": "17038cf1fbb6f9ec7ccdbdb7c207fb57adde387b",
          "message": "[Tree widget]: Fix query error causing application crash (#1543)\n\n* Fix Be_SQLite_INTERRUPT issue\n\n* Add changeset\n\n* Fix issues\n\n* Prettier\n\n* Remove unused import\n\n* Address comments\n\n* Remove unused import\n\n* Update change/@itwin-tree-widget-react-5a75d3d7-5bb4-4f55-9c0b-d75e633f9ae7.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* change defer to from\n\n* Do not crash application if error happens during visibility button clicks\n\n* Show error state if show all fails in models tree\n\n* Address comment\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2026-01-13T13:08:21+02:00",
          "tree_id": "a15ebf8d14de95b3f95d8b9f251e372b53429b41",
          "url": "https://github.com/iTwin/viewer-components-react/commit/17038cf1fbb6f9ec7ccdbdb7c207fb57adde387b"
        },
        "date": 1768302863764,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1488.19,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 128,
            "unit": "ms",
            "extra": "count: 10\nmax: 128\np95: 128\nmedian: 33.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6252.23,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 78,
            "unit": "ms",
            "extra": "count: 3\nmax: 78\np95: 78\nmedian: 28"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11433.8,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 368,
            "unit": "ms",
            "extra": "count: 9\nmax: 368\np95: 368\nmedian: 321"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 42.97,
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
            "value": 1447.7,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 197,
            "unit": "ms",
            "extra": "count: 7\nmax: 197\np95: 197\nmedian: 30"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 980.01,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 141,
            "unit": "ms",
            "extra": "count: 7\nmax: 141\np95: 141\nmedian: 43"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2310.9,
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
            "value": 2431.1,
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
            "value": 2416.36,
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
          "id": "e515ffb4edc39cd51ac70818015bc5315840d3e8",
          "message": "[tree-widget]: React to breaking Tree/TreeRenderer API changes (#1540)\n\n* React to changes to Tree/TreeRenderer API\n\n* Update to latest version\n\n* change\n\n* cspell\n\n* Rename\n\n* build\n\n* Build",
          "timestamp": "2026-01-13T14:12:14+02:00",
          "tree_id": "9f65df6e8a819b4d4afdbe9d825ba2ea8343e946",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e515ffb4edc39cd51ac70818015bc5315840d3e8"
        },
        "date": 1768306680419,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1554.22,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 167,
            "unit": "ms",
            "extra": "count: 9\nmax: 167\np95: 167\nmedian: 36"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6505.22,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 73,
            "unit": "ms",
            "extra": "count: 5\nmax: 73\np95: 73\nmedian: 24"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11416.84,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 490,
            "unit": "ms",
            "extra": "count: 8\nmax: 490\np95: 490\nmedian: 317.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.71,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1423.8,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 207,
            "unit": "ms",
            "extra": "count: 6\nmax: 207\np95: 207\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 958.08,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 90,
            "unit": "ms",
            "extra": "count: 8\nmax: 90\np95: 90\nmedian: 62"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2283.41,
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
            "value": 2376.26,
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
            "value": 2134.5,
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
          "id": "600c1ab9f97ef5450863866b994d540469a3b521",
          "message": "applying package updates",
          "timestamp": "2026-01-13T12:40:56Z",
          "tree_id": "81104599164942a8d6d06a6341ea220f7a7ba08a",
          "url": "https://github.com/iTwin/viewer-components-react/commit/600c1ab9f97ef5450863866b994d540469a3b521"
        },
        "date": 1768308438604,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1539.08,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 116,
            "unit": "ms",
            "extra": "count: 10\nmax: 116\np95: 116\nmedian: 34"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6023.72,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 95,
            "unit": "ms",
            "extra": "count: 5\nmax: 95\np95: 95\nmedian: 23"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12967.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 410,
            "unit": "ms",
            "extra": "count: 8\nmax: 410\np95: 410\nmedian: 391.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 43.04,
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
            "value": 1536.99,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 194,
            "unit": "ms",
            "extra": "count: 8\nmax: 194\np95: 194\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1142.44,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 107,
            "unit": "ms",
            "extra": "count: 10\nmax: 107\np95: 107\nmedian: 57.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2555.66,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 30,
            "unit": "ms",
            "extra": "count: 1\nmax: 30\np95: 30\nmedian: 30"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2387.52,
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
            "value": 2340.69,
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
          "id": "c4fbd6754af9b1e293c210edb2f0ba4ab4df0c73",
          "message": "Tree widget: Expose tree node type guards (#1548)\n\n* Expose `ClassificationsTreeNode`, `CategoriesTreeNode` and `ModelsTreeNode` namespaces, containing type guards for checking the type of node\n\n* prettier\n\n* fix perf tests\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/categories-tree/CategoriesTreeNode.ts\n\nCo-authored-by: JonasDov <100586436+JonasDov@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/ModelsTreeNode.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n---------\n\nCo-authored-by: JonasDov <100586436+JonasDov@users.noreply.github.com>\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>",
          "timestamp": "2026-01-14T13:36:10+02:00",
          "tree_id": "2d43b92ecb92f595cba5e36c330d3069c4fad055",
          "url": "https://github.com/iTwin/viewer-components-react/commit/c4fbd6754af9b1e293c210edb2f0ba4ab4df0c73"
        },
        "date": 1768390933283,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1446.39,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 152,
            "unit": "ms",
            "extra": "count: 8\nmax: 152\np95: 152\nmedian: 34.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6567.01,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 88,
            "unit": "ms",
            "extra": "count: 7\nmax: 88\np95: 88\nmedian: 24"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11794.35,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 388,
            "unit": "ms",
            "extra": "count: 8\nmax: 388\np95: 388\nmedian: 356.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.16,
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
            "value": 1387.98,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 161,
            "unit": "ms",
            "extra": "count: 5\nmax: 161\np95: 161\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1005.99,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 136,
            "unit": "ms",
            "extra": "count: 7\nmax: 136\np95: 136\nmedian: 64"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2306.73,
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
            "value": 2112.04,
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
            "value": 2338.35,
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
          "id": "e912ca8267801e64a18776f502363902d74fa1f2",
          "message": "applying package updates",
          "timestamp": "2026-01-14T13:07:52Z",
          "tree_id": "017edfca9cd2aceb4696b7467573223ff5023292",
          "url": "https://github.com/iTwin/viewer-components-react/commit/e912ca8267801e64a18776f502363902d74fa1f2"
        },
        "date": 1768396422385,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1511.24,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 147,
            "unit": "ms",
            "extra": "count: 8\nmax: 147\np95: 147\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6678.28,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 76,
            "unit": "ms",
            "extra": "count: 6\nmax: 76\np95: 76\nmedian: 23.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11365.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 348,
            "unit": "ms",
            "extra": "count: 7\nmax: 348\np95: 348\nmedian: 329"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.29,
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
            "value": 1410.7,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 173,
            "unit": "ms",
            "extra": "count: 6\nmax: 173\np95: 173\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 990.57,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 112,
            "unit": "ms",
            "extra": "count: 8\nmax: 112\np95: 112\nmedian: 57.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 1931.33,
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
            "value": 1955.53,
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
            "value": 1891.65,
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
          "id": "fa8a9c68398671154963a094a8777e51215dab17",
          "message": "Cleanup tree widget tests (#1549)",
          "timestamp": "2026-01-15T10:53:07+02:00",
          "tree_id": "0f7636fe0232ee5aaecf8e8e6fcb78c652a3877e",
          "url": "https://github.com/iTwin/viewer-components-react/commit/fa8a9c68398671154963a094a8777e51215dab17"
        },
        "date": 1768467522896,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1468.43,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 145,
            "unit": "ms",
            "extra": "count: 8\nmax: 145\np95: 145\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6292.92,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 62,
            "unit": "ms",
            "extra": "count: 4\nmax: 62\np95: 62\nmedian: 27"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11335.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 346,
            "unit": "ms",
            "extra": "count: 10\nmax: 346\np95: 346\nmedian: 320"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 43.25,
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
            "value": 1352.96,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 172,
            "unit": "ms",
            "extra": "count: 5\nmax: 172\np95: 172\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 957.35,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 86,
            "unit": "ms",
            "extra": "count: 9\nmax: 86\np95: 86\nmedian: 61"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2065.58,
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
            "value": 2183.29,
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
            "value": 1864.15,
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
          "id": "4fcb3a86d8e8cde4bfbc320b76bb004fa15a98b8",
          "message": "Change tests categories tree node creation to use props (#1550)",
          "timestamp": "2026-01-16T15:15:56+02:00",
          "tree_id": "1244740d6481400f1a822db6c67c0f4a36f2f2fe",
          "url": "https://github.com/iTwin/viewer-components-react/commit/4fcb3a86d8e8cde4bfbc320b76bb004fa15a98b8"
        },
        "date": 1768569721259,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1514.64,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 139,
            "unit": "ms",
            "extra": "count: 10\nmax: 139\np95: 139\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 5143.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 78,
            "unit": "ms",
            "extra": "count: 2\nmax: 78\np95: 78\nmedian: 56.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 12372.05,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 411,
            "unit": "ms",
            "extra": "count: 10\nmax: 411\np95: 411\nmedian: 384.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 43.39,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1448.99,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 198,
            "unit": "ms",
            "extra": "count: 4\nmax: 198\np95: 198\nmedian: 29.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 995.09,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 104,
            "unit": "ms",
            "extra": "count: 9\nmax: 104\np95: 104\nmedian: 41"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2339.51,
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
            "value": 2383.44,
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
            "value": 2274.99,
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
          "id": "f79f0093be2e8109d353f481ba46e42497e50e07",
          "message": "Change how sub-category visibility is determined (#1552)\n\n* Change how subCategory visibility is determined\n\n* prettier",
          "timestamp": "2026-01-20T09:55:42+02:00",
          "tree_id": "524c14278fb1d9e7145b0d47d93222eae75c7a73",
          "url": "https://github.com/iTwin/viewer-components-react/commit/f79f0093be2e8109d353f481ba46e42497e50e07"
        },
        "date": 1768896107616,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1532.77,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 149,
            "unit": "ms",
            "extra": "count: 8\nmax: 149\np95: 149\nmedian: 36"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 5813.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 67,
            "unit": "ms",
            "extra": "count: 4\nmax: 67\np95: 67\nmedian: 26"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11695.91,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 359,
            "unit": "ms",
            "extra": "count: 11\nmax: 359\np95: 359\nmedian: 266"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.59,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1418.27,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 188,
            "unit": "ms",
            "extra": "count: 4\nmax: 188\np95: 188\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 968.95,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 113,
            "unit": "ms",
            "extra": "count: 9\nmax: 113\np95: 113\nmedian: 42"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2296.16,
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
            "value": 2299.61,
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
            "value": 2223.25,
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
          "id": "271bc6818534c4b7f45362070e989a844d04c5ec",
          "message": "[Tree widget]: Add searched categories tree tests (#1554)\n\n* Add searched categories tree tests\n\n* Prettier\n\n* Update packages/itwin/tree-widget/src/test/trees/categories-tree/internal/CategoriesTreeVisibilityHandler.test.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Add comments\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2026-01-21T11:06:54+02:00",
          "tree_id": "f37528b2241f60efd1fe08523ac245a69417043e",
          "url": "https://github.com/iTwin/viewer-components-react/commit/271bc6818534c4b7f45362070e989a844d04c5ec"
        },
        "date": 1768986742110,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1523.85,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 175,
            "unit": "ms",
            "extra": "count: 8\nmax: 175\np95: 175\nmedian: 44.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 4172.53,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 65,
            "unit": "ms",
            "extra": "count: 1\nmax: 65\np95: 65\nmedian: 65"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 9123.01,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 320,
            "unit": "ms",
            "extra": "count: 8\nmax: 320\np95: 320\nmedian: 236.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 42.3,
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
            "value": 1348.4,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 154,
            "unit": "ms",
            "extra": "count: 3\nmax: 154\np95: 154\nmedian: 30"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 919.72,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 84,
            "unit": "ms",
            "extra": "count: 7\nmax: 84\np95: 84\nmedian: 58"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 1920.43,
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
            "value": 1898.86,
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
            "value": 1886.45,
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
          "id": "998efcb0307bea57b394c7defc218d8254762d39",
          "message": "[tree-widget] Bump hierarchies-react and StrataKit dependencies (#1557)\n\n* Bump dependencies\n\n* change\n\n* Bump one more time\n\n* prettier\n\n* Update change/@itwin-tree-widget-react-0612ba1a-1768-4800-afe7-ba5fd23c737f.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Cleanup\n\n* Bump\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2026-01-23T10:53:19+02:00",
          "tree_id": "aa4ab26b0ed146220e16ce4ce0b99b6a210248ad",
          "url": "https://github.com/iTwin/viewer-components-react/commit/998efcb0307bea57b394c7defc218d8254762d39"
        },
        "date": 1769158772367,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1552.11,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 129,
            "unit": "ms",
            "extra": "count: 8\nmax: 129\np95: 129\nmedian: 42.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6405.63,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 87,
            "unit": "ms",
            "extra": "count: 11\nmax: 87\np95: 87\nmedian: 26"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11924.05,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 397,
            "unit": "ms",
            "extra": "count: 14\nmax: 397\np95: 397\nmedian: 44.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 38.14,
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
            "value": 1499.78,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 219,
            "unit": "ms",
            "extra": "count: 5\nmax: 219\np95: 219\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1044,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 91,
            "unit": "ms",
            "extra": "count: 8\nmax: 91\np95: 91\nmedian: 73"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2392.13,
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
            "value": 2294.6,
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
            "value": 2327.91,
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
          "id": "dbe5f157aea032771b8c9ff32cd9cfa512ac86b3",
          "message": "[Tree widget]: Adjust sub-categories visibility handling (#1559)",
          "timestamp": "2026-01-23T15:59:43+02:00",
          "tree_id": "5e76d11c2134f030a65ffb101d74a0f31ce08e12",
          "url": "https://github.com/iTwin/viewer-components-react/commit/dbe5f157aea032771b8c9ff32cd9cfa512ac86b3"
        },
        "date": 1769177134716,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1509.74,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 140,
            "unit": "ms",
            "extra": "count: 8\nmax: 140\np95: 140\nmedian: 35.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 5183.46,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 67,
            "unit": "ms",
            "extra": "count: 5\nmax: 67\np95: 67\nmedian: 24"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10880.15,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 354,
            "unit": "ms",
            "extra": "count: 10\nmax: 354\np95: 354\nmedian: 256.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 44.99,
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
            "value": 1371.52,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 169,
            "unit": "ms",
            "extra": "count: 6\nmax: 169\np95: 169\nmedian: 30.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 949.42,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 93,
            "unit": "ms",
            "extra": "count: 9\nmax: 93\np95: 93\nmedian: 51"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 1987.27,
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
            "value": 2001.24,
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
            "value": 1892.76,
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
          "id": "25fd7c963d26efae920eb16c85efc6d937712ffe",
          "message": "[Tree widget]: Fix element visibility ignoring children elements in `next` (#1558)\n\n* Add children visibility controls\n\n* Remove unused function\n\n* Remove package.json changes\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeNodeInternal.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeNodeInternal.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNodeInternal.ts\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\n\n* Unify getParentElementsIdsPath\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/common/internal/Utils.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/common/internal/Utils.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Address comments\n\n* Update links\n\n* Remove redundant code\n\n---------\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2026-01-26T17:10:07+02:00",
          "tree_id": "7c4002afa15f5c1d34efd5f89bd1e6caa923df98",
          "url": "https://github.com/iTwin/viewer-components-react/commit/25fd7c963d26efae920eb16c85efc6d937712ffe"
        },
        "date": 1769440618804,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1549.04,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 132,
            "unit": "ms",
            "extra": "count: 9\nmax: 132\np95: 132\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6359.93,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 81,
            "unit": "ms",
            "extra": "count: 7\nmax: 81\np95: 81\nmedian: 24"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 11508.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 399,
            "unit": "ms",
            "extra": "count: 8\nmax: 399\np95: 399\nmedian: 298"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.34,
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
            "value": 1514.59,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 190,
            "unit": "ms",
            "extra": "count: 5\nmax: 190\np95: 190\nmedian: 33"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1108.04,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 155,
            "unit": "ms",
            "extra": "count: 8\nmax: 155\np95: 155\nmedian: 60.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2366.39,
            "unit": "ms"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 24,
            "unit": "ms",
            "extra": "count: 1\nmax: 24\np95: 24\nmedian: 24"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements",
            "value": 2550.04,
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
            "value": 2445.58,
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
          "id": "5af55f6b89cc4ad31f26589c02b92415d8d05ff1",
          "message": "[Tree widget]: Fix visibility handling for nodes which are in search paths and have search target ancestors. (#1568)\n\n* [Tree widget]: Fix visibility handling for nodes which are in search paths and have search target ancestors\n\n* Make childrenCount optional",
          "timestamp": "2026-01-28T12:10:14+02:00",
          "tree_id": "d314f3a395b8c06735a99cc8aee3c3516579fba4",
          "url": "https://github.com/iTwin/viewer-components-react/commit/5af55f6b89cc4ad31f26589c02b92415d8d05ff1"
        },
        "date": 1769595395620,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1498.96,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 137,
            "unit": "ms",
            "extra": "count: 8\nmax: 137\np95: 137\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 4733.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 71,
            "unit": "ms",
            "extra": "count: 2\nmax: 71\np95: 71\nmedian: 49.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 9623.84,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 327,
            "unit": "ms",
            "extra": "count: 10\nmax: 327\np95: 327\nmedian: 247.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.26,
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
            "value": 1349.98,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 162,
            "unit": "ms",
            "extra": "count: 5\nmax: 162\np95: 162\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 931.35,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 117,
            "unit": "ms",
            "extra": "count: 9\nmax: 117\np95: 117\nmedian: 47"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2053.81,
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
            "value": 2133.8,
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
            "value": 2137.94,
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
          "id": "d032b21cc8f8dca21133c3af22f829b1b90bb7af",
          "message": "[Tree widget]: Move caches under common folder (#1570)",
          "timestamp": "2026-01-29T10:24:23+02:00",
          "tree_id": "ef0143b10c737c634faed9278922bb5a8e6c87fd",
          "url": "https://github.com/iTwin/viewer-components-react/commit/d032b21cc8f8dca21133c3af22f829b1b90bb7af"
        },
        "date": 1769675441126,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1550.13,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 155,
            "unit": "ms",
            "extra": "count: 8\nmax: 155\np95: 155\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6491.13,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 72,
            "unit": "ms",
            "extra": "count: 4\nmax: 72\np95: 72\nmedian: 23"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10400.77,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 365,
            "unit": "ms",
            "extra": "count: 9\nmax: 365\np95: 365\nmedian: 263"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.91,
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
            "value": 1466.68,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 160,
            "unit": "ms",
            "extra": "count: 5\nmax: 160\np95: 160\nmedian: 31"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1032.44,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 99,
            "unit": "ms",
            "extra": "count: 8\nmax: 99\np95: 99\nmedian: 72"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2170.51,
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
            "value": 2175.22,
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
            "value": 2288.34,
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
          "id": "c30bf8823245ac3b0a84d48a85e8eddc6f1dd760",
          "message": "[Tree widget]: Add sub-categories cache (#1571)",
          "timestamp": "2026-01-29T11:04:34+02:00",
          "tree_id": "cb5690c33c079e3f9a10a82bc4c0421fa759adbf",
          "url": "https://github.com/iTwin/viewer-components-react/commit/c30bf8823245ac3b0a84d48a85e8eddc6f1dd760"
        },
        "date": 1769677864016,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1451.42,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 143,
            "unit": "ms",
            "extra": "count: 8\nmax: 143\np95: 143\nmedian: 32.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 4886.66,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 64,
            "unit": "ms",
            "extra": "count: 1\nmax: 64\np95: 64\nmedian: 64"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 9882.77,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 318,
            "unit": "ms",
            "extra": "count: 8\nmax: 318\np95: 318\nmedian: 242.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.3,
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
            "value": 1412.16,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 149,
            "unit": "ms",
            "extra": "count: 6\nmax: 149\np95: 149\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1041.84,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 100,
            "unit": "ms",
            "extra": "count: 9\nmax: 100\np95: 100\nmedian: 66"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2207.09,
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
            "value": 2497.02,
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
            "value": 2657.61,
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
          "id": "0d12cd565703571e8bc090a646e980a38f54ea91",
          "message": "[Tree widget]: Add modeled elements cache (#1572)\n\n* [Tree widget]: Add modeled elements cache\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/common/internal/caches/ModeledElementsCache.ts\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>",
          "timestamp": "2026-01-29T11:47:46Z",
          "tree_id": "b258a68e49c9e07671aae82645036a52cbb46061",
          "url": "https://github.com/iTwin/viewer-components-react/commit/0d12cd565703571e8bc090a646e980a38f54ea91"
        },
        "date": 1769687654969,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1466.2,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 144,
            "unit": "ms",
            "extra": "count: 10\nmax: 144\np95: 144\nmedian: 33.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 4742.07,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 66,
            "unit": "ms",
            "extra": "count: 1\nmax: 66\np95: 66\nmedian: 66"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10088.22,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 318,
            "unit": "ms",
            "extra": "count: 8\nmax: 318\np95: 318\nmedian: 254.5"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.7,
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
            "value": 1423.64,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 173,
            "unit": "ms",
            "extra": "count: 4\nmax: 173\np95: 173\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1040.13,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 116,
            "unit": "ms",
            "extra": "count: 9\nmax: 116\np95: 116\nmedian: 64"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2211.28,
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
            "value": 2200.85,
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
            "value": 2309.82,
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
          "id": "fb5f759a53d60ce63bc4727863d8692a3d3e91f3",
          "message": "[Tree widget]: Adjust classifications tree to allow only 3d elements (#1579)\n\n* [Tree widget]: Adjust classifications tree ids cache to allow only 3d elements\n\n* Extract api\n\n* Address comments",
          "timestamp": "2026-02-03T11:06:47+02:00",
          "tree_id": "abd7a2a6f65d07765b2ef514c9b299ea7fc2abc0",
          "url": "https://github.com/iTwin/viewer-components-react/commit/fb5f759a53d60ce63bc4727863d8692a3d3e91f3"
        },
        "date": 1770110038141,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1493.65,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 151,
            "unit": "ms",
            "extra": "count: 9\nmax: 151\np95: 151\nmedian: 35"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 5789.95,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 78,
            "unit": "ms",
            "extra": "count: 2\nmax: 78\np95: 78\nmedian: 51.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10251.23,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 350,
            "unit": "ms",
            "extra": "count: 9\nmax: 350\np95: 350\nmedian: 274"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 42.57,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1140.8,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 153,
            "unit": "ms",
            "extra": "count: 6\nmax: 153\np95: 153\nmedian: 31.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 971.71,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 98,
            "unit": "ms",
            "extra": "count: 8\nmax: 98\np95: 98\nmedian: 63"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2379.25,
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
            "value": 2214.51,
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
            "value": 2580.16,
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
          "id": "7ed6506e621a1dbc89ea4f7c4d1d5e0a581d76d3",
          "message": "[Tree widget]: Adjust useTree hooks to not recreate caches  when switching views (#1578)\n\n* [Tree widget]: Adjust useTree hooks to not recreate caches  when switching views\n\n* Adjust to change only categories tree\n\n* Remove test code, update changeset comment\n\n* Remove unused code\n\n* Update change/@itwin-tree-widget-react-538fa8c8-63c6-45b9-948f-225f360454b0.json\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/categories-tree/UseCategoriesTree.tsx\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\n\n* Remove \"other\" from useCategoriesTreeIdsCache.activeViewType\n\n* Update packages/itwin/tree-widget/src/tree-widget-react/components/trees/categories-tree/UseCategoriesTree.tsx\n\nCo-authored-by: Saulius Skliutas <24278440+saskliutas@users.noreply.github.com>\n\n* Address comment\n\n* Address comments\n\n---------\n\nCo-authored-by: Grigas <35135765+grigasp@users.noreply.github.com>\nCo-authored-by: Saulius Skliutas <24278440+saskliutas@users.noreply.github.com>",
          "timestamp": "2026-02-05T08:22:47Z",
          "tree_id": "0886120cf9e2f3a4a9aef3d846096a20a138bc9f",
          "url": "https://github.com/iTwin/viewer-components-react/commit/7ed6506e621a1dbc89ea4f7c4d1d5e0a581d76d3"
        },
        "date": 1770280162246,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1495.13,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 135,
            "unit": "ms",
            "extra": "count: 10\nmax: 135\np95: 135\nmedian: 32"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 4982.45,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 74,
            "unit": "ms",
            "extra": "count: 2\nmax: 74\np95: 74\nmedian: 48.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10732.89,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 347,
            "unit": "ms",
            "extra": "count: 9\nmax: 347\np95: 347\nmedian: 265"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 47.13,
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
            "value": 1151.12,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 140,
            "unit": "ms",
            "extra": "count: 4\nmax: 140\np95: 140\nmedian: 32"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 998.06,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 124,
            "unit": "ms",
            "extra": "count: 6\nmax: 124\np95: 124\nmedian: 64.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2253.68,
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
            "value": 2414.66,
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
            "value": 2534.93,
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
          "id": "f05f8efbe449f5615d5843d04068ea6ae5390b2a",
          "message": "[Tree widget]: Add element model categories cache (#1584)",
          "timestamp": "2026-02-05T14:11:02+02:00",
          "tree_id": "f54e6e8e7d2e2e840e74ab81c7eab1d4f0167249",
          "url": "https://github.com/iTwin/viewer-components-react/commit/f05f8efbe449f5615d5843d04068ea6ae5390b2a"
        },
        "date": 1770293855976,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1453.7,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 169,
            "unit": "ms",
            "extra": "count: 10\nmax: 169\np95: 169\nmedian: 31.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 6141.41,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 70,
            "unit": "ms",
            "extra": "count: 5\nmax: 70\np95: 70\nmedian: 23"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10388.74,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 337,
            "unit": "ms",
            "extra": "count: 9\nmax: 337\np95: 337\nmedian: 253"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 40.85,
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
            "value": 1053.04,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 119,
            "unit": "ms",
            "extra": "count: 5\nmax: 119\np95: 119\nmedian: 30"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 939.1,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 116,
            "unit": "ms",
            "extra": "count: 8\nmax: 116\np95: 116\nmedian: 46.5"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2025,
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
            "value": 2300.64,
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
            "value": 2172.57,
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
          "id": "3795ec39da52e91960bac143b8d3b7ed3ee09666",
          "message": "Models & Categories tree: use cached category ids to query model children. (#1586)",
          "timestamp": "2026-02-05T15:00:34+02:00",
          "tree_id": "f748b100e518f8ba61368ab03fd6e72652d83191",
          "url": "https://github.com/iTwin/viewer-components-react/commit/3795ec39da52e91960bac143b8d3b7ed3ee09666"
        },
        "date": 1770296832299,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "categories tree creates initial filtered view for 50k items",
            "value": 1529,
            "unit": "ms"
          },
          {
            "name": "categories tree creates initial filtered view for 50k items (P95 of main thread blocks)",
            "value": 135,
            "unit": "ms",
            "extra": "count: 11\nmax: 135\np95: 135\nmedian: 33"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories",
            "value": 4948.34,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k subCategories (P95 of main thread blocks)",
            "value": 71,
            "unit": "ms",
            "extra": "count: 2\nmax: 71\np95: 71\nmedian: 47.5"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories",
            "value": 10665.39,
            "unit": "ms"
          },
          {
            "name": "categories tree changing definition container visibility changes visibility for 50k categories (P95 of main thread blocks)",
            "value": 343,
            "unit": "ms",
            "extra": "count: 9\nmax: 343\np95: 343\nmedian: 287"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications",
            "value": 41.44,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads initial view for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 22,
            "unit": "ms",
            "extra": "count: 1\nmax: 22\np95: 22\nmedian: 22"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications",
            "value": 1102.36,
            "unit": "ms"
          },
          {
            "name": "classifications tree loads first branch for iModel with 50k classifications (P95 of main thread blocks)",
            "value": 123,
            "unit": "ms",
            "extra": "count: 6\nmax: 123\np95: 123\nmedian: 30.5"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items",
            "value": 1005.69,
            "unit": "ms"
          },
          {
            "name": "models tree creates initial filtered view for 50k target items (P95 of main thread blocks)",
            "value": 92,
            "unit": "ms",
            "extra": "count: 7\nmax: 92\np95: 92\nmedian: 72"
          },
          {
            "name": "models tree changing model visibility changes visibility for 50k elements",
            "value": 2349.02,
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
            "value": 2681.25,
            "unit": "ms"
          },
          {
            "name": "models tree changing category visibility changes visibility for 50k elements (P95 of main thread blocks)",
            "value": 118,
            "unit": "ms",
            "extra": "count: 1\nmax: 118\np95: 118\nmedian: 118"
          },
          {
            "name": "models tree changing per-model-category override changes visibility for 50k elements",
            "value": 2427.23,
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