import sys
# pyrefly: ignore [missing-import]
from rembg import remove
from PIL import Image

def process_logo(input_path, output_path):
    print("Processing image...")
    input_image = Image.open(input_path)
    
    output_image = remove(input_image)
    
    output_image.save(output_path)
    print(f"Logo processed and saved to {output_path}")

if __name__ == "__main__":
    in_path = r"C:\Users\Win 11\.gemini\antigravity-ide\brain\209ce027-8109-4cd8-b6b2-68d4c2629c80\media__1783414370030.png"
    out_path = r"c:\Users\Win 11\Downloads\VARGANI\static\images\logo.png"
    process_logo(in_path, out_path)
