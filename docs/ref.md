# Ref
Ref names are rejected if:

* it has double dots "..", or
* it has ASCII control character, "^", ":" or SP, anywhere, or
* it has a "/".
* it ends with ".lock"
* it contains a "\\" (backslash)

## Ref examples:
* master <= branch named "master"
* feature-238 <= branch named "feature-238"
* HEAD <= last commit on the current branch
* HEAD~3 <= commit 3 commits ago on the current branch
* dev~1 <= commit 1 commits ago on "dev" branch
* v1.0 <= tag named "v1.0"

Note, that branch and tag systems are very similar (both are refs and stored together), so if one tag is named "v1.0", no branch or other tags can be named alike.
