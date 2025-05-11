const websocketString =
  window.location.hostname === "127.0.0.1"
    ? "ws://localhost:8000/ws"
    : `wss://${window.location.hostname}/ws`;

const ws = new WebSocket(websocketString);

const sendButton = document.getElementById("sendButton");
const userInput = document.getElementById("userInput");
const chatHistory = document.getElementById("chatHistory");
const newChatBtn = document.getElementById("new");
const chatList = document.getElementById("chatList");

let lastUserMessageDiv = null;
let isNewUserInput = true;
let accumulatedAIResponse = "";

// Load or initialize state
let appState = JSON.parse(localStorage.getItem("chatApp") || "{}");
if (!appState.chats) {
  const newChatId = `chat_${Date.now()}`;
  appState = {
    chats: { [newChatId]: [] },
    activeChatId: newChatId,
  };
  localStorage.setItem("chatApp", JSON.stringify(appState));
}

const getActiveChat = () => appState.chats[appState.activeChatId];

const saveChatState = () => {
  localStorage.setItem("chatApp", JSON.stringify(appState));
};

const renderChat = () => {
  chatHistory.innerHTML = "";
  getActiveChat().forEach(({ role, content }) => {
    const div = document.createElement("div");
    div.className = `chat-message ${role}`;
    div.innerHTML = content;
    chatHistory.appendChild(div);
  });
};

const renderChatList = () => {
  chatList.innerHTML = "";
  const chatIds = Object.keys(appState.chats);
  chatIds.forEach((chatId, index) => {
    const chatButton = document.createElement("button");
    chatButton.className =
      "btn btn-outline-secondary btn-sm d-block mb-1 w-100";
    chatButton.textContent = `Chat ${index + 1}`;
    if (chatId === appState.activeChatId) {
      chatButton.classList.add("active");
    }
    chatButton.onclick = () => {
      appState.activeChatId = chatId;
      saveChatState();
      renderChat();
      renderChatList();
    };
    chatList.appendChild(chatButton);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  renderChat();
  renderChatList();
});

// Επεξεργασία του κειμένου για HTML
const processText = (text) => {
  // Αντικατάσταση **bold** με <strong>
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Προσθήκη <br> πριν από το - ή αριθμημένες λίστες (π.χ., 1., 2., 3.)
  text = text.replace(/\n(\-)/g, '<br>-');       // Bullet lists
  text = text.replace(/\n(\d+\.)/g, '<br>$1');   // Αριθμημένες λίστες

  // Επεξεργασία για ειδικούς χαρακτήρες όπως , ή !
  text = text.replace(/([,!])\s*/g, '$1 ');  // Διασφαλίζει ότι οι χαρακτήρες σαν , και ! δεν αλλάζουν γραμμή

  // Αντικατάσταση \n με <br> για γενική αλλαγή γραμμής
  text = text.replace(/\n/g, '<br>');

  return text;
};

// Συνάρτηση για την εμφάνιση του κειμένου στο frontend
ws.onmessage = ({ data: message }) => {
  if (message === "__END__") {
    saveMessage("ai-response", accumulatedAIResponse);
    accumulatedAIResponse = "";
    return;
  }

  if (lastUserMessageDiv && !isNewUserInput) {
    lastUserMessageDiv.innerHTML += processText(message); // Επεξεργασία κειμένου πριν την εμφάνιση
    accumulatedAIResponse += message;
  } else {
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message ai-response";

    // Επεξεργασία κειμένου και εφαρμογή μορφοποίησης
    messageDiv.innerHTML = processText(message);

    chatHistory.appendChild(messageDiv);
    lastUserMessageDiv = messageDiv;
    isNewUserInput = false;
    accumulatedAIResponse = message;
  }
};

sendButton.onclick = () => {
  const message = userInput.value.trim();
  if (!message) return;

  const userInputDiv = document.createElement("div");
  userInputDiv.className = "chat-message user-input";
  userInputDiv.textContent = message;
  chatHistory.appendChild(userInputDiv);

  chatHistory.scrollTop = chatHistory.scrollHeight;
  ws.send(message);
  userInput.value = "";
  isNewUserInput = true;
  lastUserMessageDiv = null;

  saveMessage("user-input", message);
};

const saveMessage = (role, content) => {
  const chat = getActiveChat();
  chat.push({ role, content });
  appState.chats[appState.activeChatId] = chat;
  saveChatState();
};

newChatBtn.onclick = () => {
  const newChatId = `chat_${Date.now()}`;
  appState.chats[newChatId] = [];
  appState.activeChatId = newChatId;
  saveChatState();
  renderChat();
  renderChatList();
};
