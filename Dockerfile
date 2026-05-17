FROM node:20-slim

# Install Python3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create Python venv and install ReportLab
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install reportlab pillow

WORKDIR /app

# Copy package files and install Node deps
COPY package*.json ./
RUN npm install --only=production

# Copy app files
COPY . .

# Download Bar Cop logo at build time
RUN wget -q "https://cdn.shopify.com/s/files/1/1507/5436/files/AUDIT_LOGO_KEEP.png?v=1779028817" \
    -O /app/server/audits/logo.png || echo "Logo download failed, will retry at runtime"

EXPOSE 3000

CMD ["node", "server/index.js"]
