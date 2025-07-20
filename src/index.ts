import { registerPlugin, Capacitor } from '@capacitor/core';
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
      // Si es embedded, usamos siempre la capa web para que participe del scroll
      if (options.mode === 'embedded') {
        const web = new CapacitorVideoPlayerWeb();
        return web.initPlayer(options);
      }
      // Si es fullscreen, llamamos al native
      return NativeVideoPlayer.initPlayer(options);
    },


  removePlayer(options: capVideoPlayerIdOptions): Promise<capVideoPlayerResult> {
    // Igual: embedded lo limpia la capa web; fullscreen el native
    if ((options as any).mode === 'embedded') {
      const web = new CapacitorVideoPlayerWeb();
      return web.removePlayer(options);
    }
    return NativeVideoPlayer.removePlayer(options);
  },
};

export * from './definitions';
