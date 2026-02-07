import numpy as np
from scipy.io import wavfile
from scipy.fft import rfft
import io

# Configuration matching frontend
CHARSET = (
    'abcdefghijklmnopqrstuvwxyz' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    '0123456789' +
    '!@#$%^&*()'
)

NUM_BUCKETS = 64
FFT_SIZE = 2048
SILENCE_CHAR = '-'
SILENCE_RMS = 0.001
FREQ_MIN = 50
FREQ_MAX = 8000


def compute_spectral_hash(wav_file_or_path):
    """
    Compute spectral hash from a WAV file.
    
    Args:
        wav_file_or_path: Either a file path (string) or a file-like object (BytesIO)
    
    Returns:
        dict: Contains 'hash', 'hashLength', 'sampleRate', 'fftSize', 'silentBuckets', 'activeBuckets'
    """
    # Read WAV file
    if isinstance(wav_file_or_path, str):
        sample_rate, audio_data = wavfile.read(wav_file_or_path)
    else:
        sample_rate, audio_data = wavfile.read(wav_file_or_path)
    
    # Convert to mono if stereo
    if audio_data.ndim == 2:
        audio_data = audio_data[:, 0]
    
    # Convert to float32 normalized to [-1, 1]
    if audio_data.dtype == np.int16:
        samples = audio_data.astype(np.float32) / 32768.0
    else:
        samples = audio_data.astype(np.float32)
    
    # Compute hash
    bucket_len = len(samples) // NUM_BUCKETS
    log_min = np.log(FREQ_MIN)
    log_max = np.log(FREQ_MAX)
    hash_result = ''
    
    for i in range(NUM_BUCKETS):
        start = i * bucket_len
        end = min(start + bucket_len, len(samples))
        chunk = samples[start:end]
        
        # Silence check (RMS)
        rms = np.sqrt(np.mean(chunk ** 2))
        if rms < SILENCE_RMS:
            hash_result += SILENCE_CHAR
            continue
        
        # Prepare FFT input: Apply Hann window
        win_len = min(len(chunk), FFT_SIZE)
        windowed = np.zeros(FFT_SIZE, dtype=np.float64)
        
        # Apply Hann window
        hann_window = 0.5 * (1 - np.cos(2 * np.pi * np.arange(win_len) / (win_len - 1)))
        windowed[:win_len] = chunk[:win_len] * hann_window
        
        # Compute FFT
        fft_result = rfft(windowed)
        
        # Compute magnitudes squared (power spectrum)
        magnitudes_sq = np.abs(fft_result) ** 2
        
        # Compute spectral centroid
        half_n = FFT_SIZE // 2
        weighted_sum = 0
        mag_sum = 0
        
        for j in range(1, half_n):
            mag = magnitudes_sq[j]
            freq_hz = j * (sample_rate / FFT_SIZE)
            weighted_sum += freq_hz * mag
            mag_sum += mag
        
        if mag_sum == 0:
            hash_result += SILENCE_CHAR
            continue
        
        # Spectral centroid in Hz
        centroid = weighted_sum / mag_sum
        
        # Map centroid to character (log scale)
        log_centroid = np.log(np.clip(centroid, FREQ_MIN, FREQ_MAX))
        t = (log_centroid - log_min) / (log_max - log_min)
        idx = int(np.clip(t * len(CHARSET), 0, len(CHARSET) - 1))
        hash_result += CHARSET[idx]
    
    # Count silent and active buckets
    silent_count = hash_result.count(SILENCE_CHAR)
    active_count = NUM_BUCKETS - silent_count
    
    return {
        'hash': hash_result,
        'hashLength': len(hash_result),
        'sampleRate': int(sample_rate),
        'fftSize': FFT_SIZE,
        'silentBuckets': silent_count,
        'activeBuckets': active_count
    }


# Example usage (commented out):
# if __name__ == "__main__":
#     result = compute_spectral_hash('charlie2.wav')
#     print("Hash:", result['hash'])
#     print("Details:", result)