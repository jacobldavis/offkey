// ═══════════════════════════════════════════════════════════
//  Auditory Auth – Spectral Fingerprint (Mic → FFT → Hash)
// ═══════════════════════════════════════════════════════════

// ─── Configuration ───────────────────────────────────────
// Charset ordered so adjacent characters = similar sounds.
// a-z (26) + A-Z (26) + 0-9 (10) + symbols (10) = 72 chars
const CHARSET =
    'abcdefghijklmnopqrstuvwxyz' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    '0123456789' +
    '!@#$%^&*()';

const MAX_DURATION_S  = 5;        // max recording length
const NUM_BUCKETS     = 64;       // hash is always exactly this many characters
const FFT_SIZE        = 2048;     // power of 2 for FFT
const SILENCE_CHAR    = '-';      // emitted for silent buckets
const SILENCE_RMS     = 0.001;    // RMS below this → silence

// Spectral centroid is mapped from [FREQ_MIN .. FREQ_MAX] Hz
// onto the CHARSET using a logarithmic scale (perception is log).
const FREQ_MIN        = 50;       // Hz – lower bound
const FREQ_MAX        = 8000;     // Hz – upper bound

// ─── State ───────────────────────────────────────────────
let audioCtx      = null;
let mediaStream   = null;
let sourceNode    = null;
let processorNode = null;
let analyserNode  = null;
let recording     = false;
let capturedChunks = [];          // array of Float32Array chunks
let capturedSampleCount = 0;      // total samples captured so far
let animFrameId   = null;
let startTime     = 0;
let recSampleRate = 44100;

let currentHash    = '';
let currentWavBlob = null;

// ─── DOM refs ────────────────────────────────────────────
const canvas        = document.getElementById('waveform');
const ctx           = canvas.getContext('2d');
const btnRecord     = document.getElementById('btn-record');
const btnWav        = document.getElementById('btn-save-wav');
const btnHash       = document.getElementById('btn-save-hash');
const recIndicator  = document.getElementById('rec-indicator');
const timerEl       = document.getElementById('timer');
const resultSection = document.getElementById('result-section');
const hashDisplay   = document.getElementById('hash-display');
const hashLengthEl  = document.getElementById('hash-length');
const bucketCountEl = document.getElementById('bucket-count');
const bucketSizeEl  = document.getElementById('bucket-size');
const sampleRateEl  = document.getElementById('sample-rate');

// ─── Button event listeners ──────────────────────────────
btnRecord.addEventListener('click', () => {
    toggleRecording().catch(err => {
        console.error('toggleRecording error:', err);
        showError('Error: ' + err.message);
    });
});
btnWav.addEventListener('click',  () => saveWAV());
btnHash.addEventListener('click', () => saveHash());

// Draw an idle flat-line on the canvas at load
drawIdleLine();

// ─── Inline error display (works even when alert() is blocked) ──
function showError(msg) {
    hashDisplay.textContent   = msg;
    resultSection.classList.remove('hidden');
}

// ═════════════════════════════════════════════════════════
//  Recording (Microphone → raw PCM via ScriptProcessorNode)
// ═════════════════════════════════════════════════════════

async function toggleRecording() {
    if (!recording) await startRecording();
    else            stopRecording();
}

async function startRecording() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation:  false,
                noiseSuppression:  false,
                autoGainControl:   true,   // boost quiet mic signals
            }
        });
    } catch (e) {
        console.error('getUserMedia failed:', e);
        showError('Microphone access denied or unavailable: ' + e.message
            + '\n\nTip: open http://localhost:8000 in Chrome/Edge instead of the VS Code Simple Browser.');
        return;
    }

    audioCtx      = new (window.AudioContext || window.webkitAudioContext)();
    recSampleRate  = audioCtx.sampleRate;
    sourceNode    = audioCtx.createMediaStreamSource(mediaStream);

    // Analyser → live waveform visualisation
    analyserNode          = audioCtx.createAnalyser();
    analyserNode.fftSize  = 2048;
    sourceNode.connect(analyserNode);

    // ScriptProcessor → capture raw PCM Float32 chunks
    processorNode = audioCtx.createScriptProcessor(4096, 1, 1);
    capturedChunks = [];
    capturedSampleCount = 0;
    const targetSamples = MAX_DURATION_S * recSampleRate;

    processorNode.onaudioprocess = (e) => {
        if (!recording) return;
        const buf = new Float32Array(e.inputBuffer.getChannelData(0));
        capturedChunks.push(buf);
        capturedSampleCount += buf.length;

        // Update timer display based on actual captured audio
        const capturedSecs = capturedSampleCount / recSampleRate;
        timerEl.textContent = `${capturedSecs.toFixed(1)} s / ${MAX_DURATION_S}.0 s`;

        // Auto-stop once we've captured enough samples
        if (capturedSampleCount >= targetSamples) stopRecording();
    };

    sourceNode.connect(processorNode);
    processorNode.connect(audioCtx.destination); // must connect for events to fire

    recording  = true;
    startTime  = performance.now();
    currentHash    = '';
    currentWavBlob = null;

    // ── UI ──
    btnRecord.textContent = '⏹ Stop Recording';
    btnRecord.classList.add('recording');
    recIndicator.classList.remove('hidden');
    resultSection.classList.add('hidden');
    btnWav.disabled  = true;
    btnHash.disabled = true;

    // Live waveform
    drawLiveWaveform();
}

