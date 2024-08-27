import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { MongoClient } from 'mongodb';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'client/build')));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// MongoDB setup
const uri = 'mongodb+srv://jvladko:jvladko@cluster0.ygv1t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);
let db: any = null;
client.connect().then(() => {
    db = client.db('tic-tac-toe');
    console.log("Connected successfully to MongoDB Atlas");
});

type Player = 'X' | 'O' | null;
interface Room {
    roomId: string;
    players: { X: string | null; O: string | null };  // Stores usernames
    board: Player[][];
    currentPlayer: Player;
    winner: Player;
    lastMoveTimestamp: number;
    playAgain: { X: boolean; O: boolean };
}

// In-memory storage for active WebSocket connections per room
const activeSockets: { [roomId: string]: { X: WebSocket | null; O: WebSocket | null } } = {};

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        const { type, room, username, board, currentPlayer, winner } = JSON.parse(message.toString());
        console.log('Received message:', message.toString());

        if (type === 'join') {
            let roomData: Room = await db.collection('rooms').findOne({ roomId: room });

            // Create a new room if it doesn't exist
            if (!roomData) {
                roomData = {
                    roomId: room,
                    players: { X: null, O: null },
                    board: Array(3).fill(null).map(() => Array(3).fill(null)),
                    currentPlayer: 'X',
                    winner: null,
                    lastMoveTimestamp: Date.now(),
                    playAgain: { X: false, O: false },
                };
            }

            // Initialize in-memory WebSocket storage for the room if not already present
            if (!activeSockets[room]) {
                activeSockets[room] = { X: null, O: null };
            }

            // Check if the player was previously in the room
            if (roomData.players.X === username) {
                activeSockets[room].X = ws;
                ws.send(JSON.stringify({ type: 'joined', player: 'X' }));
            } else if (roomData.players.O === username) {
                activeSockets[room].O = ws;
                ws.send(JSON.stringify({ type: 'joined', player: 'O' }));
            } else if (!roomData.players.X) {
                roomData.players.X = username;
                activeSockets[room].X = ws;
                ws.send(JSON.stringify({ type: 'joined', player: 'X' }));
            } else if (!roomData.players.O) {
                roomData.players.O = username;
                activeSockets[room].O = ws;
                ws.send(JSON.stringify({ type: 'joined', player: 'O' }));
            } else {
                ws.send(JSON.stringify({ type: 'full' }));
                return;
            }

            // Update the room in the database
            await db.collection('rooms').updateOne(
                { roomId: room },
                { $set: roomData },
                { upsert: true }
            );

            const gameState = {
                type: 'update',
                board: roomData.board,
                currentPlayer: roomData.currentPlayer,
                winner: roomData.winner,
            };

            ws.send(JSON.stringify(gameState));

            console.log(`Player ${username} joined room ${room} as ${roomData.players.X === username ? 'X' : 'O'}`);
        }

        if (type === 'move' && room) {
            const roomData: Room = await db.collection('rooms').findOne({ roomId: room });

            if (roomData) {
                roomData.board = board;
                roomData.currentPlayer = currentPlayer;
                roomData.winner = winner;
                roomData.lastMoveTimestamp = Date.now();

                await db.collection('rooms').updateOne(
                    { roomId: room },
                    { $set: roomData }
                );

                const gameState = {
                    type: 'update',
                    board: roomData.board,
                    currentPlayer: roomData.currentPlayer,
                    winner: roomData.winner,
                };

                console.log("Server is broadcasting the message:", JSON.stringify(gameState));

                // Broadcast the updated state to all clients in the room using in-memory sockets
                activeSockets[room]?.X?.send(JSON.stringify(gameState));
                activeSockets[room]?.O?.send(JSON.stringify(gameState));
            }
        }

        if (type === 'play-again' && room) {
            const roomData: Room = await db.collection('rooms').findOne({ roomId: room });
            console.log(`Player ${username} wants to play again in room ${room}`);

            if (roomData) {
                if (roomData.players.X === username) {
                    roomData.playAgain.X = true;
                } else if (roomData.players.O === username) {
                    roomData.playAgain.O = true;
                }

                await db.collection('rooms').updateOne(
                    { roomId: room },
                    { $set: roomData }
                );

                if (roomData.playAgain.X && roomData.playAgain.O) {
                    console.log(roomData);
                    roomData.board = Array(3).fill(null).map(() => Array(3).fill(null));

                    // Swap the players
                    roomData.players = { X: roomData.players.O, O: roomData.players.X };
                    const tmp = activeSockets[room].X;
                    activeSockets[room].X = activeSockets[room].O;
                    activeSockets[room].O = tmp;

                    roomData.currentPlayer = 'X';
                    roomData.winner = null;
                    roomData.lastMoveTimestamp = Date.now();
                    roomData.playAgain = { X: false, O: false };
                    console.log(roomData);

                    await db.collection('rooms').updateOne(
                        { roomId: room },
                        { $set: roomData }
                    );

                    const gameState = {
                        type: 'update',
                        board: roomData.board,
                        currentPlayer: roomData.currentPlayer,
                        winner: roomData.winner,
                    };
                    activeSockets[room]?.X?.send(JSON.stringify({ ...gameState, player: 'X' }));
                    activeSockets[room]?.O?.send(JSON.stringify({ ...gameState, player: 'O' }));
                }
            }
        }
    });

    ws.on('close', async () => {
        console.log('Client disconnected');
        // Clean up the disconnected WebSocket from activeSockets
        for (const roomId in activeSockets) {
            if (activeSockets[roomId].X === ws) {
                activeSockets[roomId].X = null;
            }
            if (activeSockets[roomId].O === ws) {
                activeSockets[roomId].O = null;
            }
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000; // 24 hours

// Periodically check for inactive rooms and delete them
setInterval(async () => {
    const now = Date.now();

    // Retrieve all rooms from the database
    const rooms = await db.collection('rooms').find({}).toArray();

    for (const roomData of rooms) {
        if (now - roomData.lastMoveTimestamp > INACTIVITY_LIMIT) {
            // Room is inactive, delete it
            console.log(`Deleting inactive room: ${roomData.roomId}`);

            // Delete from MongoDB
            await db.collection('rooms').deleteOne({ roomId: roomData.roomId });

            // Delete from in-memory storage (if exists)
            if (activeSockets[roomData.roomId]) {
                delete activeSockets[roomData.roomId];
            }
        }
    }
}, INACTIVITY_LIMIT);
