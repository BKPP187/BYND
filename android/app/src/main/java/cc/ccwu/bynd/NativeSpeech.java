package cc.ccwu.bynd;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * Android system speech recognition for live calls. Every event goes to the page as
 * { type: begin|partial|final|end|error, text, fatal }; the page restarts listening after each phrase.
 * Must be used on the main thread.
 */
final class NativeSpeech {
    interface Sink { void emit(String json); }

    private final Context context;
    private final Sink sink;
    private SpeechRecognizer recognizer;
    private boolean active;
    private int transientErrors;

    NativeSpeech(Context context, Sink sink) {
        this.context = context.getApplicationContext();
        this.sink = sink;
    }

    static boolean available(Context context) {
        try { return SpeechRecognizer.isRecognitionAvailable(context); } catch (Exception error) { return false; }
    }

    void start(String language) {
        if (!available(context)) { emit("error", "这台手机没有系统语音识别服务", true); return; }
        if (recognizer == null) {
            try {
                recognizer = SpeechRecognizer.createSpeechRecognizer(context);
                recognizer.setRecognitionListener(listener);
            } catch (Exception error) {
                recognizer = null;
                emit("error", "系统语音识别启动失败", true);
                return;
            }
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language == null || language.isEmpty() ? "zh-CN" : language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.getPackageName());
        // Hints only; many recognizers ignore them.
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 900L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 700L);
        active = true;
        try {
            recognizer.cancel();
            recognizer.startListening(intent);
        } catch (Exception error) {
            active = false;
            emit("error", "系统语音识别启动失败", false);
        }
    }

    void stop() {
        active = false;
        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) {}
        }
    }

    void destroy() {
        stop();
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    private void emit(String type, String text, boolean fatal) {
        try {
            JSONObject event = new JSONObject();
            event.put("type", type);
            if (text != null) event.put("text", text);
            if (fatal) event.put("fatal", true);
            sink.emit(event.toString());
        } catch (Exception ignored) {}
    }

    private static String first(Bundle results) {
        if (results == null) return "";
        ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return list == null || list.isEmpty() || list.get(0) == null ? "" : list.get(0);
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() { if (active) emit("begin", null, false); }
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onPartialResults(Bundle partialResults) {
            String text = first(partialResults);
            if (active && !text.isEmpty()) emit("partial", text, false);
        }

        @Override
        public void onResults(Bundle results) {
            transientErrors = 0;
            if (!active) return;
            active = false;
            String text = first(results);
            if (!text.isEmpty()) emit("final", text, false);
            emit("end", null, false);
        }

        @Override
        public void onError(int error) {
            if (!active) return;
            active = false;
            switch (error) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    transientErrors = 0;
                    emit("end", null, false);
                    return;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    emit("error", "没有麦克风权限", true);
                    return;
                case 12: // ERROR_LANGUAGE_NOT_SUPPORTED (API 31)
                case 13: // ERROR_LANGUAGE_UNAVAILABLE (API 31)
                    emit("error", "系统语音识别不支持中文", true);
                    return;
                default:
                    // Network/server/busy errors: retry a few times, then let the page fall back.
                    transientErrors += 1;
                    emit("error", "系统语音识别暂时不可用", transientErrors >= 4);
            }
        }
    };
}
