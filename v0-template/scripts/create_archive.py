#!/usr/bin/env python3
import zipfile
import os
from pathlib import Path

project_dir = Path('/vercel/share/v0-project')
output_file = project_dir / 'bullshark-project.zip'

# Directories and files to exclude
exclude_patterns = {
    'node_modules',
    '.next',
    '.git',
    '.env.local',
    '.env.development.local',
    'scripts',
    '__pycache__',
    '.pytest_cache',
    '*.log',
    '.DS_Store'
}

def should_exclude(file_path, relative_path):
    """Check if file should be excluded from zip"""
    parts = relative_path.split(os.sep)
    for part in parts:
        if part in exclude_patterns or part.endswith('.log'):
            return True
    return False

try:
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(project_dir):
            # Filter directories
            dirs[:] = [d for d in dirs if d not in exclude_patterns and not d.startswith('.')]
            
            for file in files:
                file_path = Path(root) / file
                relative_path = file_path.relative_to(project_dir)
                
                if not should_exclude(file_path, str(relative_path)):
                    zipf.write(file_path, arcname=f'bullshark-project/{relative_path}')
    
    file_size = output_file.stat().st_size
    print(f'Successfully created: {output_file}')
    print(f'File size: {file_size:,} bytes ({file_size / (1024*1024):.2f} MB)')
    print(f'Download from: {output_file}')
    
except Exception as e:
    print(f'Error creating zip: {e}')
    exit(1)
