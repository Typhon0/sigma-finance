FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gcc \
    libxml2-dev \
    libxslt-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user
RUN useradd -u 1000 -m -s /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

# Run initial woob module update as appuser
RUN woob config update || true
RUN python3 -c "from woob.core import Woob; w = Woob(); [w.repositories.install(m) for m in ['caissedepargne', 'boursorama', 'fortuneo', 'bnp', 'lcl', 'banquepopulaire', 'creditmutuel', 'cic', 'boursedirect', 'amundi', 'yomoni'] if m in w.repositories.get_all_modules_info()]" || true
RUN sed -i 's|https://www.caisse-epargne.fr/ria/|https://www.icgauth.caisse-epargne.fr/ria/|g' /home/appuser/.local/share/woob/modules/3.7/woob_modules/caissedepargne/browser.py || true

EXPOSE 50055

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "50055"]
