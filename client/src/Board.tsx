import React, { useState, useEffect } from 'react';
import './Board.css';

type Player = 'X' | 'O' | null;
type BoardState = Player[][];

interface BoardProps {
  size: number;
  socket: WebSocket;
  username: string;
  playerSymbol: 'X' | 'O';
  room: string;
}

const Board: React.FC<BoardProps> = ({ size, socket, username, playerSymbol, room }) => {
  const [board, setBoard] = useState<BoardState>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [playerSym, setPlayerSym] = useState<'X' | 'O' | null>(playerSymbol);

  useEffect(() => {
    socket.onmessage = (message) => {
      console.log('Client has received message:', message.data);
      const data = JSON.parse(message.data);
      if (data.type === "update") {
        setBoard(data.board);
        setCurrentPlayer(data.currentPlayer);
        setWinner(data.winner);
        if (data.player) {
          setPlayerSym(data.player);
        }
      }
    };
  }, [socket]);

  const handlePlayAgain = () => {
    const data = {
      type: 'play-again',
      username: username,
      room: room,
    }
    socket.send(JSON.stringify(data));
  }

  const checkWinner = (board: BoardState): Player | 'Draw' | null => {
    for (let i = 0; i < size; i++) {
      if (board[i].every(cell => cell === 'X')) return 'X';
      if (board[i].every(cell => cell === 'O')) return 'O';
    }

    for (let i = 0; i < size; i++) {
      if (board.every(row => row[i] === 'X')) return 'X';
      if (board.every(row => row[i] === 'O')) return 'O';
    }

    if (board.every((row, i) => row[i] === 'X')) return 'X';
    if (board.every((row, i) => row[i] === 'O')) return 'O';

    if (board.every((row, i) => row[size - 1 - i] === 'X')) return 'X';
    if (board.every((row, i) => row[size - 1 - i] === 'O')) return 'O';

    if (board.every(row => row.every(cell => cell !== null))) return 'Draw';

    return null;
  };

  const handleClick = (row: number, col: number) => {
    if (board[row][col] !== null || winner !== null || currentPlayer !== playerSym) {
      console.log('Invalid move');
      return;
    }

    const newBoard = board.map((boardRow, rIndex) =>
      boardRow.map((cell, cIndex) =>
        rIndex === row && cIndex === col ? currentPlayer : cell
      )
    );

    const gameResult = checkWinner(newBoard);

    const data = {
      type: 'move',
      room: room,
      board: newBoard,
      currentPlayer: currentPlayer === 'X' ? 'O' : 'X',
      winner: gameResult,
    };

    socket.send(JSON.stringify(data));
    setBoard(newBoard);

    if (gameResult) {
      setWinner(gameResult);
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const renderCell = (row: number, col: number) => {
    return (
      <div className="cell" onClick={() => handleClick(row, col)} key={`${row}-${col}`}>
        {board[row] && board[row][col]}
      </div>
    );
  };

  const renderRow = (row: number) => {
    return (
      <div className="row" key={row}>
        {Array(size).fill(null).map((_, col) => renderCell(row, col))}
      </div>
    );
  };

  return (
    <div className="board">
      <p>You play as {playerSym}</p>
      {board.map((_, row) => renderRow(row))}
      {winner ? (
        <>
          <p>{winner === 'Draw' ? 'It\'s a draw!' : `Player ${winner} wins!`}</p>
          <button onClick={handlePlayAgain} className="restart-button">Play again ?</button>
        </>
      ) : (
        <p>{currentPlayer}'s move</p>
      )}
      <p>
        <strong>Room code:</strong> {room}
      </p>
    </div>
  );
};


export default Board;
