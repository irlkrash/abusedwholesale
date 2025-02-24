
#!/bin/bash

# Get current timestamp
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="backup_${timestamp}.sql"

echo "Creating database backup..."
pg_dump "$DATABASE_URL" > "$backup_file"

echo "Backup created: $backup_file"
