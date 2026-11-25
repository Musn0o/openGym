package ch.duartesantos.opengym;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;

public class MusicMediaButtonReceiver extends BroadcastReceiver {
    private static final long DOUBLE_TAP_MS = 350;
    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static volatile long lastHook;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) return;
        KeyEvent key = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
        if (key == null || key.getAction() != KeyEvent.ACTION_DOWN || key.getRepeatCount() > 0) return;
        switch (key.getKeyCode()) {
            case KeyEvent.KEYCODE_HEADSETHOOK: {
                long now = android.os.SystemClock.uptimeMillis();
                if (now - lastHook < DOUBLE_TAP_MS) {
                    lastHook = 0;
                    send(context, MusicPlaybackService.ACTION_NEXT);
                } else {
                    lastHook = now;
                    HANDLER.postDelayed(() -> {
                        if (lastHook == now) { lastHook = 0; send(context, MusicPlaybackService.ACTION_PLAY_PAUSE); }
                    }, DOUBLE_TAP_MS);
                }
                break;
            }
            case KeyEvent.KEYCODE_MEDIA_NEXT: send(context, MusicPlaybackService.ACTION_NEXT); break;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: send(context, MusicPlaybackService.ACTION_PREV); break;
            case KeyEvent.KEYCODE_MEDIA_STOP: send(context, MusicPlaybackService.ACTION_STOP); break;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE: send(context, MusicPlaybackService.ACTION_PLAY_PAUSE); break;
            default: break;
        }
    }

    private static void send(Context context, String action) {
        Intent i = new Intent(context, MusicPlaybackService.class).setAction(action);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i);
        else context.startService(i);
    }
}
