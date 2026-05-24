#!/usr/bin/env bash
# Helper to build and run locally for testing
set -euo pipefail
IMAGE=bridgemind-local

echo "Building image..."
docker build -t $IMAGE ..

echo "Run with: docker run -p 8080:8080 --env GEMINI_API_KEY=your_key $IMAGE"
