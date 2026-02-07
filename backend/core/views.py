from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import io
import sys
import os

# Add parent directory to path to import main.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import compute_spectral_hash


@csrf_exempt
def process_audio(request):
    """
    Endpoint to receive WAV file and return spectral hash.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    if 'audio' not in request.FILES:
        return JsonResponse({'error': 'No audio file provided'}, status=400)
    
    try:
        # Get the uploaded WAV file
        wav_file = request.FILES['audio']
        
        # Read file into BytesIO for processing
        wav_data = io.BytesIO(wav_file.read())
        
        # Compute spectral hash
        result = compute_spectral_hash(wav_data)
        
        return JsonResponse(result)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
