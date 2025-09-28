const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// Handle root route explicitly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});


// Fix CSP and serve static files from current directory
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self' ws: wss:; " +
        "img-src 'self' data: https:; " +
        "font-src 'self';"
    );
    next();
});

// Serve static files from current directory (not client subdirectory)
app.use(express.static(__dirname));

// Handle root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game state management
const rooms = new Map();
const players = new Map();

class GameRoom {
    constructor(roomCode, hostPlayer) {
        this.roomCode = roomCode;
        this.players = [hostPlayer];
        this.gameState = 'waiting';
        this.voters = [];
        this.selectedPlayer = null;
        this.currentRound = 1;
        
        this.truthQuestions = [
            "מה הדבר הכי מביך שעשית השבוע?",
            "איזה חבר משפחה הכי מצחיק אותך ולמה?",
            "מה החלום הכי מוזר שחלמת לאחרונה?",
            "איזה מאכל אתה הכי שונא אבל מעמיד פנים שאתה אוהב?",
            "מה הדבר הכי מפחיד אותך בעולם?",
            "איזה דמות מסרט היית רוצה להיות לשעה אחת?",
            "מה הדבר הכי טיפשי שקנית בחודש האחרון?",
            "איזה חיה היית רוצה להיות ולמה?",
            "מה הסוד הכי מוזר שלך?",
            "איזה כישרון היית הכי רוצה שיהיה לך?",
            "מה המתנה הכי גרועה שקיבלת אי פעם?",
            "איזה דמות ציבורית היית הכי רוצה לפגוש?",
            "מה הדבר הכי מוזר שאכלת?",
            "איזה חלום ילדות עדיין יש לך?",
            "מה התחביב הכי מוזר שלך?"
        ];
        
        this.dareQuestions = [
            "תחקה את דמות הקריקטורה הכי מצחיקה שאתה מכיר במשך דקה שלמה",
            "תרקוד ריקוד פרייסטייל במשך 30 שניות",
            "תדבר במבטא זר במשך 3 הדברים הבאים שתאמר",
            "תעשה 10 כפיפות בטן עכשיו",
            "תשיר שיר ילדים במלוא העוצמה",
            "תחקה בעל חיים וכולם צריכים לנחש איזה",
            "תספר בדיחה (חייב להצחיק לפחות אדם אחד)",
            "תעשה תנוחת יוגה מוזרה במשך 30 שניות",
            "תדבר כמו רובוט במשך דקה שלמה",
            "תעשה 'סלפי' מצחיק עם כולם במשחק",
            "תחקה את המורה הכי מוזר שהכרת",
            "תשיר השיר האהוב עליך בקול גבוה",
            "תעשה ריקוד מתוך טיקטוק",
            "תדבר כמו דמות מסרט במשך דקה",
            "תעשה פנים מצחיקות במשך 30 שניות"
        ];
    }
    
    addPlayer(player) {
        this.players.push(player);
    }
    
    removePlayer(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
        this.voters = this.voters.filter(v => v.socketId !== socketId);
        
        if (this.players.length > 0 && !this.players.find(p => p.isHost)) {
            this.players[0].isHost = true;
        }
        
        return this.players.length === 0;
    }
    
    startVoting() {
        this.gameState = 'voting';
        this.voters = [];
    }
    
    addVoter(player) {
        if (!this.voters.find(v => v.socketId === player.socketId)) {
            this.voters.push(player);
        }
        
        if (this.voters.length === this.players.length) {
            setTimeout(() => {
                this.selectRandomPlayer();
            }, 1000);
        }
    }
    
    selectRandomPlayer() {
        if (this.voters.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * this.voters.length);
        this.selectedPlayer = this.voters[randomIndex];
        this.gameState = 'selecting';
    }
    
    getRandomQuestion(type) {
        const questions = type === 'truth' ? this.truthQuestions : this.dareQuestions;
        const randomIndex = Math.floor(Math.random() * questions.length);
        return questions[randomIndex];
    }
    
