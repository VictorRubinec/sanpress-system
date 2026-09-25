/**
 * Plays a premium synthesized chime sound using the browser's Web Audio API.
 * Synthesizes a clean dual-tone electronic bell.
 */
export function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    
    const playNote = (frequency, duration, startTime) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);

      // Programmatic volume envelope (attack, decay, release) to make it sound natural
      gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + startTime + 0.02); // Quick fade in
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration); // Exp fade out

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Synthesize C5 (523.25 Hz) followed shortly by G5 (783.99 Hz)
    playNote(523.25, 0.3, 0);
    playNote(783.99, 0.45, 0.08);
  } catch (error) {
    console.error('Falha ao reproduzir áudio de notificação:', error);
  }
}
