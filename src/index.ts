import { registerPlugin } from '@capacitor/core';
import type {
  CapacitorVideoPlayerPlugin,
  capVideoPlayerOptions,
  capVideoPlayerIdOptions,
  capVideoPlayerResult
} from './definitions';

const NativeVideoPlayer = registerPlugin<CapacitorVideoPlayerPlugin>(
  'CapacitorVideoPlayer',
  {
    web: () => import('./web').then(m => new m.CapacitorVideoPlayerWeb()),
  },
);

// Reemplazamos el export directo por un objeto que:
//  1) “Heredamos” todos los métodos nativos con …NativeVideoPlayer
//  2) Sobrescribimos initPlayer para inyectar placement
//  3) Exponemos removePlayer
export const CapacitorVideoPlayer: CapacitorVideoPlayerPlugin = {
  ...NativeVideoPlayer,

  initPlayer(options: capVideoPlayerOptions): Promise<capVideoPlayerResult> {
    const initOpts: any = {
      mode:     options.mode,
      url:      options.url,
      playerId: options.playerId,
    };
    if (options.mode === 'embedded' && options.placement) {
      initOpts.placement = {
        x:      options.placement.x,
        y:      options.placement.y,
        width:  options.placement.width,
        height: options.placement.height,
      };
    }
    return NativeVideoPlayer.initPlayer(initOpts);
  },

  removePlayer(options: capVideoPlayerIdOptions): Promise<capVideoPlayerResult> {
    return NativeVideoPlayer.removePlayer(options);
  }
};

export * from './definitions';
