"""Synthesize authorized references with local F5 only; a manifest supports intro batches."""
import json
import os
import sys
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'


def main():
    manifest = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    runtime, items = manifest['runtime'], manifest['items']
    for key in ('checkpoint', 'vocab'):
        if not Path(runtime[key]).is_file():
            raise ValueError('Local F5 weights or vocabulary unavailable')
    for item in items:
        if not item['text'].strip() or len(item['text']) > 1000 or not item['reference_text'].strip() or not Path(item['reference_audio']).is_file():
            raise ValueError('Narration or accurate reference unavailable')
    from f5_tts.api import F5TTS
    import numpy as np
    import soundfile as sf
    model = F5TTS(model='F5TTS_v1_Base', ckpt_file=runtime['checkpoint'], vocab_file=runtime['vocab'], vocoder_local_path=runtime['vocoder'])
    for item in items:
        output = Path(item['output'])
        output.parent.mkdir(parents=True, exist_ok=True)
        wave, rate, _ = model.infer(ref_file=item['reference_audio'], ref_text=item['reference_text'], gen_text=item['text'], speed=1.0, nfe_step=32, seed=20261018)
        if not np.isfinite(wave).all() or np.sqrt(np.mean(wave ** 2)) < 0.0001 or not 0 < len(wave) / rate <= 300:
            raise ValueError('Invalid or overlong F5 output; no acceleration applied')
        sf.write(output, wave, rate, subtype='PCM_16')
        print(json.dumps({'output': str(output), 'duration': len(wave) / rate}), flush=True)


if __name__ == '__main__':
    main()
