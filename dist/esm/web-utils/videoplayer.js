import Hls from 'hls.js';
import { videoTypes } from './video-types';
export class VideoPlayer {
    constructor(_mode, _url, _playerId, _videoRate, _videoExitOnEnd, _videoLoopOnEnd, _container, _zIndex, _width = 320, _height = 180) {
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
        // 2) svg póster negro
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${this._width} ${this._height}`);
        svg.innerHTML = `<rect width="${this._width}" height="${this._height}" fill="#000"/>`;
        svg.style.zIndex = `${this._zIndex + 1}`;
        this._container.appendChild(svg);
        // 3) contenedor interno para el video
        const heightVideo = Math.floor((this._width * this._height) / this._width);
        this._videoContainer = document.createElement('div');
        Object.assign(this._videoContainer.style, {
            position: 'absolute',
            left: '0',
            width: `${this._width}px`,
            height: `${heightVideo}px`,
            zIndex: `${this._zIndex + 2}`,
        });
        this._container.appendChild(this._videoContainer);
        // 4) crea y configura elemento <video>
        const created = await this._createVideoElement(this._width, heightVideo);
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
            width: this._mode === 'fullscreen' ? '100vw' : `${this._width}px`,
            height: this._mode === 'fullscreen' ? '100vh' : `${this._height}px`,
            left: '0',
            top: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            zIndex: `${this._zIndex}`,
        });
    }
    /** Crea el elemento <video> y engancha HLS o MP4 */
    async _createVideoElement(width, height) {
        this.videoEl = document.createElement('video');
        Object.assign(this.videoEl, {
            controls: true,
            playsInline: true,
            playbackRate: this._videoRate,
        });
        this.videoEl.setAttribute('webkit-playsinline', 'true');
        this.videoEl.setAttribute('playsinline', 'true');
        Object.assign(this.videoEl.style, {
            zIndex: `${this._zIndex + 3}`,
            width: `${width}px`,
            height: `${height}px`,
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
                this.pipMode = false;
                // Solo reingresa a fullscreen si el modo original era fullscreen
                if (this._mode === 'fullscreen' && !this._isEnded) {
                    this._goFullscreen();
                }
                this.videoEl.play().catch(() => { });
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
    /** Sale de fullscreen */
    _exitFullscreen() {
        const doc = document;
        if (doc.exitFullscreen) {
            doc.exitFullscreen();
        }
        else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
        }
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
        let m = dotRe.exec(s) || queryRe.exec(s);
        if (m) {
            return videoTypes[m[1]];
        }
        // por defecto MP4
        return 'video/mp4';
    }
}
//# sourceMappingURL=videoplayer.js.map