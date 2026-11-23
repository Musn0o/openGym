package ch.duartesantos.opengym;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;

public class MusicPlaybackService extends Service {
    static final String ACTION_PLAY = "ch.duartesantos.opengym.music.PLAY";
    static final String ACTION_PAUSE = "ch.duartesantos.opengym.music.PAUSE";
    static final String ACTION_RESUME = "ch.duartesantos.opengym.music.RESUME";
    static final String ACTION_STOP = "ch.duartesantos.opengym.music.STOP";
    static final String ACTION_NEXT = "ch.duartesantos.opengym.music.NEXT";
    static final String ACTION_PREV = "ch.duartesantos.opengym.music.PREV";
    static final String EXTRA_TRACKS = "tracks";
    static final String EXTRA_INDEX = "index";
    static final String EXTRA_TITLE = "title";
    private static final String CHANNEL_ID = "music-playback";
    private static final int NOTIF_ID = 71;

    private static MusicPlaybackService instance;
    private MediaPlayer player;
    private JSONArray tracks = new JSONArray();
    private int index = 0;
    private String playlistTitle = "openGym";
    private boolean playing = false;

    static JSObject state() {
        JSObject o = new JSObject();
        MusicPlaybackService s = instance;
        o.put("playing", s != null && s.playing);
        o.put("index", s == null ? 0 : s.index);
        o.put("title", s == null ? "" : s.currentName());
        o.put("playlist", s == null ? "" : s.playlistTitle);
        return o;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_PLAY.equals(action)) {
            load(intent);
            startTrack(index);
        } else if (ACTION_PAUSE.equals(action)) {
            pause();
        } else if (ACTION_RESUME.equals(action)) {
            resume();
        } else if (ACTION_STOP.equals(action)) {
            stopPlayback();
            return START_NOT_STICKY;
        } else if (ACTION_NEXT.equals(action)) {
            next();
        } else if (ACTION_PREV.equals(action)) {
            prev();
        }
        return START_STICKY;
    }

    private void load(Intent intent) {
        try { tracks = new JSONArray(intent.getStringExtra(EXTRA_TRACKS)); } catch (Exception e) { tracks = new JSONArray(); }
        index = Math.max(0, intent.getIntExtra(EXTRA_INDEX, 0));
        String t = intent.getStringExtra(EXTRA_TITLE);
        playlistTitle = (t == null || t.isEmpty()) ? "openGym" : t;
    }

    private void startTrack(int i) {
        if (tracks.length() == 0) { stopPlayback(); return; }
        index = ((i % tracks.length()) + tracks.length()) % tracks.length();
        releasePlayer();
        try {
            JSONObject t = tracks.getJSONObject(index);
            String src = t.optString("src", "");
            String uri = t.optString("uri", "");
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .setUsage(AudioAttributes.USAGE_MEDIA).build());
            if (!uri.isEmpty()) {
                player.setDataSource(this, Uri.parse(uri));
            } else {
                java.io.File f = new java.io.File(new java.io.File(getFilesDir(), MusicPlayerPlugin.DIR), src);
                if (!f.exists()) { next(); return; }
                player.setDataSource(f.getAbsolutePath());
            }
            player.setOnPreparedListener(mp -> { mp.start(); playing = true; notifyState(); });
            player.setOnCompletionListener(mp -> next());
            player.setOnErrorListener((mp, what, extra) -> { next(); return true; });
            player.prepareAsync();
            startForeground(NOTIF_ID, buildNotification("Loading..."));
        } catch (Exception e) {
            next();
        }
    }

    private void pause() {
        if (player != null && player.isPlaying()) { player.pause(); playing = false; notifyState(); }
    }

    private void resume() {
        if (player != null && !player.isPlaying()) { player.start(); playing = true; notifyState(); }
        else if (player == null && tracks.length() > 0) startTrack(index);
    }

    private void next() {
        if (tracks.length() == 0) { stopPlayback(); return; }
        startTrack(index + 1);
    }

    private void prev() {
        if (tracks.length() == 0) { stopPlayback(); return; }
        int pos = player != null ? player.getCurrentPosition() : 0;
        startTrack(pos > 3000 ? index : index - 1);
    }

    private void stopPlayback() {
        playing = false;
        releasePlayer();
        stopForeground(true);
        stopSelf();
        notifyState();
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.reset(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
    }

    private String currentName() {
        try { return tracks.getJSONObject(index).optString("name", "Track"); } catch (Exception e) { return "Track"; }
    }

    private void notifyState() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(currentName()));
    }

    private Notification buildNotification(String name) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent del = new Intent(this, MusicPlaybackService.class).setAction(ACTION_STOP);
        int delFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent delPi = Build.VERSION.SDK_INT >= 26 ? PendingIntent.getForegroundService(this, 5, del, delFlags) : PendingIntent.getService(this, 5, del, delFlags);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(name)
            .setContentText(playlistTitle)
            .setSmallIcon(R.drawable.ic_stat_dumbbell)
            .setContentIntent(pi)
            .setDeleteIntent(delPi)
            .setOnlyAlertOnce(true)
            .setOngoing(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        b.addAction(0, "Prev", servicePi(ACTION_PREV, 1));
        b.addAction(0, playing ? "Pause" : "Play", servicePi(playing ? ACTION_PAUSE : ACTION_RESUME, 2));
        b.addAction(0, "Next", servicePi(ACTION_NEXT, 3));
        b.addAction(0, "Stop", servicePi(ACTION_STOP, 4));
        return b.build();
    }

    private PendingIntent servicePi(String action, int req) {
        Intent i = new Intent(this, MusicPlaybackService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= 26) return PendingIntent.getForegroundService(this, req, i, flags);
        return PendingIntent.getService(this, req, i, flags);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Workout music", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Music playback during workouts");
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopPlayback();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
