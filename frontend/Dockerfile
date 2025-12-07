# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
# A wildcard is used for package-lock.json to support both npm and pnpm
COPY package.json ./
COPY package-lock.json* ./

# Install dependencies
# Use --frozen-lockfile to ensure we use the exact versions from the lockfile
RUN npm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 5173

# The command to run the app
CMD ["npm", "run", "dev", "--", "--host"]