    nextRound() {
        this.currentRound++;
        this.gameState = 'playing';
        this.voters = [];
        this.selectedPlayer = null;
        
        setTimeout(() => {
            this.startVoting();
        }, 2000);
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('createRoom', (data) => {
        const roomCode = generateRoomCode();
        const player = {
            socketId: socket.id,
            name: data.playerName,
            isHost: true
        };
        
        const room = new GameRoom(roomCode, player);
        rooms.set(roomCode, room);
        players.set(socket.id, { roomCode, player });
        
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
        
        console.log(`Room ${roomCode} created by ${player.name}`);
    });
    
    socket.on('joinRoom', (data) => {
        const { playerName, roomCode } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', { message: 'חדר לא נמצא' });
            return;
        }
        
        if (room.players.find(p => p.name === playerName)) {
            socket.emit('error', { message: 'שם שחקן כבר קיים' });
            return;
        }
        
        const player = {
            socketId: socket.id,
            name: playerName,
            isHost: false
        };
        
        room.addPlayer(player);
        players.set(socket.id, { roomCode, player });
        
        socket.join(roomCode);
        socket.emit('joinedRoom', { roomCode, players: room.players });
        
        socket.to(roomCode).emit('playerJoined', { players: room.players });
        
        console.log(`${playerName} joined room ${roomCode}`);
    });
    
    socket.on('leaveRoom', () => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;
        
        const { roomCode } = playerInfo;
        const room = rooms.get(roomCode);
        
        if (room) {
            const isEmpty = room.removePlayer(socket.id);
            
            if (isEmpty) {
                rooms.delete(roomCode);
            } else {
                socket.to(roomCode).emit('playerLeft', { players: room.players });
            }
        }
        
        players.delete(socket.id);
        socket.leave(roomCode);
        
        console.log(`Player left room ${roomCode}`);
    });
    
    socket.on('startGame', () => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;
        
        const { roomCode, player } = playerInfo;
        const room = rooms.get(roomCode);
        
        if (!room || !player.isHost) return;
        
        io.to(roomCode).emit('gameStarted');
        
        setTimeout(() => {
            room.startVoting();
            io.to(roomCode).emit('votingStarted', { voters: room.voters });
        }, 3000);
        
        console.log(`Game started in room ${roomCode}`);
    });
    
    socket.on('vote', () => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;
        
        const { roomCode, player } = playerInfo;
        const room = rooms.get(roomCode);
        
        if (!room || room.gameState !== 'voting') return;
        
        room.addVoter(player);
        
        io.to(roomCode).emit('votersUpdate', { voters: room.voters });
        
        if (room.voters.length === room.players.length) {
            setTimeout(() => {
                room.selectRandomPlayer();
                
                io.to(roomCode).emit('playerSelected', {
                    selectedPlayer: room.selectedPlayer.name,
                    isYou: false
                });
                
                io.to(room.selectedPlayer.socketId).emit('playerSelected', {
                    selectedPlayer: room.selectedPlayer.name,
                    isYou: true
                });
                
                console.log(`${room.selectedPlayer.name} was selected in room ${roomCode}`);
            }, 2000);
        }
    });
    
    socket.on('chooseType', (data) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;
        
        const { roomCode, player } = playerInfo;
        const room = rooms.get(roomCode);
        
        if (!room || room.gameState !== 'selecting' || room.selectedPlayer.socketId !== socket.id) {
            return;
        }
        
        const question = room.getRandomQuestion(data.type);
        
        io.to(roomCode).emit('questionShown', {
            type: data.type,
            question: question
        });
        
        console.log(`Question shown in room ${roomCode}: ${data.type}`);
    });
    
    socket.on('nextRound', () => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;
        
        const { roomCode, player } = playerInfo;
        const room = rooms.get(roomCode);
        
        if (!room || !player.isHost) return;
        
        room.nextRound();
        
        io.to(roomCode).emit('nextRound');
        
        setTimeout(() => {
            io.to(roomCode).emit('votingStarted', { voters: room.voters });
        }, 3000);
        
        console.log(`Next round started in room ${roomCode}`);
    });
    
    socket.on('disconnect', () => {
        const playerInfo = players.get(socket.id);
        if (playerInfo) {
            const { roomCode } = playerInfo;
            const room = rooms.get(roomCode);
            
            if (room) {
                const isEmpty = room.removePlayer(socket.id);
                
                if (isEmpty) {
                    rooms.delete(roomCode);
                } else {
                    socket.to(roomCode).emit('playerLeft', { players: room.players });
                }
            }
            
            players.delete(socket.id);
        }
        
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});