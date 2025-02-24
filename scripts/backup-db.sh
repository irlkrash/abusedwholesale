
#!/bin/bash

# Get current timestamp
timestamp=$(date +%Y%m%d_%H%M%S)
backup_dir="backups"
mkdir -p "$backup_dir"
backup_file="$backup_dir/backup_${timestamp}.sql"

echo "Creating database backup..."
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

pg_dump "$DATABASE_URL" > "$backup_file" && echo "Backup created at: $backup_file" || echo "Backup failed"

echo "Backup created: $backup_file"
