# Server architecture spec

## Clone
1. copy all objects via rsync
2. download config, setup things

## Pull
1. Sync all objects via rsync
2. Download config, search for changes, apply changes

## Push
1. Client connects to /push endpoint, sends JSON with modifications
2. Server estabilishes connection with rsync to sync new objects, if any
3. Server applies modifications to config

### Push JSON
Only new or modified commits and refs with all their data are pushed. Modification is detected by quick config fetch and comparison.

```json
{
    "commits": {
        "hash": [data]
    },
    "refs": {
        "name": [data]
    }
}
```