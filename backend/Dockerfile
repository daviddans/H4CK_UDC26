FROM python:3.12-slim

# Upgrade pip as root initially
RUN pip install --upgrade pip --no-cache-dir

# Create a non-root user and switch to it
RUN useradd -m appuser
USER appuser

WORKDIR /home/appuser

# Copy requirements first (leverages Docker cache)
# Ensure ownership is correct for the non-root user
COPY --chown=appuser:appuser requirements.txt requirements.txt

# Install dependencies as the non-root user into the user site-packages
# Use --user because we don't have write access to global site-packages as 'appuser'
RUN pip install --user --no-cache-dir -r requirements.txt

# Add user's local bin to PATH (important!)
ENV PATH="/home/appuser/.local/bin:${PATH}"

# Copy the rest of the application code
COPY --chown=appuser:appuser src/ ./src

USER root
RUN apt-get update && apt-get install -y curl zstd && curl -fsSL https://ollama.com/install.sh | sh
 
USER appuser

CMD ["sh", "-c", "ollama serve & sleep 5 && ollama run qwen2.5:7b-instruct & python3 -m uvicorn src.endpoint:app --reload"]
