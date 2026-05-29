import os
import json
from transformers import ViTForImageClassification, DetrForObjectDetection


def export_labels():
    output_dir = os.path.join("src-tauri", "resources")
    os.makedirs(output_dir, exist_ok=True)

    print("Loading ViT config...")
    vit = ViTForImageClassification.from_pretrained("google/vit-base-patch16-224")
    # Convert keys to integer keys or strings as needed, but JSON requires string keys
    vit_labels = {int(k): v for k, v in vit.config.id2label.items()}
    # Sort by key to ensure order matches indices
    vit_list = [vit_labels[i] for i in range(len(vit_labels))]

    with open(os.path.join(output_dir, "vit_labels.json"), "w") as f:
        json.dump(vit_list, f, indent=2)
    print("Saved vit_labels.json")

    print("Loading DETR config...")
    detr = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50")
    detr_labels = {int(k): v for k, v in detr.config.id2label.items()}
    # DETR config might skip some class IDs, let's create a mapping dict instead of list
    with open(os.path.join(output_dir, "detr_labels.json"), "w") as f:
        json.dump({str(k): v for k, v in detr_labels.items()}, f, indent=2)
    print("Saved detr_labels.json")


if __name__ == "__main__":
    try:
        export_labels()
    except Exception as e:
        print(f"Error: {e}")
