import os
import json
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification


def export_convnext():
    output_dir = os.path.join("src-tauri", "resources")
    os.makedirs(output_dir, exist_ok=True)

    # We use Meta's ConvNeXt Base trained on ImageNet-22k (21,841 classes)
    model_name = "facebook/convnext-base-224-22k"
    print(f"Loading {model_name} from Hugging Face...")

    processor = AutoImageProcessor.from_pretrained(model_name)
    model = AutoModelForImageClassification.from_pretrained(model_name)
    model.eval()

    # 1. Export labels
    print("Exporting class labels...")
    id2label = model.config.id2label
    # Sort keys numerically to align with model output tensor (which has 21841 features)
    sorted_keys = sorted(id2label.keys(), key=int)
    labels_list = [id2label[k] for k in sorted_keys]

    labels_path = os.path.join(output_dir, "convnext_labels.json")
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(labels_list, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(labels_list)} labels to {labels_path}")

    # 2. Export model to ONNX
    dummy_input = torch.randn(1, 3, 224, 224)
    onnx_path = os.path.join(output_dir, "convnext.onnx")

    print(f"Exporting model to ONNX at {onnx_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["logits"],
    )
    print("Model exported to ONNX successfully!")


if __name__ == "__main__":
    try:
        export_convnext()
    except Exception as e:
        print(f"Error during export: {e}")
