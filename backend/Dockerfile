FROM python:3.11-slim
WORKDIR /app

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
WORKDIR /app/app

EXPOSE 8000
CMD ["python", "server.py"]