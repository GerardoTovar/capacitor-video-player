import { registerPlugin } from '@capacitor/core';
import type {
  CapacitorVideoPlayerPlugin,
  capVideoPlayerOptions,
  capVideoPlayerResult,
  capVideoPlayerIdOptions
} from './definitions';
import { CapacitorVideoPlayerWeb } from './web';

const NativeVideoPlayer = registerPlugin<CapacitorVideoPlayerPlugin>(
  'CapacitorVideoPlayer',
  {
    web: () => new CapacitorVideoPlayerWeb(),
  },
);

export const CapacitorVideoPlayer: CapacitorVideoPlayerPlugin = {
  ...NativeVideoPlayer,

  initPlayer(options: capVideoPlayerOptions): Promise<capVideoPlayerResult> {
    if (options.mode === 'embedded') {
      return new CapacitorVideoPlayerWeb().initPlayer(options);
    }
    return NativeVideoPlayer.initPlayer(options);
  },

  play(options: capVideoPlayerIdOptions): Promise<capVideoPlayerResult> {
    if ((options as any).mode === 'embedded') {
      return new CapacitorVideoPlayerWeb().play(options);
    }
    return NativeVideoPlayer.play(options);
  },

  pause(options: capVideoPlayerIdOptions): Promise<capVideoPlayerResult> {
    if ((options as any).mode === 'embedded') {
      return new CapacitorVideoPlayerWeb().pause(options);
    }
    return NativeVideoPlayer.pause(options);
  },

  removePlayer(options: capVideoPlayerIdOptions): Promise<capVideoPlayerResult> {
    // iOS will just dismiss whatever player is up
    return NativeVideoPlayer.removePlayer(options);
  },
};

export * from './definitions';
