#!/usr/bin/python3
import subprocess
import shlex
import pathlib
import sys
# print(sys.path)
if not pathlib.Path("rsyncd.conf").exists():
	with open("rsyncd.conf", "w") as f:
		f.write("use chroot = no\n\n[git]\n\tpath = " + sys.path[0])
		f.flush()
subprocess.call(shlex.split('rsync --daemon -v --no-detach --port=19246 --config=rsyncd.conf'))
