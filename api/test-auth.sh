#!/bin/bash

echo "==================================="
echo "Testing Better Auth Authentication"
echo "==================================="
echo ""

# Test 1: Sign in
echo "1. Testing Sign In..."
curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}' \
  -c /tmp/cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" | jq '.' 2>/dev/null || echo "Response received"

echo ""
echo "2. Testing Session Check..."
curl -s -X GET http://localhost:3000/api/auth/session \
  -b /tmp/cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" | jq '.' 2>/dev/null || echo "Response received"

echo ""
echo "3. Testing Protected Route (Dashboard)..."
curl -s -X GET http://localhost:3000/api/dashboard/stats \
  -b /tmp/cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" | jq '.' 2>/dev/null || echo "Response received"

echo ""
echo "==================================="
echo "Test Complete!"
echo "==================================="
