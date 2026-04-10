#!/bin/bash
cd /vercel/share/v0-project
zip -r bullshark-project.zip . -x "node_modules/*" ".next/*" ".git/*" "*.log"
echo "Zip file created: bullshark-project.zip"
ls -lh bullshark-project.zip
