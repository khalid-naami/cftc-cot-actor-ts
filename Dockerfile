FROM apify/actor-node:20

# Copy package files and install dependencies
COPY package*.json ./
RUN npm --quiet set progress=false \
    && npm install --only=prod --no-optional \
    && echo "Installed production dependencies"

# Install dev dependencies to build TypeScript
RUN npm install --only=dev --no-optional \
    && echo "Installed dev dependencies"

# Copy source code and build project
COPY . ./
RUN npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production

# Run the compiled Actor
CMD ["npm", "start"]
