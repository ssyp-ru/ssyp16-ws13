#!/usr/bin/python3
import pathlib
import json

out = ""
for i in pathlib.Path('node_modules').iterdir():
    pdir = 'node_modules/'+i.name+'/'
    pjson = pdir + "package.json"
    if not pathlib.Path(pjson).exists():
        print("["+i.name+"] JSON Not found")
    js = json.load(open(pjson, 'r'))
    out += ('"' + i.name + '": ')
    out += ('"^' + js['version'] + '",\n')
print(out)