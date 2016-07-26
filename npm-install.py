#!/usr/bin/python3
import subprocess
import shlex
import pathlib
import sys
import json
NPM = "/home/ssyp/.npm/"
def available(name, request, shift):
    pdir = NPM + name + "/"
    if not pathlib.Path(pdir).exists():
        print(shift+"Dependency dir not found")
        return False
    versions = []
    count = 0
    last = None
    for i in pathlib.Path(pdir).iterdir():
        versions.append(i.name)
        count += 1
        last = i.name
    if count <= 1:
        return last
    versions = sorted(versions)
    versions = '; '.join(versions)
    print(shift+"[" + name + "] Requested: "+request)
    while True:
        ver = input(shift+versions+' :=> ')
        if pathlib.Path(pdir + ver).exists():
            return ver
        else:
            print(shift+"Not found!")

def install(name, version, basePath, shift=''):
    print(shift+"["+name+"@"+version+'] install')
    pdir = NPM + name + "/" + version + "/"
    if not pathlib.Path(pdir).exists():
        print(shift+"Dir not found")
        return False
    pjson = pdir + "package/package.json"
    ptar = pdir + "package.tgz" 
    if not pathlib.Path(pjson).exists():
        print(shift+"JSON Not found")
        return False
    if not pathlib.Path(pjson).exists():
        print(shift+"TGZ Not found")
        return False
    subprocess.call(shlex.split('mkdir -p '+basePath+name))
    js = json.load(open(pjson, 'r'))
    deps = dict()
    if 'dependencies' in js:
        deps = js['dependencies']
        # print(shift+"Dependencies:")
        # print(shift+str(deps))
    target = basePath + name + "/"
    if len(deps) > 0:
        depDir = target + "node_modules/"
        subprocess.call(shlex.split('mkdir -p '+depDir))
        for k, v in deps.items():
            depVersion = available(k, v, shift+'  ')
            if not install(k, depVersion, depDir, shift+'  '):
                print(shift+"Depedency failed")
    cmd = 'tar -xzf '+ptar + ' -C '+target
    out = subprocess.getoutput(cmd)
    if len(out) > 0:
        print(out)
    cmd = 'mv -t "'+target[:-1]+'" '+target+'package/*'
    out = subprocess.getoutput(cmd)
    if len(out) > 0:
        print(out)
    cmd = 'rm -rf "'+target+'package/"'
    out = subprocess.getoutput(cmd)
    if len(out) > 0:
        print(out)
    return True

name = input('module name :=> ')
version = available(name, '...', '')
install(name, version, 'node_modules/')