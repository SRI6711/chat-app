App.jsx
import React, { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);

  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const [password, setPassword] = useState("");

  const [targetUser, setTargetUser] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [onlineUser, setOnlineUser] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("username") ? true : false
  );
  const [isRegister, setIsRegister] = useState(false);

  const socketRef = useRef(null);

  const getRoomName = () => {
    if (!username || !targetUser) return "";
    return [username, targetUser].sort().join("_");
  };

  // ✅ AUTH (FIXED URLS)
  const handleAuth = async () => {
    const url = isRegister
      ? "http://127.0.0.1:8000/chat/register/"
      : "http://127.0.0.1:8000/chat/login/";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("username", username);
        setIsLoggedIn(true);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error("Auth error:", err);
      alert("Backend not running or wrong URL");
    }
  };

  const handleLogout = async () => {
    await fetch("http://127.0.0.1:8000/chat/logout/");
    localStorage.removeItem("username");
    setIsLoggedIn(false);
    setChat([]);
  };

  // ✅ SOCKET
  useEffect(() => {
    if (!isLoggedIn) return;

    const room = getRoomName();
    if (!room) return;

    if (socketRef.current) socketRef.current.close();

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${room}/`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected ✅");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // HISTORY
      if (data.history) {
        setChat(data.history);
      }

      // NEW MESSAGE
      if (data.message) {
        setChat((prev) => [...prev, data]);

        // SEND SEEN
        if (data.username !== username) {
          socketRef.current.send(
            JSON.stringify({
              seen: true,
            })
          );
        }
      }

      // TYPING
      if (data.typing) {
        setTypingUser(data.username);
        setTimeout(() => setTypingUser(""), 1500);
      }

      // ONLINE
      if (data.online) {
        setOnlineUser(data.username);
        setTimeout(() => setOnlineUser(""), 2000);
      }

      // SEEN UPDATE
      if (data.seen) {
        setChat((prev) =>
          prev.map((msg) => ({ ...msg, seen: true }))
        );
      }
    };

    ws.onclose = () => {
      console.log("Disconnected ❌");
    };

    return () => ws.close();
  }, [isLoggedIn, targetUser]);

  // ✅ SEND MESSAGE
  const sendMessage = () => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      message.trim()
    ) {
      socketRef.current.send(
        JSON.stringify({
          message,
          username,
        })
      );
      setMessage("");
    }
  };

  const handleTyping = () => {
    socketRef.current?.send(
      JSON.stringify({
        typing: true,
        username,
      })
    );
  };

  // 🔐 LOGIN UI
  if (!isLoggedIn) {
    return (
      <div className="login">
        <h2>{isRegister ? "Register" : "Login"}</h2>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />

        <button onClick={handleAuth}>
          {isRegister ? "Register" : "Login"}
        </button>

        <p onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Login instead" : "Register instead"}
        </p>
      </div>
    );
  }

  // 💬 CHAT UI
  return (
    <div className="chat-container">
      <h2>💬 Chat</h2>

      <button onClick={handleLogout}>Logout</button>

      <input
        value={targetUser}
        onChange={(e) => setTargetUser(e.target.value)}
        placeholder="Chat with..."
      />

      {/* STATUS */}
      {onlineUser && <p>🟢 {onlineUser} online</p>}
      {typingUser && <p>✍ {typingUser} typing...</p>}

      {/* CHAT */}
      <div className="chat-box">
        {chat.map((msg, i) => (
          <div key={i}>
            <b>{msg.username}</b>: {msg.message}

            <span style={{ marginLeft: "10px", fontSize: "12px" }}>
              {msg.time}
            </span>

            {msg.username === username && (
              <span style={{ marginLeft: "10px" }}>
                {msg.seen ? "✔✔" : "✔"}
              </span>
            )}
          </div>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          handleTyping();
        }}
        placeholder="Type message..."
      />

      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;