    async function download(data, filename, type) {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const bridge = window.ByndAndroid;
        if (bridge?.beginDocumentExport && bridge?.appendBackupExportChunk && bridge?.finishBackupExport) {
            return new Promise((resolve, reject) => {
                const token = id('comicexport');
                let done = false;
                const cleanup = () => {
                    window.removeEventListener('bynd:backup-export-ready', ready);
                    window.removeEventListener('bynd:backup-export', finished);
                    clearTimeout(timer);
                };
                const fail = error => {
                    if (done) return;
                    done = true; cleanup();
                    try { bridge.abortBackupExport(token); } catch (_) {}
                    reject(error instanceof Error ? error : new Error(String(error)));
                };
                const finished = event => {
                    if (event.detail?.id !== token || done) return;
                    if (!event.detail.ok) return fail(new Error(event.detail.message || '导出失败'));
                    done = true; cleanup(); resolve(event.detail.message || '文件已保存');
                };
                const ready = async event => {
                    if (event.detail?.id !== token || done) return;
                    try {
                        for (let offset = 0; offset < blob.size; offset += 192 * 1024) {
                            const chunk = blob.slice(offset, offset + 192 * 1024);
                            const base64 = await new Promise((resolveChunk, rejectChunk) => {
                                const reader = new FileReader();
                                reader.onload = () => resolveChunk(String(reader.result).split(',')[1] || '');
                                reader.onerror = () => rejectChunk(new Error('导出文件读取失败'));
                                reader.readAsDataURL(chunk);
                            });
                            if (done) return;
                            const accepted = bridge.appendBackupExportChunk(token, base64);
                            if (accepted !== true && accepted !== 'true') throw new Error('导出分段写入失败');
                            await new Promise(next => setTimeout(next, 0));
                        }
                        bridge.finishBackupExport(token);
                    } catch (error) { fail(error); }
                };
                const timer = setTimeout(() => fail(new Error('系统文件选择或写入超时')), 120000);
                window.addEventListener('bynd:backup-export-ready', ready);
                window.addEventListener('bynd:backup-export', finished);
                try { bridge.beginDocumentExport(token, filename, type); } catch (error) { fail(error); }
            });
        }
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
        anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
