var capacitorCapacitorVideoPlayer = (function (exports, core, Hls) {
    'use strict';

    const videoTypes = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        cmaf: 'video/mp4',
        cmfv: 'video/mp4',
        m3u8: 'application/x-mpegURL',
        ogg: 'video/ogg',
        ogv: 'video/ogg',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        mkv: 'video/x-matroska',
        flv: 'video/x-flv',
        wmv: 'video/x-ms-wmv',
    };

    class VideoPlayer {
        constructor(_mode, _url, _playerId, _videoRate, _videoExitOnEnd, _videoLoopOnEnd, _container, _zIndex, 
        // _width/_height are no longer used for sizing; kept here only for SVG viewBox if desired
        _width = 320, _height = 180) {
            this._mode = _mode;
            this._url = _url;
            this._playerId = _playerId;
            this._videoRate = _videoRate;
            this._videoExitOnEnd = _videoExitOnEnd;
            this._videoLoopOnEnd = _videoLoopOnEnd;
            this._container = _container;
            this._zIndex = _zIndex;
            this._width = _width;
            this._height = _height;
            this.pipMode = false;
            this.isPlaying = false;
            this._videoType = null;
            this._firstReadyToPlay = true;
            this._isEnded = false;
        }
        /** Inicializa y monta el player */
        async initialize() {
            this._videoType = this._getVideoType();
            if (!this._videoType) {
                console.error('Video type not supported:', this._url);
                this._createEvent('Exit', this._playerId, 'Url Error: type not supported');
                return;
            }
            // 1) estilos base del contenedor
            this._applyContainerStyles();
            // 2) svg póster negro (full bleed if desired)
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `0 0 ${this._width} ${this._height}`);
            svg.innerHTML = `<rect width="100%" height="100%" fill="#000"/>`;
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.zIndex = `${this._zIndex + 1}`;
            this._container.appendChild(svg);
            // 3) contenedor interno para el video
            this._videoContainer = document.createElement('div');
            Object.assign(this._videoContainer.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: `${this._zIndex + 2}`,
            });
            this._container.appendChild(this._videoContainer);
            // 4) crea y configura elemento <video>
            const created = await this._createVideoElement();
            if (!created) {
                this._createEvent('Exit', this._playerId, 'Video Error: failed to create the Video Element');
            }
        }
        /** Detiene y limpia todo */
        async destroy() {
            this.videoEl.pause();
            if (this.pipMode && document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            }
            clearTimeout(this._initialTimer);
            this._container.remove();
        }
        // —————————————
        // MÉTODOS PRIVADOS
        // —————————————
        /** Aplica los estilos comunes al contenedor raíz */
        _applyContainerStyles() {
            Object.assign(this._container.style, {
                position: this._mode === 'fullscreen' ? 'absolute' : 'relative',
                width: this._mode === 'fullscreen' ? '100vw' : '100%',
                height: this._mode === 'fullscreen' ? '100vh' : '100%',
                top: '0',
                left: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000',
                zIndex: `${this._zIndex}`,
                overflow: 'hidden',
            });
        }
        /** Crea el elemento <video> y engancha HLS o MP4 */
        async _createVideoElement() {
            this.videoEl = document.createElement('video');
            Object.assign(this.videoEl, {
                controls: true,
                playsInline: true,
                playbackRate: this._videoRate,
            });
            this.videoEl.setAttribute('webkit-playsinline', 'true');
            this.videoEl.setAttribute('playsinline', 'true');
            Object.assign(this.videoEl.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: `${this._zIndex + 3}`,
                objectFit: 'contain',
            });
            this._videoContainer.appendChild(this.videoEl);
            const ok = await this._setupSourceAndListeners();
            if (!ok)
                return false;
            // bind de eventos
            this.videoEl.onended = () => this._onEnded();
            this.videoEl.oncanplay = () => this._onReady();
            this.videoEl.onplay = () => this._onPlay();
            this.videoEl.onplaying = () => this._onPlaying();
            this.videoEl.onpause = () => this._onPause();
            // botón de salida y fullscreen solo en modo fullscreen
            if (this._mode === 'fullscreen') {
                this._addExitButton();
                this._goFullscreen();
            }
            return true;
        }
        /** Carga HLS o MP4 y registra PIP listeners */
        _setupSourceAndListeners() {
            return new Promise((resolve) => {
                if (!this.videoEl)
                    return resolve(false);
                if (Hls.isSupported() && this._videoType === 'application/x-mpegURL') {
                    const hls = new Hls();
                    hls.loadSource(this._url);
                    hls.attachMedia(this.videoEl);
                    hls.once(Hls.Events.FRAG_PARSED, () => {
                        this.videoEl.muted = true;
                        this.videoEl.crossOrigin = 'anonymous';
                        resolve(true);
                    });
                }
                else if (this._videoType === 'video/mp4') {
                    this.videoEl.src = this._url;
                    this.videoEl.crossOrigin = 'anonymous';
                    this.videoEl.muted = true;
                    resolve(true);
                }
                else {
                    resolve(false);
                }
                // PIP listeners
                this.videoEl.addEventListener('enterpictureinpicture', (e) => {
                    this.pipWindow = e.pictureInPictureWindow;
                    this.pipMode = true;
                    this._exitFullscreen();
                });
                this.videoEl.addEventListener('leavepictureinpicture', () => {
                    var _a;
                    this.pipMode = false;
                    if (this._mode === 'fullscreen' && !this._isEnded) {
                        this._goFullscreen();
                    }
                    (_a = this.videoEl) === null || _a === void 0 ? void 0 : _a.play().catch(() => { });
                });
            });
        }
        /** Crea y muestra el botón “X” para salir */
        _addExitButton() {
            const btn = document.createElement('button');
            btn.textContent = 'X';
            Object.assign(btn.style, {
                position: 'absolute',
                left: '1%',
                top: '5%',
                width: '5vmin',
                padding: '0.5%',
                fontSize: '1.2rem',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '20px',
                zIndex: `${this._zIndex + 4}`,
                visibility: 'hidden',
            });
            this._videoContainer.appendChild(btn);
            const showHide = () => {
                clearTimeout(this._initialTimer);
                btn.style.visibility = 'visible';
                this._initialTimer = setTimeout(() => btn.style.visibility = 'hidden', 3000);
            };
            this._videoContainer.addEventListener('click', showHide);
            this._videoContainer.addEventListener('touchstart', showHide);
            this._videoContainer.addEventListener('mousemove', showHide);
            btn.addEventListener('click', () => this._createEvent('Exit', this._playerId));
            btn.addEventListener('touchstart', () => this._createEvent('Exit', this._playerId));
            // arrancamos el temporizador
            this._initialTimer = setTimeout(() => btn.style.visibility = 'hidden', 3000);
        }
        /** Solicita fullscreen */
        _goFullscreen() {
            if (this._container.requestFullscreen) {
                this._container.requestFullscreen();
            }
            else if (this._container.webkitRequestFullscreen) {
                this._container.webkitRequestFullscreen();
            }
        }
        /** Sale de fullscreen sin lanzar error si no estabas ahí */
        _exitFullscreen() {
            var _a;
            try {
                if (document.fullscreenElement) {
                    (_a = document.exitFullscreen()) === null || _a === void 0 ? void 0 : _a.catch(() => { });
                }
                else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
            catch ( /* ignorado */_b) { /* ignorado */ }
        }
        // —————— Eventos de video ——————
        _onEnded() {
            this._isEnded = true;
            this.isPlaying = false;
            this.videoEl.currentTime = 0;
            if (this._videoExitOnEnd) {
                if (this._mode === 'fullscreen')
                    this._exitFullscreen();
                this._createEvent('Ended', this._playerId);
            }
            else if (this._videoLoopOnEnd) {
                this.videoEl.play().catch(() => { });
            }
        }
        _onReady() {
            if (!this._firstReadyToPlay)
                return;
            this._createEvent('Ready', this._playerId);
            this.videoEl.muted = false;
            if (this._mode === 'fullscreen')
                this.videoEl.play().catch(() => { });
            this._firstReadyToPlay = false;
        }
        _onPlay() {
            this.isPlaying = true;
            this._createEvent('Play', this._playerId);
        }
        _onPlaying() {
            this._createEvent('Playing', this._playerId);
        }
        _onPause() {
            this.isPlaying = false;
            this._createEvent('Pause', this._playerId);
        }
        /** Genera el CustomEvent para Capacitor */
        _createEvent(ev, playerId, msg) {
            var _a, _b;
            const detail = msg
                ? { fromPlayerId: playerId, message: msg }
                : { fromPlayerId: playerId, currentTime: (_b = (_a = this.videoEl) === null || _a === void 0 ? void 0 : _a.currentTime) !== null && _b !== void 0 ? _b : 0 };
            document.dispatchEvent(new CustomEvent(`videoPlayer${ev}`, { detail }));
        }
        /** Detecta tipo de video por extensión o query param */
        _getVideoType() {
            const s = this._url;
            const dotRe = new RegExp(`\\.(${Object.keys(videoTypes).join('|')})`, 'i');
            const queryRe = new RegExp(`=(${Object.keys(videoTypes).join('|')})`, 'i');
            const m = dotRe.exec(s) || queryRe.exec(s);
            if (m)
                return videoTypes[m[1]];
            return 'video/mp4';
        }
    }

    class CapacitorVideoPlayerWeb extends core.WebPlugin {
        constructor() {
            super();
            this._players = [];
            this.addListeners();
        }
        async echo(options) {
            return Promise.resolve({ result: true, method: 'echo', value: options });
        }
        /**
         *  Player initialization
         *
         * @param options
         */
        async initPlayer(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'initPlayer',
                    message: 'Must provide a capVideoPlayerOptions object',
                });
            }
            this.mode = options.mode ? options.mode : '';
            if (this.mode == null || this.mode.length === 0) {
                return Promise.resolve({
                    result: false,
                    method: 'initPlayer',
                    message: 'Must provide a Mode (fullscreen/embedded)',
                });
            }
            if (this.mode === 'fullscreen' || this.mode === 'embedded') {
                const url = options.url ? options.url : '';
                if (url == null || url.length === 0) {
                    return Promise.resolve({
                        result: false,
                        method: 'initPlayer',
                        message: 'Must provide a Video Url',
                    });
                }
                if (url == 'internal') {
                    return Promise.resolve({
                        result: false,
                        method: 'initPlayer',
                        message: 'Internal Videos not supported on Web Platform',
                    });
                }
                const playerId = options.playerId ? options.playerId : '';
                if (playerId == null || playerId.length === 0) {
                    return Promise.resolve({
                        result: false,
                        method: 'initPlayer',
                        message: 'Must provide a Player Id',
                    });
                }
                const rate = options.rate ? options.rate : 1.0;
                let exitOnEnd = true;
                if (Object.keys(options).includes('exitOnEnd')) {
                    const exitRet = options.exitOnEnd;
                    exitOnEnd = exitRet != null ? exitRet : true;
                }
                let loopOnEnd = false;
                if (Object.keys(options).includes('loopOnEnd') && !exitOnEnd) {
                    const loopRet = options.loopOnEnd;
                    loopOnEnd = loopRet != null ? loopRet : false;
                }
                const componentTag = options.componentTag ? options.componentTag : '';
                if (componentTag == null || componentTag.length === 0) {
                    return Promise.resolve({
                        result: false,
                        method: 'initPlayer',
                        message: 'Must provide a Component Tag',
                    });
                }
                let playerSize = null;
                if (this.mode === 'embedded') {
                    playerSize = this.checkSize(options);
                }
                const result = await this._initializeVideoPlayer(url, playerId, this.mode, rate, exitOnEnd, loopOnEnd, componentTag, playerSize);
                return Promise.resolve({ result: result });
            }
            else {
                return Promise.resolve({
                    result: false,
                    method: 'initPlayer',
                    message: 'Must provide a Mode either fullscreen or embedded)',
                });
            }
        }
        /**
         * Limpia un player embedded en web (o hace el “stub” si no aplica).
         */
        async removePlayer(options) {
            // Si usas un <video id="…"> podrías buscarlo y detenerlo:
            const el = document.getElementById(options.playerId || '');
            if (el) {
                el.pause();
                el.remove();
            }
            // Devuelve siempre un capVideoPlayerResult válido
            return {
                method: 'removePlayer',
                result: true
            };
        }
        /**
         * Return if a given playerId is playing
         *
         * @param options
         */
        async isPlaying(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'isPlaying',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                const playing = this._players[playerId].isPlaying;
                return Promise.resolve({
                    method: 'isPlaying',
                    result: true,
                    value: playing,
                });
            }
            else {
                return Promise.resolve({
                    method: 'isPlaying',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Play the current video from a given playerId
         *
         * @param options
         */
        async play(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'play',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                await this._players[playerId].videoEl.play();
                return Promise.resolve({ method: 'play', result: true, value: true });
            }
            else {
                return Promise.resolve({
                    method: 'play',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Pause the current video from a given playerId
         *
         * @param options
         */
        async pause(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'pause',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                if (this._players[playerId].isPlaying)
                    await this._players[playerId].videoEl.pause();
                return Promise.resolve({ method: 'pause', result: true, value: true });
            }
            else {
                return Promise.resolve({
                    method: 'pause',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Get the duration of the current video from a given playerId
         *
         * @param options
         */
        async getDuration(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'getDuration',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                const duration = this._players[playerId].videoEl.duration;
                return Promise.resolve({
                    method: 'getDuration',
                    result: true,
                    value: duration,
                });
            }
            else {
                return Promise.resolve({
                    method: 'getDuration',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Set the rate of the current video from a given playerId
         *
         * @param options
         */
        async setRate(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'setRate',
                    message: 'Must provide a capVideoRateOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            const rateList = [0.25, 0.5, 0.75, 1.0, 2.0, 4.0];
            const rate = options.rate && rateList.includes(options.rate) ? options.rate : 1.0;
            if (this._players[playerId]) {
                this._players[playerId].videoEl.playbackRate = rate;
                return Promise.resolve({
                    method: 'setRate',
                    result: true,
                    value: rate,
                });
            }
            else {
                return Promise.resolve({
                    method: 'setRate',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Get the volume of the current video from a given playerId
         *
         * @param options
         */
        async getRate(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'getRate',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                const rate = this._players[playerId].videoEl.playbackRate;
                return Promise.resolve({
                    method: 'getRate',
                    result: true,
                    value: rate,
                });
            }
            else {
                return Promise.resolve({
                    method: 'getRate',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Set the volume of the current video from a given playerId
         *
         * @param options
         */
        async setVolume(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'setVolume',
                    message: 'Must provide a capVideoVolumeOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            const volume = options.volume ? options.volume : 0.5;
            if (this._players[playerId]) {
                this._players[playerId].videoEl.volume = volume;
                return Promise.resolve({
                    method: 'setVolume',
                    result: true,
                    value: volume,
                });
            }
            else {
                return Promise.resolve({
                    method: 'setVolume',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Get the volume of the current video from a given playerId
         *
         * @param options
         */
        async getVolume(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'getVolume',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                const volume = this._players[playerId].videoEl.volume;
                return Promise.resolve({
                    method: 'getVolume',
                    result: true,
                    value: volume,
                });
            }
            else {
                return Promise.resolve({
                    method: 'getVolume',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Set the muted property of the current video from a given playerId
         *
         * @param options
         */
        async setMuted(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'setMuted',
                    message: 'Must provide a capVideoMutedOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            const muted = options.muted ? options.muted : false;
            if (this._players[playerId]) {
                this._players[playerId].videoEl.muted = muted;
                return Promise.resolve({
                    method: 'setMuted',
                    result: true,
                    value: muted,
                });
            }
            else {
                return Promise.resolve({
                    method: 'setMuted',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Get the muted property of the current video from a given playerId
         *
         * @param options
         */
        async getMuted(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'getMuted',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                const muted = this._players[playerId].videoEl.muted;
                return Promise.resolve({
                    method: 'getMuted',
                    result: true,
                    value: muted,
                });
            }
            else {
                return Promise.resolve({
                    method: 'getMuted',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Set the current time of the current video from a given playerId
         *
         * @param options
         */
        async setCurrentTime(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'setCurrentTime',
                    message: 'Must provide a capVideoTimeOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            let seekTime = options.seektime ? options.seektime : 0;
            if (this._players[playerId]) {
                const duration = this._players[playerId].videoEl.duration;
                seekTime = seekTime <= duration && seekTime >= 0 ? seekTime : duration / 2;
                this._players[playerId].videoEl.currentTime = seekTime;
                return Promise.resolve({
                    method: 'setCurrentTime',
                    result: true,
                    value: seekTime,
                });
            }
            else {
                return Promise.resolve({
                    method: 'setCurrentTime',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Get the current time of the current video from a given playerId
         *
         * @param options
         */
        async getCurrentTime(options) {
            if (options == null) {
                return Promise.resolve({
                    result: false,
                    method: 'getCurrentTime',
                    message: 'Must provide a capVideoPlayerIdOptions object',
                });
            }
            let playerId = options.playerId ? options.playerId : '';
            if (playerId == null || playerId.length === 0) {
                playerId = 'fullscreen';
            }
            if (this._players[playerId]) {
                const seekTime = this._players[playerId].videoEl.currentTime;
                return Promise.resolve({
                    method: 'getCurrentTime',
                    result: true,
                    value: seekTime,
                });
            }
            else {
                return Promise.resolve({
                    method: 'getCurrentTime',
                    result: false,
                    message: 'Given PlayerId does not exist)',
                });
            }
        }
        /**
         * Get the current time of the current video from a given playerId
         *
         */
        async stopAllPlayers() {
            for (const i in this._players) {
                if (this._players[i].pipMode) {
                    const doc = document;
                    if (doc.pictureInPictureElement) {
                        await doc.exitPictureInPicture();
                    }
                }
                if (!this._players[i].videoEl.paused)
                    this._players[i].videoEl.pause();
            }
            return Promise.resolve({
                method: 'stopAllPlayers',
                result: true,
                value: true,
            });
        }
        /**
         * Show controller
         *
         */
        async showController() {
            return Promise.resolve({
                method: 'showController',
                result: true,
                value: true,
            });
        }
        /**
         * isControllerIsFullyVisible
         *
         */
        async isControllerIsFullyVisible() {
            return Promise.resolve({
                method: 'isControllerIsFullyVisible',
                result: true,
                value: true,
            });
        }
        /**
         * Exit the current player
         *
         */
        async exitPlayer() {
            return Promise.resolve({
                method: 'exitPlayer',
                result: true,
                value: true,
            });
        }
        checkSize(options) {
            const playerSize = {
                width: options.width ? options.width : 320,
                height: options.height ? options.height : 180,
            };
            const ratio = playerSize.height / playerSize.width;
            if (playerSize.width > window.innerWidth) {
                playerSize.width = window.innerWidth;
                playerSize.height = Math.floor(playerSize.width * ratio);
            }
            if (playerSize.height > window.innerHeight) {
                playerSize.height = window.innerHeight;
                playerSize.width = Math.floor(playerSize.height / ratio);
            }
            return playerSize;
        }
        async _initializeVideoPlayer(url, playerId, mode, rate, exitOnEnd, loopOnEnd, componentTag, playerSize) {
            const videoURL = url ? (url.indexOf('%2F') == -1 ? encodeURI(url) : url) : null;
            if (videoURL === null)
                return Promise.resolve(false);
            this.videoContainer = await this._getContainerElement(playerId, componentTag);
            if (this.videoContainer === null)
                return Promise.resolve({
                    method: 'initPlayer',
                    result: false,
                    message: 'componentTag or divContainerElement must be provided',
                });
            if (mode === 'embedded' && playerSize == null)
                return Promise.resolve({
                    method: 'initPlayer',
                    result: false,
                    message: 'playerSize must be defined in embedded mode',
                });
            if (mode === 'embedded') {
                this._players[playerId] = new VideoPlayer('embedded', videoURL, playerId, rate, exitOnEnd, loopOnEnd, this.videoContainer, 2, playerSize.width, playerSize.height);
                await this._players[playerId].initialize();
            }
            else if (mode === 'fullscreen') {
                this._players['fullscreen'] = new VideoPlayer('fullscreen', videoURL, 'fullscreen', rate, exitOnEnd, loopOnEnd, this.videoContainer, 99995);
                await this._players['fullscreen'].initialize();
            }
            else {
                return Promise.resolve({
                    method: 'initPlayer',
                    result: false,
                    message: 'mode not supported',
                });
            }
            return Promise.resolve({ method: 'initPlayer', result: true, value: true });
        }
        async _getContainerElement(playerId, componentTag) {
            const videoContainer = document.createElement('div');
            videoContainer.id = `vc_${playerId}`;
            if (componentTag != null && componentTag.length > 0) {
                const cmpTagEl = document.querySelector(`${componentTag}`);
                if (cmpTagEl === null)
                    return Promise.resolve(null);
                let container = null;
                const shadowRoot = cmpTagEl.shadowRoot ? cmpTagEl.shadowRoot : null;
                if (shadowRoot != null) {
                    container = shadowRoot.querySelector(`[id='${playerId}']`);
                }
                else {
                    container = cmpTagEl.querySelector(`[id='${playerId}']`);
                }
                if (container != null)
                    container.appendChild(videoContainer);
                return Promise.resolve(videoContainer);
            }
            else {
                return Promise.resolve(null);
            }
        }
        handlePlayerPlay(data) {
            this.notifyListeners('jeepCapVideoPlayerPlay', data);
        }
        handlePlayerPause(data) {
            this.notifyListeners('jeepCapVideoPlayerPause', data);
        }
        handlePlayerEnded(data) {
            var _a;
            if (this.mode === 'fullscreen') {
                (_a = this.videoContainer) === null || _a === void 0 ? void 0 : _a.remove();
            }
            this.removeListeners();
            this.notifyListeners('jeepCapVideoPlayerEnded', data);
        }
        handlePlayerExit() {
            var _a;
            if (this.mode === 'fullscreen') {
                (_a = this.videoContainer) === null || _a === void 0 ? void 0 : _a.remove();
            }
            const retData = { dismiss: true };
            this.removeListeners();
            this.notifyListeners('jeepCapVideoPlayerExit', retData);
        }
        handlePlayerReady(data) {
            this.notifyListeners('jeepCapVideoPlayerReady', data);
        }
        addListeners() {
            document.addEventListener('videoPlayerPlay', (ev) => {
                this.handlePlayerPlay(ev.detail);
            }, false);
            document.addEventListener('videoPlayerPause', (ev) => {
                this.handlePlayerPause(ev.detail);
            }, false);
            document.addEventListener('videoPlayerEnded', (ev) => {
                this.handlePlayerEnded(ev.detail);
            }, false);
            document.addEventListener('videoPlayerReady', (ev) => {
                this.handlePlayerReady(ev.detail);
            }, false);
            document.addEventListener('videoPlayerExit', () => {
                this.handlePlayerExit();
            }, false);
        }
        removeListeners() {
            document.removeEventListener('videoPlayerPlay', (ev) => {
                this.handlePlayerPlay(ev.detail);
            }, false);
            document.removeEventListener('videoPlayerPause', (ev) => {
                this.handlePlayerPause(ev.detail);
            }, false);
            document.removeEventListener('videoPlayerEnded', (ev) => {
                this.handlePlayerEnded(ev.detail);
            }, false);
            document.removeEventListener('videoPlayerReady', (ev) => {
                this.handlePlayerReady(ev.detail);
            }, false);
            document.removeEventListener('videoPlayerExit', () => {
                this.handlePlayerExit();
            }, false);
        }
    }

    const NativeVideoPlayer = core.registerPlugin('CapacitorVideoPlayer', {
        web: () => new CapacitorVideoPlayerWeb(),
    });
    const CapacitorVideoPlayer = Object.assign(Object.assign({}, NativeVideoPlayer), { initPlayer(options) {
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
            if (options.mode === 'embedded') {
                return new CapacitorVideoPlayerWeb().removePlayer(options);
            }
            return NativeVideoPlayer.removePlayer(options);
        } });

    exports.CapacitorVideoPlayer = CapacitorVideoPlayer;

    return exports;

})({}, capacitorExports, Hls);
//# sourceMappingURL=plugin.js.map
