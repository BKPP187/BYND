import SwiftUI
import WebKit
import UniformTypeIdentifiers

struct HealthWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalAssets(), forURLScheme: "bynd-app")
        config.userContentController.add(context.coordinator, name: "byndHealth")
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { view.isInspectable = false }
        context.coordinator.view = view
        view.load(URLRequest(url: URL(string: "bynd-app://app/index.html")!))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var view: WKWebView?
        let health = HealthKitReader()
        var busy = false
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.request.url?.scheme == "bynd-app",
                  message.frameInfo.request.url?.host == "app",
                  let payload = message.body as? [String: Any],
                  let id = payload["id"] as? String, id.count < 120,
                  let action = payload["action"] as? String,
                  let types = payload["types"] as? [String] else { return }
            if busy { reply(id: id, result: .failure(HealthError.message("已有健康请求正在处理"))); return }
            busy = true
            health.perform(action: action, types: types) { [weak self] result in
                DispatchQueue.main.async {
                    self?.busy = false
                    self?.reply(id: id, result: result)
                }
            }
        }
        private func reply(id: String, result: Result<[String: Any], Error>) {
            var payload: [String: Any] = ["id": id]
            switch result {
            case .success(let data): payload["ok"] = true; payload["data"] = data
            case .failure(let error): payload["ok"] = false; payload["error"] = error.localizedDescription
            }
            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            view?.evaluateJavaScript("window.ByndNativeHealth?.onReply(\(json));", completionHandler: nil)
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "bynd-app" && url.host == "app" { decisionHandler(.allow); return }
            if navigationAction.navigationType == .linkActivated && ["https", "http"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }
}

final class LocalAssets: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.host == "app",
              let root = Bundle.main.url(forResource: "www", withExtension: nil) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let base = root.resolvingSymlinksInPath().standardizedFileURL
        let file = base.appendingPathComponent(url.path == "/" ? "index.html" : String(url.path.dropFirst())).resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(base.path + "/"), let data = try? Data(contentsOf: file) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let overrides = ["js": "application/javascript", "css": "text/css", "html": "text/html", "json": "application/json", "webmanifest": "application/manifest+json", "svg": "image/svg+xml"]
        let mime = overrides[file.pathExtension] ?? UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        urlSchemeTask.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: mime.hasPrefix("text/") || mime.contains("javascript") ? "utf-8" : nil))
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
