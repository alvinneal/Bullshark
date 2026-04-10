import os
import zipfile
from pathlib import Path

# Define project root and output path
project_root = Path("/vercel/share/v0-project")
output_zip = project_root / "bullshark-project.zip"

# Files and directories to exclude
exclude_dirs = {".next", "node_modules", ".git", ".env.local", "dist", "build"}
exclude_files = {".env", ".env.local", ".DS_Store"}

def should_exclude(path: Path, relative_to: Path) -> bool:
    """Check if a path should be excluded from the zip."""
    parts = path.relative_to(relative_to).parts
    
    # Check if any part of the path is in exclude_dirs
    for part in parts:
        if part in exclude_dirs:
            return True
    
    # Check if filename is in exclude_files
    if path.name in exclude_files:
        return True
    
    return False

# Create the zip file
with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(project_root):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            file_path = Path(root) / file
            
            if not should_exclude(file_path, project_root):
                arcname = file_path.relative_to(project_root)
                zipf.write(file_path, arcname)
                print(f"Added: {arcname}")

print(f"\n✓ Zip file created successfully: {output_zip}")
print(f"Size: {os.path.getsize(output_zip) / (1024*1024):.2f} MB")
