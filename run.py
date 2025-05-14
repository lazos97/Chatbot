#Το Chatbot είναι live στο Render σε αυτό το URL: https://chatbot-jihd.onrender.com/

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
