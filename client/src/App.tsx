import React, { useEffect, useState } from 'react';
import Board from './Board';
import './App.css';

function App() {
  const [boardSize, setBoardSize] = useState(3); // Default to 3x3
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O' | null>(null);
  const [loading, setLoading] = useState(false); // Loading state

  const handleJoinRoom = async () => {
    setLoading(true); // Start loading when attempting to join the room

    if (socket) {
      socket.close();
    }

    const ws = new WebSocket('ws://localhost:3000');
    setSocket(ws);

    // Wrap WebSocket event handlers in a promise to wait for the join response
    const joinPromise = new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', room, username }));
        console.log('Client has sent message:', { type: 'join', room, username });
      };

      ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'joined') {
          setPlayerSymbol(data.player);
          setLoading(false); // Stop loading when the player has joined successfully
          resolve(); // Resolve the promise to indicate successful join
        } else if (data.type === 'full') {
          alert('Room is full');
          setLoading(false); // Stop loading if the room is full
          ws.close();
          reject('Room is full'); // Reject the promise if room is full
        } else if (data.type === 'error') {
          alert(data.message);
          setLoading(false); // Stop loading if there's an error
          ws.close();
          reject(data.message); // Reject the promise if there's an error
        }
      };

      ws.onclose = () => {
        setPlayerSymbol(null);
        setLoading(false); // Stop loading when the connection is closed
        reject('Connection closed'); // Reject the promise if connection is closed
      };
    });

    try {
      await joinPromise; // Wait for the server to confirm the player has joined
      console.log('Player has joined, ready to render the board.');
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  return (
    <div className="App">
      <div className="input-container">
        <label>
          Enter your username:
          <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>

        <label>
          Enter room code:
          <input type="text" value={room} onChange={(event) => setRoom(event.target.value)} />
        </label>
      </div>

      <button onClick={handleJoinRoom} disabled={!room || !username}>
        Join Room
      </button>

      {/* Show loading indicator while waiting for server response */}
      {loading && <p>Loading, please wait...</p>}

      {/* Render the board only if the player has successfully joined */}
      {playerSymbol && socket && !loading && <Board size={boardSize} socket={socket} username={username} playerSymbol={playerSymbol} room={room} />}
    </div>
  );
}

export default App;
