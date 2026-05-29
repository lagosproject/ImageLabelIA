import os
import torch
from transformers import ViTForImageClassification, DetrForObjectDetection


def export_vit(output_dir):
    print("Loading Google ViT (Vision Transformer) model...")
    model_name = "google/vit-base-patch16-224"
    model = ViTForImageClassification.from_pretrained(model_name)
    model.eval()

    dummy_input = torch.randn(1, 3, 224, 224)
    output_path = os.path.join(output_dir, "vit.onnx")

    print(f"Exporting ViT to {output_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["logits"],
        dynamic_axes={"pixel_values": {0: "batch_size"}, "logits": {0: "batch_size"}},
    )
    print("ViT exported successfully!")


def export_detr(output_dir):
    print("Loading Facebook DETR (Detection Transformer) model...")
    model_name = "facebook/detr-resnet-50"
    model = DetrForObjectDetection.from_pretrained(model_name)
    model.eval()

    dummy_input = torch.randn(1, 3, 800, 800)
    output_path = os.path.join(output_dir, "detr.onnx")

    print(f"Exporting DETR to {output_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["logits", "pred_boxes"],
        dynamic_axes={
            "pixel_values": {0: "batch_size", 2: "height", 3: "width"},
            "logits": {0: "batch_size", 1: "num_queries"},
            "pred_boxes": {0: "batch_size", 1: "num_queries"},
        },
    )
    print("DETR exported successfully!")


if __name__ == "__main__":
    output_dir = os.path.join("src-tauri", "resources")
    os.makedirs(output_dir, exist_ok=True)

    try:
        export_vit(output_dir)
        export_detr(output_dir)
        print("\nAll models exported successfully to src-tauri/resources/")
    except Exception as e:
        print(f"\nError during export: {e}")
        print("Please ensure you have PyTorch and Hugging Face transformers installed.")
        print("You can run: pip install torch transformers pillow")
