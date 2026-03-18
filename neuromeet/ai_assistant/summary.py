import ollama

def generate_summary(text):

    response=ollama.chat(

    model="deepseek-coder",

    messages=[{

    "role":"user",

    "content":
    "Summarize meeting: "+text

    }]

    )

    return response["message"]["content"]