# Auditory Auth - Spectral Fingerprint System

A web application that records audio and generates unique spectral fingerprints using FFT (Fast Fourier Transform) analysis.

## Project Structure

```
thebiguga/
├── frontend/          # Static web application
│   ├── index.html    # Main webpage
│   ├── style.css     # Styling
│   ├── app.js        # Audio recording & UI
│   └── README.md     # Frontend documentation
│
└── backend/          # Django API server
    ├── manage.py     # Django management
    ├── main.py       # FFT processing logic
    ├── requirements.txt
    ├── auditory_auth/  # Django project settings
    ├── core/          # API endpoints
    └── README.md      # Backend documentation
```

## Quick Start

### 1. Start the Backend (Terminal 1)
```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```

Backend will run on http://localhost:8000

### 2. Start the Frontend (Terminal 2)
```bash
cd frontend
python -m http.server 3000
```

Frontend will run on http://localhost:3000

### 3. Use the Application
1. Open http://localhost:3000 in your browser
2. Click "Start Recording" and speak/make sound for up to 5 seconds
3. The audio is automatically sent to the backend for FFT processing
4. View the generated spectral fingerprint hash
5. Download the WAV file or hash JSON if needed

## How It Works

1. **Frontend**: Records audio in the browser using Web Audio API
2. **Frontend**: Creates a WAV file from the recorded audio
3. **Frontend**: Sends the WAV file to backend via HTTP POST
4. **Backend**: Receives WAV and performs FFT analysis
5. **Backend**: Computes spectral centroid for each time bucket
6. **Backend**: Maps frequency data to characters creating a unique hash
7. **Frontend**: Displays the hash and recording metrics

## Architecture

- **Frontend (Client-Side)**: Pure HTML/CSS/JavaScript - no build tools needed
- **Backend (Server-Side)**: Django + NumPy + SciPy for FFT processing
- **Communication**: REST API with CORS enabled
- **Data Flow**: Browser → WAV → Backend FFT → Hash → Browser

## Features

- Real-time audio recording with waveform visualization
- Server-side FFT processing for consistent results
- 64-character spectral fingerprint hash
- Logarithmic frequency mapping for perceptual accuracy
- Silence detection and handling
- WAV file export
- Hash JSON export with metadata

## Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- Web Audio API
- Canvas API for visualization

**Backend:**
- Python 3.x
- Django (API framework)
- NumPy (numerical computing)
- SciPy (FFT implementation)
- django-cors-headers (CORS support)

## Development

See individual README files in `frontend/` and `backend/` directories for detailed documentation.
