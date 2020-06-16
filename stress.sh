#!/bin/bash
echo "Bash version ${BASH_VERSION}"
for i in {1..5000}
do
    echo "Attempt $i..."
    # --no-keepalive
    curl --no-keepalive --connect-timeout 5 -k -v --silent -o /dev/nul $1
done