from scipy.io import wavfile
from scipy.fft import fft, fftfreq
import numpy as np
import matplotlib.pyplot as plt

sample_rate, audio_data = wavfile.read('ex.wav')
# wavfile.write('labubu.wav', sample_rate, audio_data)

audio_data = audio_data[:, 0]

print(f"Sample rate: {sample_rate} Hz")
print(f"Audio data shape: {audio_data.shape}")

N = len(audio_data)

fft_vals = fft(audio_data)
fft_magnitude = np.abs(fft_vals[:N // 2])
freqs = fftfreq(N, 1 / sample_rate)[:N // 2]

plt.plot(freqs, fft_magnitude)
plt.xlabel('Frequency (Hz)')
plt.ylabel('Amplitude')
plt.title('Frequency Spectrum')
plt.show()