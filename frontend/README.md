# Auditory Auth - Frontend

Frontend web application for recording audio and generating spectral fingerprints.

## Structure
- `index.html` - Main webpage
- `style.css` - Styling
- `app.js` - Audio recording and backend communication

## Running

You can use any static file server. Here are some options:

### Option 1: Python HTTP Server
```bash
python -m http.server 3000
```

### Option 2: Live Server (VS Code Extension)
1. Install "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"

### Option 3: Node.js http-server
```bash
npx http-server -p 3000
```

Then open http://localhost:3000 in your browser.

**Note:** Make sure the backend server is running on http://localhost:8000 before using the frontend.
