// Temporary inference worker. Vendor/model bytes come from bundled app assets.
self.onmessage = async ({ data }) => {
    let session, runtimeUrl;
    try {
        runtimeUrl = URL.createObjectURL(new Blob([data.runtime], { type: 'text/javascript' }));
        const ort = await import(runtimeUrl);
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
        ort.env.wasm.initTimeout = 30000;
        ort.env.wasm.wasmBinary = new Uint8Array(data.wasm);
        session = await ort.InferenceSession.create(new Uint8Array(data.model), { executionProviders: ['wasm'] });
        self.postMessage({ progress: '正在保留人物与随身物品…' });
        const input = new ort.Tensor('float32', new Float32Array(data.input), [1, 3, 320, 320]);
        const output = await session.run({ [session.inputNames[0]]: input });
        const mask = output[session.outputNames[0]];
        if (mask.data.length !== 320 * 320) throw new Error('背景识别结果尺寸异常。');
        const values = new Float32Array(mask.data);
        self.postMessage({ mask: values.buffer }, [values.buffer]);
    } catch (error) {
        self.postMessage({ error: String(error?.message || error) });
    } finally {
        if (session) await session.release().catch(() => {});
        if (runtimeUrl) URL.revokeObjectURL(runtimeUrl);
    }
};
