import { CapacitorVideoPlayer } from 'capacitor-video-player';

type capVideoPlayerMode = 'fullscreen' | 'embedded';

class VideoPlayerDemo {
  private videoUrlInput: HTMLInputElement;
  private statusText: HTMLElement;
  private currentTimeText: HTMLElement;

  /** As embedded and fullscreen use different players track their init status separately */
  private initializers: Record<capVideoPlayerMode, boolean> = { embedded: false, fullscreen: false };

  /** ID returned from setInterval used to track playback time */
  private playbackIntervalTrackerId?: number;

  constructor() {
    this.videoUrlInput = document.getElementById('videoUrl') as HTMLInputElement;
    this.statusText = document.getElementById('status-text') as HTMLElement;
    this.currentTimeText = document.getElementById('current-time') as HTMLElement;

    this.addListeners();
    this.bindUI();
    this.startPlaybackTimeTracking();
  }

  private addListeners() {
    CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPlay', (e) => {
      this.updateStatus(`Player ${e.fromPlayerId} is playing`);
      this.startPlaybackTimeTracking();
    });
    CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPause', (e) => {
      this.updateStatus(`Player ${e.fromPlayerId} is paused`);
      this.stopPlaybackTimeTracking();
    });
    CapacitorVideoPlayer.addListener('jeepCapVideoPlayerEnded', (e) => {
      this.updateStatus(`Player ${e.fromPlayerId} has ended`);
      this.stopPlaybackTimeTracking();
    });
    CapacitorVideoPlayer.addListener('jeepCapVideoPlayerExit', (e) => {
      this.updateStatus('Player has been dismissed');
      // full screen will re-init every play
      this.initializers.fullscreen = false;
    });
    CapacitorVideoPlayer.addListener('jeepCapVideoPlayerReady', (data) => {
      // Optionally handle ready event
    });
  }

  private bindUI() {
    document.getElementById('playFullscreen')!.addEventListener('click', () => this.play('fullscreen'));
    document.getElementById('playEmbedded')!.addEventListener('click', () => this.play('embedded'));
    document.getElementById('pause')!.addEventListener('click', () => this.pause());
    document.getElementById('setMuted')!.addEventListener('click', () => this.toggleMuted());
  }

  private startPlaybackTimeTracking() {
    this.stopPlaybackTimeTracking();
    this.playbackIntervalTrackerId = window.setInterval(async () => {
      if (this.initializers.embedded) {
        const { value } = await CapacitorVideoPlayer.getCurrentTime({ playerId: 'embeddedPlayer' });
        this.currentTimeText.textContent = `${Math.round(value)}`;
      }
    }, 1000);
  }
  private stopPlaybackTimeTracking() {
    if (this.playbackIntervalTrackerId) {
      window.clearInterval(this.playbackIntervalTrackerId);
    }
  }

  private updateStatus(text: string) {
    this.statusText.textContent = text;
    console.log(`Status: ${text}`);
  }

  private async play(mode: capVideoPlayerMode) {
    // keep separate references for embedded and fullscreen players
    const playerId = `${mode}Player`;
    if (!this.initializers[mode]) {
      const result = await CapacitorVideoPlayer.initPlayer({
        mode,
        url: this.videoUrlInput.value,
        playerId,
        componentTag: '#videoContainer',
        height: 300,
      });
      if (!result.result) {
        this.updateStatus('Failed to initialize player');
        return;
      }
      this.initializers[mode] = true;
    }
    await CapacitorVideoPlayer.stopAllPlayers();
    try {
      await CapacitorVideoPlayer.play({ playerId });
      this.updateStatus('Video is playing');
    } catch (err) {
      this.updateStatus(`Playback error: ${err}`);
    }
  }

  private async pause() {
    await CapacitorVideoPlayer.pause({ playerId: 'embeddedPlayer' });
  }

  private async toggleMuted() {
    const { value: isMuted } = await CapacitorVideoPlayer.getMuted({
      playerId: 'embeddedPlayer',
    });
    await CapacitorVideoPlayer.setMuted({ playerId: 'embeddedPlayer', muted: !isMuted });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VideoPlayerDemo();
});
