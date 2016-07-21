#!/bin/bash

rsync --daemon --no-detach -v --port=12345 --config=./rsyncd.conf 
