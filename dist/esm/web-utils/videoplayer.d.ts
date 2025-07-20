export declare class VideoPlayer {
    private readonly _mode;
    private readonly _url;
    private readonly _playerId;
    private readonly _videoRate;
    private readonly _videoExitOnEnd;
    private readonly _videoLoopOnEnd;
    private readonly _container;
    private readonly _zIndex;
    private readonly _width;
    private readonly _height;
    videoEl: HTMLVideoElement;
    pipMode: boolean;
    pipWindow?: PictureInPictureWindow;
    isPlaying: boolean;
    private _videoType;
    private _videoContainer;
    private _firstReadyToPlay;
    private _isEnded;
    private _initialTimer;
    constructor(_mode: 'embedded' | 'fullscreen', _url: string, _playerId: string, _videoRate: number, _videoExitOnEnd: boolean, _videoLoopOnEnd: boolean, _container: HTMLDivElement, _zIndex: number, _width?: number, _height?: number);
    /** Inicializa y monta el player */
    initialize(): Promise<void>;
    /** Detiene y limpia todo */
    destroy(): Promise<void>;
    /** Aplica los estilos comunes al contenedor raíz */
    private _applyContainerStyles;
    /** Crea el elemento <video> y engancha HLS o MP4 */
    private _createVideoElement;
    /** Carga HLS o MP4 y registra PIP listeners */
    private _setupSourceAndListeners;
    /** Crea y muestra el botón “X” para salir */
    private _addExitButton;
    /** Solicita fullscreen */
    private _goFullscreen;
    /** Sale de fullscreen, sin lanzar errores si no estás en ese modo */
    private _exitFullscreen;
    private _onEnded;
    private _onReady;
    private _onPlay;
    private _onPlaying;
    private _onPause;
    /** Genera el CustomEvent para Capacitor */
    private _createEvent;
    /** Detecta tipo de video por extensión o query param */
    private _getVideoType;
}
