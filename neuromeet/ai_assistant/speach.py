import whisper

model = whisper.load_model("base")

def speech_to_text(file):

    result=model.transcribe(file)

    return result["text"]