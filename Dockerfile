FROM node:20-bookworm-slim

WORKDIR /opt/render/project/src

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python and build tools so we can run the FastAPI app side-by-side
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY pyproject.toml uv.lock ./

RUN npm ci && npm run prisma:generate

# Install Python runtime dependencies from the project's lockfile into a
# virtualenv to avoid PEP 668 issues and prevent dependency drift.
RUN python3 -m venv "$VIRTUAL_ENV" \
  && pip install --no-cache-dir uv \
  && uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY analytics ./analytics
COPY tools ./tools
COPY scripts ./scripts

ENV APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

# Ensure the render start script is executable and use it as the container CMD
RUN chmod +x scripts/render-start.sh

CMD ["./scripts/render-start.sh"]
