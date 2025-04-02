from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def process_file(file_path: str):
    # Read the file content
    myfile = client.files.upload(file=media / file_path)

    prompt = "Convert this to well formatted markdown notes. Make sure to include all the important details and equations."
    
    # Process the text with Gemini
    response = client.models.generate_content(
        model="gemini-1.5-pro",
        contents=[prompt, myfile],
    )

    return response.text

if __name__ == "__main__":
    print(process_file("test.txt"))
