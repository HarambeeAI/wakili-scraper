FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scraper.py .

# Storage mounts at /data — Railway volume will be attached here
ENV OUTPUT_DIR=/data/kenyalaw
ENV WORKERS=30
ENV DELAY=0.1
ENV MODE=all

CMD python3 scraper.py \
    --mode ${MODE} \
    --output-dir ${OUTPUT_DIR} \
    --workers ${WORKERS} \
    --delay ${DELAY}
