/**
 * Audible new-order cue (NOTIF SRS §10 / FR-NOTIF-071). Generated with the Web Audio API — a short
 * two-tone chime — so there's no binary asset to ship and no network fetch.
 *
 * Browsers block audio until the user has interacted with the page; by the time an admin is signed
 * in and working they've interacted, so the chime plays. If it's still suppressed we swallow the
 * error — the bell + toast are the guaranteed alert; sound is an enhancement (SRS §12 edge case 18).
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

export function playAlertSound(): void {
  try {
    const ac = audioContext();
    if (!ac) return;
    // Autoplay policy may leave a freshly-created context suspended until a gesture resumes it.
    if (ac.state === "suspended") void ac.resume();

    const start = ac.currentTime;
    // Rising two-note chime (A5 → E6).
    [880, 1318.5].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {
    // No audio device / autoplay blocked — visual alert still fires.
  }
}
