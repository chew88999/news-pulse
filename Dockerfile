# The full interactive News Pulse app (date picker, crawl button, Check a link) in one container:
# OpenCode + the web server, started by scripts/start-cloud.mjs.
# Needs OPENCODE_GO_API_KEY at run time; see render.yaml and README "Hosting the full app".
FROM node:22-slim

# git and CA certificates for OpenCode (project detection and HTTPS to OpenCode Go).
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@1.19.3 && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
# Includes devDependencies on purpose: the server runs TypeScript through tsx.
RUN npm ci && npm cache clean --force
COPY . .

ENV HOST=0.0.0.0 PORT=10000
EXPOSE 10000
CMD ["node", "scripts/start-cloud.mjs"]
