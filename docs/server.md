# Server architecture spec

## Clone
1. Copy all objects via rsync
2. Download config, setup things

## Pull
1. Sync all objects via rsync
2. Download config, search for changes, apply changes

## Push
1. Client downloads config, ensures fast-forward, collects all new commits or refs modifications
2. Client connects to /push endpoint, sends JSON with modifications
3. Server applies modifications to config
4. Client syncs objects via rsync

### Push JSON
Only new commits and refs with all their data are pushed. Modification is detected by quick config fetch and comparison.

```json
{
    "revision": 10,
    "commits": {
        "hash": [data]
    },
    "refs": {
        "name": [data]
    }
}
```