function stopRecording() {
    recording = false;
    cancelAnimationFrame(animFrameId);

    // Tear down audio graph
    if (processorNode) { processorNode.disconnect(); processorNode = null; }
    if (sourceNode)    { sourceNode.disconnect();    sourceNode    = null; }
    if (analyserNode)  { analyserNode.disconnect();  analyserNode  = null; }
    if (mediaStream)   { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    if (audioCtx)      { audioCtx.close(); audioCtx = null; }

    // ── UI ──
    btnRecord.textContent = '⏺ Start Recording';
    btnRecord.classList.remove('recording');
    recIndicator.classList.add('hidden');

    // ── Process captured audio ──
    processAudio();
}

// ═══════════════════════════════════════════════════════════
//  Audio Processing  →  Send to Backend for Spectral Hash
// ═══════════════════════════════════════════════════════════

async function processAudio() {
    // Merge chunks into one contiguous Float32Array
    const totalLen = capturedChunks.reduce((n, c) => n + c.length, 0);
    const samples  = new Float32Array(totalLen);
    let off = 0;
    for (const chunk of capturedChunks) { samples.set(chunk, off); off += chunk.length; }
    capturedChunks = [];

    if (samples.length < FFT_SIZE) {
        showError('Recording too short – please record at least a brief sound.');
        drawIdleLine();
        return;
    }

    // Build WAV blob
    currentWavBlob = samplesToWav(samples, recSampleRate);

    // Send WAV to backend for processing
    try {
        const formData = new FormData();
        formData.append('audio', currentWavBlob, 'recording.wav');

        const response = await fetch('http://localhost:8000/api/process-audio/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server error');
        }

        const result = await response.json();
        currentHash = result.hash;

        // ── Display results ──
        const bucketLen = Math.floor(samples.length / NUM_BUCKETS);
        hashDisplay.textContent   = currentHash;
        hashLengthEl.textContent  = result.hashLength;
        bucketCountEl.textContent = NUM_BUCKETS;
        bucketSizeEl.textContent  = bucketLen + ' (~' + Math.round(bucketLen / recSampleRate * 1000) + ' ms)';
        sampleRateEl.textContent  = result.sampleRate;
        resultSection.classList.remove('hidden');
        btnWav.disabled  = false;
        btnHash.disabled = false;

        // Draw static waveform of the recording
        drawStaticWaveform(samples);

    } catch (error) {
        console.error('Error processing audio:', error);
        showError('Error processing audio: ' + error.message);
        drawIdleLine();
    }
}

// ═════════════════════════════════════════════════════════
//  Canvas Visualisation
// ═════════════════════════════════════════════════════════

function drawIdleLine() {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

function drawLiveWaveform() {
    if (!analyserNode) return;
    const bufLen = analyserNode.frequencyBinCount;
    const data   = new Uint8Array(bufLen);

    function frame() {
        if (!recording) return;
        animFrameId = requestAnimationFrame(frame);

        analyserNode.getByteTimeDomainData(data);
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth   = 2;
        ctx.strokeStyle = '#50fa7b';
        ctx.beginPath();

        const sliceW = canvas.width / bufLen;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
            const y = (data[i] / 255) * canvas.height;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            x += sliceW;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }
    frame();
}

function drawStaticWaveform(samples) {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const step = Math.ceil(samples.length / canvas.width);
    const amp  = canvas.height / 2;

    ctx.lineWidth   = 1;
    ctx.strokeStyle = '#8be9fd';
    ctx.beginPath();

    for (let i = 0; i < canvas.width; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
            const s = samples[i * step + j] || 0;
            if (s < min) min = s;
            if (s > max) max = s;
        }
        ctx.moveTo(i, amp + min * amp);
        ctx.lineTo(i, amp + max * amp);
    }
    ctx.stroke();
}

// ═════════════════════════════════════════════════════════
//  WAV Encoder  (PCM 16-bit mono)
// ═════════════════════════════════════════════════════════

function samplesToWav(samples, sampleRate) {
    const numCh   = 1;
    const bps     = 16;
    const byteRate   = sampleRate * numCh * (bps / 8);
    const blockAlign = numCh * (bps / 8);
    const dataSize   = samples.length * (bps / 8);
    const bufSize    = 44 + dataSize;
    const buf        = new ArrayBuffer(bufSize);
    const v          = new DataView(buf);

    let o = 0;
    const ws = (s) => { for (let i = 0; i < s.length; i++) v.setUint8(o++, s.charCodeAt(i)); };
    const w32 = (n) => { v.setUint32(o, n, true); o += 4; };
    const w16 = (n) => { v.setUint16(o, n, true); o += 2; };

    ws('RIFF'); w32(bufSize - 8); ws('WAVE');
    ws('fmt '); w32(16); w16(1); w16(numCh);
    w32(sampleRate); w32(byteRate); w16(blockAlign); w16(bps);
    ws('data'); w32(dataSize);

    for (let i = 0; i < samples.length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        v.setInt16(o, s | 0, true);
        o += 2;
    }

    return new Blob([buf], { type: 'audio/wav' });
}

// ═════════════════════════════════════════════════════════
//  Save / Download helpers
// ═════════════════════════════════════════════════════════

function saveWAV() {
    if (!currentWavBlob) return;
    download(currentWavBlob, 'recording.wav');
}

function saveHash() {
    if (!currentHash) return;
    const payload = {
        hash:       currentHash,
        hashLength: NUM_BUCKETS,
        sampleRate: recSampleRate,
        fftSize:    FFT_SIZE,
        silentBuckets:  (currentHash.match(/-/g) || []).length,
        activeBuckets:  NUM_BUCKETS - (currentHash.match(/-/g) || []).length,
    };
    const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: 'application/json' }
    );
    download(blob, 'spectral_hash.json');
}

function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
