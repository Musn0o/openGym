package ch.duartesantos.opengym;

import android.Manifest;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "MusicPlayer", permissions = {
    @Permission(strings = { Manifest.permission.READ_MEDIA_AUDIO }, alias = "audio"),
    @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "storage")
})
public class MusicPlayerPlugin extends Plugin {
    static final String DIR = "opengym-music";

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        startActivityForResult(call, intent, "pickResult");
    }

    @PluginMethod
    public void scan(PluginCall call) {
        if (hasAudioPermission()) {
            doScan(call);
        } else {
            requestPermissionForAlias(alias(), call, "scanPermsCallback");
        }
    }

    @PermissionCallback
    private void scanPermsCallback(PluginCall call) {
        if (hasAudioPermission()) doScan(call);
        else {
            JSObject ret = new JSObject();
            ret.put("tracks", new JSArray());
            call.resolve(ret);
        }
    }

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    private boolean hasAudioPermission() {
        return getPermissionState(alias()) == PermissionState.GRANTED;
    }

    private void doScan(PluginCall call) {
        JSArray tracks = new JSArray();
        Uri collection = Build.VERSION.SDK_INT >= 29
            ? MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
            : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = { MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.DURATION };
        String selection = MediaStore.Audio.Media.IS_MUSIC + "!=0";
        try (Cursor c = getContext().getContentResolver().query(collection, projection, selection, null, MediaStore.Audio.Media.TITLE + " ASC")) {
            if (c != null) {
                int idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int nameCol = c.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME);
                int titleCol = c.getColumnIndex(MediaStore.Audio.Media.TITLE);
                int durCol = c.getColumnIndex(MediaStore.Audio.Media.DURATION);
                while (c.moveToNext()) {
                    long id = c.getLong(idCol);
                    String display = nameCol >= 0 ? c.getString(nameCol) : null;
                    String title = titleCol >= 0 ? c.getString(titleCol) : null;
                    String name = (title != null && !title.trim().isEmpty()) ? title.trim() : titleOf(display == null ? "Track" : display);
                    Uri contentUri = ContentUris.withAppendedId(collection, id);
                    JSObject t = new JSObject();
                    t.put("id", "media-" + id);
                    t.put("name", name.length() > 120 ? name.substring(0, 120) : name);
                    t.put("uri", contentUri.toString());
                    if (durCol >= 0) t.put("dur", Math.round(c.getLong(durCol) / 1000.0));
                    tracks.put(t);
                }
            }
        } catch (Exception ignored) {}
        JSObject ret = new JSObject();
        ret.put("tracks", tracks);
        call.resolve(ret);
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject ret = new JSObject();
            ret.put("tracks", new JSArray());
            call.resolve(ret);
            return;
        }
        Intent data = result.getData();
        JSArray tracks = new JSArray();
        if (data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                Uri uri = data.getClipData().getItemAt(i).getUri();
                JSObject t = importUri(uri);
                if (t != null) tracks.put(t);
            }
        } else if (data.getData() != null) {
            JSObject t = importUri(data.getData());
            if (t != null) tracks.put(t);
        }
        JSObject ret = new JSObject();
        ret.put("tracks", tracks);
        call.resolve(ret);
    }

    private JSObject importUri(Uri uri) {
        try {
            String name = displayName(uri);
            String ext = extOf(name);
            String id = UUID.randomUUID().toString();
            String fileName = id + (ext.isEmpty() ? ".audio" : "." + ext);
            File dir = new File(getContext().getFilesDir(), DIR);
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, fileName);
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 OutputStream os = new FileOutputStream(out)) {
                if (in == null) return null;
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }
            JSObject t = new JSObject();
            t.put("id", id);
            t.put("name", titleOf(name));
            t.put("src", fileName);
            return t;
        } catch (Exception e) {
            return null;
        }
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) return c.getString(i);
            }
        } catch (Exception ignored) {}
        String last = uri.getLastPathSegment();
        return last == null ? "Track" : last;
    }

    private static String extOf(String name) {
        int i = name.lastIndexOf('.');
        if (i < 0 || i == name.length() - 1) return "";
        String ext = name.substring(i + 1).toLowerCase();
        if (ext.length() > 10) return "";
        return ext.replaceAll("[^a-z0-9]", "");
    }

    private static String titleOf(String name) {
        int i = name.lastIndexOf('.');
        String base = i > 0 ? name.substring(0, i) : name;
        base = base.replace('_', ' ').replace('-', ' ').trim();
        if (base.isEmpty()) return "Track";
        return base.length() > 120 ? base.substring(0, 120) : base;
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String src = call.getString("src", "");
        if (!src.isEmpty() && !src.contains("/") && !src.contains("\\")) {
            File f = new File(new File(getContext().getFilesDir(), DIR), src);
            if (f.exists()) f.delete();
        }
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        JSArray tracks = call.getArray("tracks");
        int index = call.getInt("index", 0);
        String title = call.getString("title", "openGym");
        Intent i = new Intent(getContext(), MusicPlaybackService.class);
        i.setAction(MusicPlaybackService.ACTION_PLAY);
        i.putExtra(MusicPlaybackService.EXTRA_TRACKS, tracks == null ? "[]" : tracks.toString());
        i.putExtra(MusicPlaybackService.EXTRA_INDEX, index);
        i.putExtra(MusicPlaybackService.EXTRA_TITLE, title);
        try {
            if (android.os.Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Intent i = new Intent(getContext(), MusicPlaybackService.class);
        i.setAction(MusicPlaybackService.ACTION_PAUSE);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        Intent i = new Intent(getContext(), MusicPlaybackService.class);
        i.setAction(MusicPlaybackService.ACTION_RESUME);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent i = new Intent(getContext(), MusicPlaybackService.class);
        i.setAction(MusicPlaybackService.ACTION_STOP);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void next(PluginCall call) {
        Intent i = new Intent(getContext(), MusicPlaybackService.class);
        i.setAction(MusicPlaybackService.ACTION_NEXT);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void prev(PluginCall call) {
        Intent i = new Intent(getContext(), MusicPlaybackService.class);
        i.setAction(MusicPlaybackService.ACTION_PREV);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void state(PluginCall call) {
        call.resolve(MusicPlaybackService.state());
    }

    @PluginMethod
    public void permission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("state", hasAudioPermission() ? "granted" : "prompt");
        call.resolve(ret);
    }
}
