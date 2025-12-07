#!/bin/bash
echo "Stopping any existing containers..."
docker-compose -f docker-compose.prod.yml down

echo "Building and starting production containers..."
# --build ensures we rebuild the images (important for the frontend build arg)
docker-compose -f docker-compose.prod.yml up -d --build

echo "============================================"
echo "Deployment Complete!"
echo "Your application should now be accessible at:"
echo "http://38.60.91.23"
echo "============================================"
