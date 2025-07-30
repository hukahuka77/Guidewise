# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Install WeasyPrint system dependencies
# We add --no-install-recommends to reduce the image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    pango1.0-tools \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Set environment variable for the API key (will be passed during 'docker run')
ENV OPENAI_API_KEY=""

# Command to run the application
CMD ["python", "main.py"]
