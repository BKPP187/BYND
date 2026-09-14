Local background removal uses U²-Net small (U2NETP) by Xuebin Qin and collaborators (Apache-2.0) and ONNX Runtime Web 1.29.0 by Microsoft (MIT). Their licenses and ONNX Runtime's third-party notices accompany these files.

Sources:

- https://github.com/xuebinqin/U-2-Net
- https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py
- https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
- https://www.npmjs.com/package/onnxruntime-web/v/1.29.0
- https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html

The model is the ONNX conversion distributed by rembg. Its checksum matches the upstream session definition (MD5 8e83ca70e441ab06c318d82300c84806); SHA-256: 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8.

The runtime files are unchanged files from the same npm distribution. Its archive was checked against npm's SHA-512 integrity before extracting the WASM bundle and matching binary. Keep those two files at the same version when updating.

U2NETP normalization follows the upstream implementation: RGB resized to 320 × 320, divided by its maximum value, normalized with ImageNet means/deviations, then arranged as NCHW. Only the resulting alpha mask is applied to the original image. Inference runs in a temporary local worker; images are not sent to a background-removal service. The worker is terminated after each image to free its model memory.
