const websocketString =
  window.location.hostname === '127.0.0.1'
    ? 'ws://localhost:8000/ws'
    : `wss://${window.location.hostname}/ws`

const ws = new WebSocket(websocketString)

const sendButton = document.getElementById('sendButton')
const userInput = document.getElementById('userInput')
const chatHistory = document.getElementById('chatHistory')
const newChatBtn = document.getElementById('new')
const chatList = document.getElementById('chatList')
const toggleSidebarBtn = document.getElementById('toggleSidebar')
const chatSidebar = document.getElementById('sidebar')

let lastUserMessageDiv = null
let isNewUserInput = true
let accumulatedAIResponse = ''

// Κατάσταση φόρτωσης ή προετοιμασίας
let appState = JSON.parse(localStorage.getItem('chatApp') || '{}')
if (!appState.chats) {
  const newChatId = `chat_${Date.now()}`
  appState = {
    chats: { [newChatId]: [] },
    activeChatId: newChatId
  }
  localStorage.setItem('chatApp', JSON.stringify(appState))
}

const getActiveChat = () => appState.chats[appState.activeChatId]

const saveChatState = () => {
  localStorage.setItem('chatApp', JSON.stringify(appState))
}

const renderChat = () => {
  chatHistory.innerHTML = ''
  getActiveChat().forEach(({ role, content }) => {
    const div = document.createElement('div')
    div.className = `chat-message ${role}`
    div.innerHTML = content
    chatHistory.appendChild(div)
  })
  // Κατεβάζουμε το scroll μετά την εμφάνιση όλων των μηνυμάτων
  chatHistory.scrollTop = chatHistory.scrollHeight
}

const renderChatList = () => {
  chatList.innerHTML = ''
  const chatIds = Object.keys(appState.chats)
  chatIds.forEach((chatId, index) => {
    const chatButton = document.createElement('button')
    chatButton.className =
      'btn btn-outline-secondary btn-sm d-block mb-1 w-100'
    chatButton.textContent = `Chat ${index + 1}`
    if (chatId === appState.activeChatId) {
      chatButton.classList.add('active')
    }
    chatButton.onclick = () => {
      appState.activeChatId = chatId
      saveChatState()
      renderChat()
      renderChatList()
      handleChatSelect()
    }
    chatList.appendChild(chatButton)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  renderChat()
  renderChatList()
})

const processText = text => {
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\n(\-)/g, '<br>-')
  text = text.replace(/\n(\d+\.)/g, '<br>$1')
  text = text.replace(/([,!])\s*/g, '$1 ')
  text = text.replace(/\n/g, '<br>')
  return text
}

// WebSocket χειρισμός απόκρισης
ws.onmessage = ({ data: message }) => {
  if (message === '__END__') {
    saveMessage('ai-response', accumulatedAIResponse)
    accumulatedAIResponse = ''
    return
  }

  if (lastUserMessageDiv && !isNewUserInput) {
    lastUserMessageDiv.innerHTML += processText(message)
    accumulatedAIResponse += message
  } else {
    const messageDiv = document.createElement('div')
    messageDiv.className = 'chat-message ai-response'
    messageDiv.innerHTML = processText(message)
    chatHistory.appendChild(messageDiv)
    lastUserMessageDiv = messageDiv
    isNewUserInput = false
    accumulatedAIResponse = message
  }
  // Αυτόματη κύλιση προς τα κάτω μετά την προσθήκη του νέου μηνύματος
  chatHistory.scrollTop = chatHistory.scrollHeight
}

// Αποστολή μηνύματος
sendButton.onclick = () => {
  const message = userInput.value.trim()
  if (!message) return

  const userInputDiv = document.createElement('div')
  userInputDiv.className = 'chat-message user-input'
  userInputDiv.textContent = message
  chatHistory.appendChild(userInputDiv)

  // Κατεβάζουμε το scroll μετά την προσθήκη του μηνύματος
  chatHistory.scrollTop = chatHistory.scrollHeight

  ws.send(message)
  userInput.value = ''
  isNewUserInput = true
  lastUserMessageDiv = null

  saveMessage('user-input', message)
}

const saveMessage = (role, content) => {
  const chat = getActiveChat()
  chat.push({ role, content })
  appState.chats[appState.activeChatId] = chat
  saveChatState()
}

newChatBtn.onclick = () => {
  const newChatId = `chat_${Date.now()}`
  appState.chats[newChatId] = []
  appState.activeChatId = newChatId
  saveChatState()
  renderChat()
  renderChatList()
}

// Εναλλαγή πλευρικής γραμμής για κινητά
toggleSidebarBtn.addEventListener('click', () => {
  chatSidebar.classList.toggle('open')
})

// Αυτόματο κλείσιμο πλαϊνής γραμμής στο κινητό όταν είναι επιλεγμένη η συνομιλία
const handleChatSelect = () => {
  if (window.innerWidth <= 768) {
    chatSidebar.classList.remove('open')
  }
}
