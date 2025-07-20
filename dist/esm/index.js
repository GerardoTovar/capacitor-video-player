import { registerPlugin } from '@capacitor/core';
const NativeVideoPlayer = registerPlugin('CapacitorVideoPlayer', {
    web: () => import('./web').then(m => new m.CapacitorVideoPlayerWeb()),
});
// Reemplazamos el export directo por un objeto que:
//  1) “Heredamos” todos los métodos nativos con …NativeVideoPlayer
//  2) Sobrescribimos initPlayer para inyectar placement
//  3) Exponemos removePlayer
export const CapacitorVideoPlayer = Object.assign(Object.assign({}, NativeVideoPlayer), { initPlayer(options) {
        const initOpts = {
            mode: options.mode,
            url: options.url,
            playerId: options.playerId,
        };
        if (options.mode === 'embedded' && options.placement) {
            initOpts.placement = {
                x: options.placement.x,
                y: options.placement.y,
                width: options.placement.width,
                height: options.placement.height,
            };
        }
        return NativeVideoPlayer.initPlayer(initOpts);
    },
    removePlayer(options) {
        return NativeVideoPlayer.removePlayer(options);
    } });
export * from './definitions';
//# sourceMappingURL=index.js.map