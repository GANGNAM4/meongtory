# FROM python:3.9-slim

# RUN apt-get update && apt-get install -y \
#     libpq-dev \
#     gcc \
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# WORKDIR /app

# RUN pip install --upgrade pip

# COPY requirements.txt .
# RUN pip install -r requirements.txt --timeout=120 --retries=10


# COPY . .

# EXPOSE 9000

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000", "--reload"]

FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install -r requirements.txt --timeout=120 --retries=10

COPY . .

# Pre-download models (commented out due to network issues)
# RUN python -c "from transformers import CLIPModel, CLIPProcessor; CLIPModel.from_pretrained('openai/clip-vit-base-patch32'); CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')"

EXPOSE 9000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000", "--reload"]