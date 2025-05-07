window.BENCHMARK_DATA = {
  "lastUpdate": 1746638213405,
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
      }
    ]
  }
}