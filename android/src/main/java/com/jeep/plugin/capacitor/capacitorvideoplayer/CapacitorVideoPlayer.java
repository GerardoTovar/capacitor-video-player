package com.jeep.plugin.capacitor.capacitorvideoplayer;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.jeep.plugin.capacitor.capacitorvideoplayer.PickerVideo.PickerVideoFragment;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.ui.PlayerView;

public class CapacitorVideoPlayer {
    private Map<String, ExoPlayer> playersMap = new HashMap<>();
    private final Context context;

    CapacitorVideoPlayer(Context context) {
        this.context = context;
    }

    public String echo(String value) {
        return value;
    }

    public FullscreenExoPlayerFragment createFullScreenFragment(
        String videoPath,
        Float videoRate,
        Boolean exitOnEnd,
        Boolean loopOnEnd,
        Boolean pipEnabled,
        Boolean bkModeEnabled,
        Boolean showControls,
        String displayMode,
        String subTitle,
        String language,
        JSObject subTitleOptions,
        JSObject headers,
        String title,
        String smallTitle,
        String accentColor,
        Boolean chromecast,
        String artwork,
        Boolean isTV,
        String playerId,
        Boolean isInternal,
        Long videoId
    ) {
        FullscreenExoPlayerFragment fsFragment = new FullscreenExoPlayerFragment();

        fsFragment.videoPath = videoPath;
        fsFragment.videoRate = videoRate;
        fsFragment.exitOnEnd = exitOnEnd;
        fsFragment.loopOnEnd = loopOnEnd;
        fsFragment.pipEnabled = pipEnabled;
        fsFragment.bkModeEnabled = bkModeEnabled;
        fsFragment.showControls = showControls;
        fsFragment.displayMode = displayMode;
        fsFragment.subTitle = subTitle;
        fsFragment.language = language;
        fsFragment.subTitleOptions = subTitleOptions;
        fsFragment.headers = headers;
        fsFragment.title = title;
        fsFragment.smallTitle = smallTitle;
        fsFragment.accentColor = accentColor;
        fsFragment.chromecast = chromecast;
        fsFragment.artwork = artwork;
        fsFragment.isTV = isTV;
        fsFragment.playerId = playerId;
        fsFragment.isInternal = isInternal;
        fsFragment.videoId = videoId;
        return fsFragment;
    }

    public PickerVideoFragment createPickerVideoFragment() {
        return new PickerVideoFragment();
    }
    public void initEmbeddedPlayer(PluginCall call, String playerId, String url, FrameLayout container) {
        // 1) Crear ExoPlayer
        ExoPlayer player = new ExoPlayer.Builder(container.getContext()).build();
        // 2) Crear PlayerView
        PlayerView playerView = new PlayerView(container.getContext());
        playerView.setPlayer(player);
        playerView.setLayoutParams(
            new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        // 3) Añadir al contenedor
        container.addView(playerView);
        // 4) Preparar y reproducir
        MediaItem item = MediaItem.fromUri(url);
        player.setMediaItem(item);
        player.prepare();
        player.play();
        // 5) Guardar instancia para controles futuros
        playersMap.put(playerId, player);
        // 6) Notificar al JS
        JSObject ret = new JSObject();
        ret.put("method", "initPlayer");
        ret.put("result", true);
        call.resolve(ret);
    }

}
