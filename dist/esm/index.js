import { registerPlugin } from '@capacitor/core';
import { CapacitorVideoPlayerWeb } from './web';
const NativeVideoPlayer = registerPlugin('CapacitorVideoPlayer', {
    web: () => new CapacitorVideoPlayerWeb(),
});
export const CapacitorVideoPlayer = Object.assign(Object.assign({}, NativeVideoPlayer), { initPlayer(options) {
        if (options.mode === 'embedded') {
            return new CapacitorVideoPlayerWeb().initPlayer(options);
        }
        return NativeVideoPlayer.initPlayer(options);
    },
    play(options) {
        if (options.mode === 'embedded') {
            return new CapacitorVideoPlayerWeb().play(options);
        }
        return NativeVideoPlayer.play(options);
    },
    pause(options) {
        if (options.mode === 'embedded') {
            return new CapacitorVideoPlayerWeb().pause(options);
        }
        return NativeVideoPlayer.pause(options);
    },
    removePlayer(options) {
        // iOS will just dismiss whatever player is up
        return NativeVideoPlayer.removePlayer(options);
    } });
export * from './definitions';
//# sourceMappingURL=index.js.map