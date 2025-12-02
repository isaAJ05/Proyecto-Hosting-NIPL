FROM python:3.11-slim
WORKDIR /app

# Copy requirements and install
COPY requirements.txt ./ 
RUN pip install --no-cache-dir -r requirements.txt
# Install git and minimal tools needed for cloning repositories inside the container
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates openssh-client && \
    rm -rf /var/lib/apt/lists/*

# Copy application code
COPY app/ ./app/
COPY .env /app/.env
WORKDIR /app/app

EXPOSE 8000
CMD ["python", "server.py"]