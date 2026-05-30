import hashlib
import os
import json
import shutil
from huggingface_hub import hf_hub_download

# SHA-256 of the trusted convnext.onnx from Xenova/convnext-base-224-22k.
# Update this constant whenever the model is intentionally upgraded.
EXPECTED_ONNX_SHA256 = (
    "5d36f3ed20cb2a01392149036a2922f0cb7982f2d3e857fef1af66befb678f17"
)


def verify_sha256(file_path: str, expected: str) -> None:
    """Raise RuntimeError and remove the file if its SHA-256 does not match."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    actual = sha256.hexdigest()
    if actual != expected:
        os.remove(file_path)
        raise RuntimeError(
            f"Model integrity check FAILED.\n"
            f"  Expected: {expected}\n"
            f"  Got:      {actual}\n"
            f"The file has been removed. Do not bundle or use this model."
        )
    print(f"Integrity check passed: SHA-256 matches.")


def download_model():
    output_dir = os.path.join("src-tauri", "resources")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Download model.onnx (FP32 model from Xenova)
    print("Downloading pre-converted ConvNeXt ONNX model (FP32)...")
    target_path = os.path.join(output_dir, "convnext.onnx")
    try:
        downloaded_path = hf_hub_download(
            repo_id="Xenova/convnext-base-224-22k",
            filename="onnx/model.onnx",
            local_dir=output_dir,
            local_dir_use_symlinks=False,
        )
        # huggingface_hub download structures inside onnx/model.onnx
        downloaded_onnx_dir = os.path.join(output_dir, "onnx")
        downloaded_onnx_file = os.path.join(downloaded_onnx_dir, "model.onnx")

        if os.path.exists(downloaded_onnx_file):
            shutil.move(downloaded_onnx_file, target_path)
            shutil.rmtree(downloaded_onnx_dir)
            print(f"ONNX Model saved to: {target_path}")
        else:
            print(f"Model already placed or downloaded at: {downloaded_path}")
    except Exception as e:
        print(f"Failed to download/move model: {e}")
        return

    # Integrity check is outside the download try/except so it always fails loudly
    print("Verifying model integrity...")
    verify_sha256(target_path, EXPECTED_ONNX_SHA256)

    # 2. Download config.json and extract labels
    print("Downloading config.json to extract class labels...")
    try:
        config_path = hf_hub_download(
            repo_id="Xenova/convnext-base-224-22k", filename="config.json"
        )
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        id2label = config["id2label"]
        sorted_keys = sorted(id2label.keys(), key=int)
        labels_list = [id2label[k] for k in sorted_keys]

        labels_path = os.path.join(output_dir, "convnext_labels.json")
        with open(labels_path, "w", encoding="utf-8") as f:
            json.dump(labels_list, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(labels_list)} labels to {labels_path}")
    except Exception as e:
        print(f"Failed to extract labels: {e}")


if __name__ == "__main__":
    download_model()
