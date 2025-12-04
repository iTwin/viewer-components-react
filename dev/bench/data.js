window.BENCHMARK_DATA = {
  "lastUpdate": 1764860102631,
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
      }
    ]
  }
}