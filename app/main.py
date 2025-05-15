from fastapi import FastAPI, Form, Request, WebSocket
from typing import Annotated
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import re
from openai import AsyncOpenAI

# Φόρτωση μεταβλητών περιβάλλοντος από αρχείο .env
load_dotenv()

# Δημιουργία OpenAI client με το API key από το .env
openai = AsyncOpenAI(api_key=os.getenv('OPENAI_API_SECRET_KEY'))

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

chat_responses = []

# Προκαθορισμένος ρόλος του bot: Ειδικός σε διατροφή και άσκηση
chat_log = [{
    'role': 'system',
    'content': 'You are a nutrition and fitness expert. You can help users with diet and workout plans, assist them in losing weight or gaining muscle mass, and also answer general questions.'
}]

# GET αίτημα για την αρχική σελίδα συνομιλίας
@app.get("/", response_class=HTMLResponse)
async def chat_page(request: Request):
    return templates.TemplateResponse("home.html", {"request": request, "chat_responses": chat_responses})

# WebSocket endpoint για πραγματικού χρόνου συνομιλία
@app.websocket("/ws")
async def chat(websocket: WebSocket):
    await websocket.accept()

    while True:
        try:
            # Λήψη κειμένου από τον χρήστη
            user_input = await websocket.receive_text()
            chat_log.append({'role': 'user', 'content': user_input})
            chat_responses.append(user_input)

            try:
                # Δημιουργία απάντησης με GPT-4 και streaming
                response = await openai.chat.completions.create(
                    model='gpt-4',
                    messages=chat_log,
                    temperature=0.6,
                    stream=True
                )

                ai_response = ""
                async for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        ai_response += content
                        await websocket.send_text(process_text(content))

                await websocket.send_text("__END__")

                # Προσθήκη απάντησης του bot στο ιστορικό
                chat_log.append({'role': 'assistant', 'content': ai_response})
                chat_responses.append(ai_response)

            except Exception as e:
                await websocket.send_text(f"Σφάλμα κατά την παραγωγή απάντησης: {str(e)}")
                await websocket.send_text("__END__")

        except Exception as e:
            await websocket.send_text(f"Σφάλμα WebSocket: {str(e)}")
            break

# POST αίτημα για συνομιλία μέσω φόρμας
@app.post("/", response_class=HTMLResponse)
async def chat_post(request: Request, user_input: Annotated[str, Form()]):
    try:
        chat_log.append({'role': 'user', 'content': user_input})
        chat_responses.append(user_input)

        try:
            response = await openai.chat.completions.create(
                model='gpt-4',
                messages=chat_log,
                temperature=0.6
            )

            bot_response = process_text(response.choices[0].message.content)
            chat_log.append({'role': 'assistant', 'content': bot_response})
            chat_responses.append(bot_response)

        except Exception as e:
            bot_response = f"Σφάλμα κατά την παραγωγή απάντησης: {str(e)}"
            chat_log.append({'role': 'assistant', 'content': bot_response})
            chat_responses.append(bot_response)

        return templates.TemplateResponse("home.html", {"request": request, "chat_responses": chat_responses})

    except Exception as e:
        return templates.TemplateResponse("home.html", {
            "request": request,
            "chat_responses": chat_responses + [f"Απρόσμενο σφάλμα: {str(e)}"]
        })

# GET αίτημα για τη σελίδα δημιουργίας εικόνας
@app.get("/image", response_class=HTMLResponse)
async def image_page(request: Request):
    return templates.TemplateResponse("image.html", {"request": request})

# POST αίτημα για δημιουργία εικόνας με βάση την περιγραφή
@app.post("/image", response_class=HTMLResponse)
async def create_image(request: Request, user_input: Annotated[str, Form()]):
    try:
        response = await openai.images.generate(
            prompt=user_input,
            n=1,
            size="256x256"
        )

        image_url = response.data[0].url
        return templates.TemplateResponse("image.html", {"request": request, "image_url": image_url})

    except Exception as e:
        return templates.TemplateResponse("image.html", {
            "request": request,
            "image_url": None,
            "error": f"Σφάλμα κατά τη δημιουργία εικόνας: {str(e)}"
        })

# Βοηθητική συνάρτηση για μορφοποίηση απάντησης με HTML
def process_text(text):
    text = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\n(\-)", r"<br>\1", text)
    text = re.sub(r"\n(\d+\.)", r"<br>\1", text)
    text = text.replace("\n", "<br>")

    return text
