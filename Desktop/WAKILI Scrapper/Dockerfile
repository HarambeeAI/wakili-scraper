FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scraper.py .

# Storage mounts at /data — Railway volume will be attached here
ENV OUTPUT_DIR=/data/kenyalaw
ENV DB_PATH=/data/kenyalaw/scraper_state.db
ENV WORKERS=50
ENV DELAY=0.1
ENV MODE=all
# Set FRESH_DAYS=7 on weekly re-runs to pick up newly published documents
# Set FRESH_DAYS=0 (default) for a full initial scrape with resume support
ENV FRESH_DAYS=0

CMD python3 scraper.py \
    --mode ${MODE} \
    --output-dir ${OUTPUT_DIR} \
    --db-path ${DB_PATH} \
    --workers ${WORKERS} \
    --delay ${DELAY} \
    --fresh-days ${FRESH_DAYS}
