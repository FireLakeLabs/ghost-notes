import type { OutputTap } from '../contract';
import { capturedRms } from '../engine/logic';
import type { PCM } from '../engine/logic';

/** A rolling minute of PCM; expired or incomplete windows reject rather than claim silence. */
export async function createTap(
  context: AudioContext,
  output: AudioNode,
): Promise<OutputTap & { close(): void }> {
  const url = URL.createObjectURL(
    new Blob(
      [
        `
class ODMTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = () => { this.closed = true; };
  }
  process(inputs, outputs) {
    if (this.closed) return false;
    // Web Audio supplies zero channels for a silent input bus. Capture that
    // rendered quantum too, otherwise RMS windows crossing a voice end have gaps.
    const channels = inputs[0]?.length ? inputs[0] : [new Float32Array(outputs[0][0].length)];
    // Chromium can repeat currentFrame when the graph changes. Rendered
    // quanta still arrive in order: never stamp two captures over one another.
    const frame = Math.max(currentFrame, this.nextFrame ?? currentFrame);
    this.nextFrame = frame + outputs[0][0].length;
    this.port.postMessage({ frame, channels });
    return true;
  }
}
registerProcessor('odm-output-tap', ODMTap);
`,
      ],
      { type: 'text/javascript' },
    ),
  );
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const tap = new AudioWorkletNode(context, 'odm-output-tap', { channelCount: 2 });
  const muted = context.createGain();
  muted.gain.value = 0;
  output.connect(tap).connect(muted).connect(context.destination);
  const chunks: PCM[] = [];
  tap.port.onmessage = ({ data }: MessageEvent<PCM>) => {
    chunks.push(data);
    while (chunks[0]?.frame < data.frame - context.sampleRate * 60) chunks.shift();
  };
  let closed = false;
  return {
    close() {
      if (closed) return;
      closed = true;
      tap.port.postMessage(null);
      tap.port.onmessage = null;
      output.disconnect(tap);
      tap.disconnect();
      muted.disconnect();
      tap.port.close();
      chunks.length = 0;
    },
    sampleRate: context.sampleRate,
    async rms(from, to) {
      if (closed) throw Error('Output tap is closed');
      if (!Number.isFinite(to) || to - context.currentTime > 10)
        throw Error('RMS window is too far in the future');
      return capturedRms(chunks, context.sampleRate, from, to);
    },
  };
}
