#!/bin/bash
set -e

RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123"}')

TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Error: Could not get token. Is the server running on port 3000?" >&2
  echo "Response: $RESPONSE" >&2
  exit 1
fi

echo "$TOKEN"
