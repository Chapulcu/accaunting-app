#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file with your Supabase credentials."
    echo "You can copy .env.example: cp .env.example .env"
    echo "If you are using local Supabase, run 'npx supabase start' to get the URL and Anon Key."
    exit 1
fi

# Check if Supabase is running (optional check, assuming npx is available)
echo "Checking Supabase status..."
if npx supabase status > /dev/null 2>&1; then
    echo "Supabase local instance is running."
else
    echo "Warning: Supabase local instance might not be running."
    echo "Please run 'npx supabase start' if you haven't already."
fi

# Build and start the frontend container
echo "Building and starting frontend container..."
docker-compose up -d --build

echo "Deployment complete!"
echo "Frontend is accessible at http://localhost:8080"
