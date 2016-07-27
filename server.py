#!/usr/bin/python3
import subprocess
import shlex
import pathlib
import sys
# print(sys.path)
if not pathlib.Path("rsyncd.conf").exists():
	with open("rsyncd.conf", "w") as f:
		cwd = sys.path[0]
		f.write("use chroot = no\nread only = no\n\n[jerk]\n\tpath = "+cwd+"\n\tcomment = JERK repository")
		f.flush()
subprocess.call(shlex.split('rsync --daemon -v --no-detach --port=19246 --config=rsyncd.conf'))
