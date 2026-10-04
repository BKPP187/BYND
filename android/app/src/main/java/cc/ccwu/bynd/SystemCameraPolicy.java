package cc.ccwu.bynd;

import java.io.File;
import java.io.IOException;

/** Camera selection, result validation and private cache boundaries, independent of Android UI. */
final class SystemCameraPolicy {
    static boolean shouldCaptureImage(boolean captureEnabled, String[] acceptTypes) {
        if (!captureEnabled || acceptTypes == null) return false;
        boolean image = false;
        for (String accept : acceptTypes) {
            if (accept == null) continue;
            for (String type : accept.split(",")) {
                type = type.trim();
                if (type.isEmpty()) continue;
                if (!type.startsWith("image/")) return false;
                image = true;
            }
        }
        return image;
    }

    static boolean hasCapturedPhoto(boolean completed, File photo) {
        return completed && photo != null && photo.isFile() && photo.length() > 0;
    }

    static File resolvePhoto(File directory, String name) throws IOException {
        if (name == null || !name.matches("bynd-camera-[A-Za-z0-9_-]+\\.jpg")) {
            throw new IOException("Invalid camera photo name");
        }
        File root = directory.getCanonicalFile();
        File photo = new File(root, name).getCanonicalFile();
        if (!root.equals(photo.getParentFile())) throw new IOException("Camera photo is outside the private cache");
        return photo;
    }
}
