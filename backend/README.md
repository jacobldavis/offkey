# Auditory Auth - Backend

Django API server for processing audio files and computing spectral fingerprints using FFT.

## Structure
- `manage.py` - Django management script
- `main.py` - FFT processing and spectral hash computation
- `auditory_auth/` - Django project settings
- `core/` - Django app with API endpoints
- `requirements.txt` - Python dependencies

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python manage.py runserver
```

The API will be available at http://localhost:8000

## API Endpoints

### POST /api/process-audio/
Accepts a WAV file upload and returns the spectral hash.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `audio` field with WAV file

**Response:**
```json
{
  "hash": "abcdefgh...",
  "hashLength": 64,
  "sampleRate": 44100,
  "fftSize": 2048,
  "silentBuckets": 5,
  "activeBuckets": 59
}
```

## CORS Configuration

The backend is configured to accept requests from:
- http://localhost:3000
- http://localhost:5500 (Live Server default)

To add more origins, edit `CORS_ALLOWED_ORIGINS` in `auditory_auth/settings.py`.
