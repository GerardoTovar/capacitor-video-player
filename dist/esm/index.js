import { registerPlugin } from '@capacitor/core';
import { CapacitorVideoPlayerWeb } from './web';
const NativeVideoPlayer = registerPlugin('CapacitorVideoPlayer', {
    web: () => new CapacitorVideoPlayerWeb(),
});
export const CapacitorVideoPlayer = Object.assign(Object.assign({}, NativeVideoPlayer), { initPlayer(options) {
        // Si es embedded, usamos siempre la capa web para que participe del scroll
        if (options.mode === 'embedded') {
            const web = new CapacitorVideoPlayerWeb();
            return web.initPlayer(options);
        }
        // Si es fullscreen, llamamos al native
        return NativeVideoPlayer.initPlayer(options);
    },
    removePlayer(options) {
        // Igual: embedded lo limpia la capa web; fullscreen el native
        if (options.mode === 'embedded') {
            const web = new CapacitorVideoPlayerWeb();
            return web.removePlayer(options);
        }
        return NativeVideoPlayer.removePlayer(options);
    } });
export * from './definitions';
//# sourceMappingURL=index.js.map