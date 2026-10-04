package cc.ccwu.bynd;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;

/** Shares only temporary camera JPEGs, via per-URI grants to the system camera. */
public final class CameraPhotoProvider extends ContentProvider {
    static File directory(Context context) { return new File(context.getCacheDir(), "camera-photos"); }

    static Uri uriForPhoto(Context context, File photo) throws IOException {
        File allowed = SystemCameraPolicy.resolvePhoto(directory(context), photo.getName());
        if (!allowed.equals(photo.getCanonicalFile())) throw new IOException("Invalid camera photo location");
        return new Uri.Builder().scheme("content").authority(context.getPackageName() + ".camera")
                .appendPath("photos").appendPath(photo.getName()).build();
    }

    private File photo(Uri uri) throws FileNotFoundException {
        List<String> segments = uri.getPathSegments();
        if (!"content".equals(uri.getScheme()) || !getContext().getPackageName().concat(".camera").equals(uri.getAuthority())
                || segments.size() != 2 || !"photos".equals(segments.get(0))) {
            throw new FileNotFoundException("Invalid camera photo URI");
        }
        try { return SystemCameraPolicy.resolvePhoto(directory(getContext()), segments.get(1)); }
        catch (IOException error) { throw new FileNotFoundException(error.getMessage()); }
    }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return "image/jpeg"; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = photo(uri);
        if (!file.isFile()) throw new FileNotFoundException("Camera photo is unavailable");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode));
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        try {
            File file = photo(uri);
            String[] columns = projection != null ? projection : new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
            MatrixCursor cursor = new MatrixCursor(columns, 1);
            Object[] values = new Object[columns.length];
            for (int i = 0; i < columns.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = file.getName();
                else if (OpenableColumns.SIZE.equals(columns[i])) values[i] = file.length();
            }
            cursor.addRow(values);
            return cursor;
        } catch (FileNotFoundException error) { throw new IllegalArgumentException(error.getMessage(), error); }
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
