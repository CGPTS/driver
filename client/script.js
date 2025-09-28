class TruthOrDareGame {
    constructor() {
        this.gameMode = null; // 'local' או 'online'
        this.socket = null;
        this.roomCode = null;
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.currentRound = 1;
        this.hasVoted = false;
        
        // משתנים למשחק מקומי
        this.touches = [];
        this.selectedTouch = null;
        this.timer = null;
        this.stabilityTimer = null;
        this.lastTouchCount = 0;
        this.stabilityDelay = 1000;
        this.waitingForTouches = true;
        
        // מאגר שאלות אמת משפחתיות
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
        
        // מאגר שאלות חובה משפחתיות
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
        
        // צבעי רקע לסבבים
        this.roundColors = [
            '#2c3e50', '#e74c3c', '#3498db', '#2ecc71', 
            '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'
        ];
        
        this.initializeGame();
    }
    
    initializeGame() {
        this.initializeSocket();
        this.setupTouchEvents();
        this.updateConnectionStatus('מתחבר...');
    }
    
    // Socket.IO initialization
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('מחובר לשרת');
            this.updateConnectionStatus('מחובר', 'connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('מנותק מהשרת');
            this.updateConnectionStatus('מנותק', 'disconnected');
        });
        
        this.socket.on('roomCreated', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = true;
            this.showWaitingRoom();
        });
        
        this.socket.on('joinedRoom', (data) => {
            this.roomCode = data.roomCode;
            this.players = data.players;
            this.showWaitingRoom();
            this.updatePlayersList();
        });
        
        this.socket.on('playerJoined', (data) => {
            this.players = data.players;
            this.updatePlayersList();
        });
        
        this.socket.on('playerLeft', (data) => {
            this.players = data.players;
            this.updatePlayersList();
        });
        
        this.socket.on('gameStarted', () => {
            this.showTouchScreen();
        });
        
        this.socket.on('votingStarted', (data) => {
            this.showVotingScreen(data.voters);
        });
        
        this.socket.on('votersUpdate', (data) => {
            this.updateVotersList(data.voters);
        });
        
        this.socket.on('playerSelected', (data) => {
            this.showPlayerSelected(data.selectedPlayer, data.isYou);
        });
        
        this.socket.on('questionShown', (data) => {
            this.showOnlineQuestion(data.type, data.question);
        });
        
        this.socket.on('nextRound', () => {
            this.currentRound++;
            this.hasVoted = false;
            this.showTouchScreen();
        });
        
        this.socket.on('error', (error) => {
            alert('שגיאה: ' + error.message);
        });
    }
    
    updateConnectionStatus(status, className = '') {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = '🔌 ' + status;
        statusElement.className = 'connection-status ' + className;
    }
    
    // Mode Selection
    selectMode(mode) {
        this.gameMode = mode;
        
        if (mode === 'local') {
            this.showScreen('startScreen');
        } else if (mode === 'online') {
            this.showScreen('roomScreen');
        }
    }
    
    backToModeSelection() {
        this.gameMode = null;
        this.resetGame();
        this.showScreen('modeSelectionScreen');
    }
    
    // Room Management
    showCreateRoom() {
        document.getElementById('createRoomSection').classList.remove('hidden');
        document.getElementById('joinRoomSection').classList.add('hidden');
        document.getElementById('playerName').focus();
    }
    
    showJoinRoom() {
        document.getElementById('joinRoomSection').classList.remove('hidden');
        document.getElementById('createRoomSection').classList.add('hidden');
        document.getElementById('joinPlayerName').focus();
    }
    
    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        
        if (!playerName) {
            alert('אנא הכנס את השם שלך');
            return;
        }
        
        this.playerName = playerName;
        this.socket.emit('createRoom', { playerName });
    }
    
    joinRoom() {
        const playerName = document.getElementById('joinPlayerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
        
        if (!playerName) {
            alert('אנא הכנס את השם שלך');
            return;
        }
        
        if (!roomCode || roomCode.length !== 4) {
            alert('אנא הכנס קוד חדר בן 4 תווים');
            return;
        }
        
        this.playerName = playerName;
        this.socket.emit('joinRoom', { playerName, roomCode });
    }
    
    showWaitingRoom() {
        document.getElementById('displayRoomCode').textContent = this.roomCode;
        this.updatePlayersList();
        this.showScreen('waitingRoomScreen');
    }
    
    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        const startGameBtn = document.getElementById('startGameBtn');
        
        playerCount.textContent = this.players.length;
        
        playersList.innerHTML = '';
        
        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            const playerInfo = document.createElement('div');
            playerInfo.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-status">${player.isHost ? '👑 מארח' : '👤 שחקן'}</div>
            `;
            
            playerItem.appendChild(playerInfo);
            playersList.appendChild(playerItem);
        });
        
        // Enable start button only for host with at least 2 players
        if (this.isHost && this.players.length >= 2) {
            startGameBtn.disabled = false;
        } else {
            startGameBtn.disabled = true;
        }
    }
    
    copyRoomCode() {
        const roomCode = document.getElementById('displayRoomCode').textContent;
        navigator.clipboard.writeText(roomCode).then(() => {
            const copyBtn = document.querySelector('.copy-btn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }).catch(() => {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('קוד החדר הועתק: ' + roomCode);
        });
    }
    
    leaveRoom() {
        if (confirm('האם אתה בטוח שאתה רוצה לעזוב את החדר?')) {
            this.socket.emit('leaveRoom');
            this.backToModeSelection();
        }
    }
    
    startOnlineGame() {
        if (!this.isHost) return;
        this.socket.emit('startGame');
    }
    
    // Game Logic
    startLocalGame() {
        this.gameMode = 'local';
        this.showTouchScreen();
    }
    
    showTouchScreen() {
        // Reset game state
        this.touches = [];
        this.lastTouchCount = 0;
        this.hasVoted = false;
        
        const touchesContainer = document.getElementById('touchesContainer');
        touchesContainer.innerHTML = '';
        
        const instruction = document.getElementById('instruction');
        const timer = document.getElementById('timer');
        const voteSection = document.getElementById('voteSection');
        
        timer.style.display = 'block';
        timer.textContent = '3';
        instruction.style.display = 'block';
        
        if (this.gameMode === 'local') {
            instruction.textContent = 'מניחים את האצבע על המסך...';
            voteSection.style.display = 'none';
            this.waitingForTouches = true;
        } else {
            instruction.textContent = 'המתינו להתחלת ההצבעה...';
            voteSection.style.display = 'block';
            document.getElementById('voteBtn').disabled = true;
        }
        
        // Set round color
        const colorIndex = (this.currentRound - 1) % this.roundColors.length;
        document.getElementById('touchArea').style.setProperty(
            '--round-color', 
            this.roundColors[colorIndex]
        );
        
        this.showScreen('touchScreen');
    }
    
    showVotingScreen(voters) {
        const instruction = document.getElementById('instruction');
        const voteBtn = document.getElementById('voteBtn');
        
        instruction.textContent = 'לחצו על כפתור ההצבעה!';
        voteBtn.disabled = false;
        
        this.updateVotersList(voters);
    }
    
    castVote() {
        if (this.hasVoted || this.gameMode !== 'online') return;
        
        this.hasVoted = true;
        document.getElementById('voteBtn').disabled = true;
        document.getElementById('voteBtn').innerHTML = '<span>✅ הצבעת!</span>';
        
        this.socket.emit('vote');
    }
    
    updateVotersList(voters) {
        const votersList = document.getElementById('votersList');
        votersList.innerHTML = '';
        
        voters.forEach(voter => {
            const voterItem = document.createElement('div');
            voterItem.className = 'voter-item';
            voterItem.textContent = voter.name;
            votersList.appendChild(voterItem);
        });
    }
    
    // Touch Events for Local Game
    setupTouchEvents() {
        const touchArea = document.getElementById('touchArea');
        
        touchArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameMode === 'local' && this.waitingForTouches) {
                this.handleTouchStart(e);
            }
        }, { passive: false });
        
        touchArea.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.gameMode === 'local' && this.waitingForTouches) {
                this.handleTouchEnd(e);
            }
        }, { passive: false });
        
        touchArea.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Mouse support for desktop testing
        touchArea.addEventListener('mousedown', (e) => {
            if (this.gameMode === 'local' && this.waitingForTouches) {
                this.handleMouseDown(e);
            }
        });
        
        touchArea.addEventListener('mouseup', (e) => {
            if (this.gameMode === 'local' && this.waitingForTouches) {
                this.handleMouseUp(e);
            }
        });
    }
    
    handleTouchStart(e) {
        const touchesContainer = document.getElementById('touchesContainer');
        
        Array.from(e.touches).forEach((touch) => {
            if (!this.touches.find(t => t.id === touch.identifier)) {
                const touchElement = document.createElement('div');
                touchElement.className = 'touch-point';
                touchElement.style.left = touch.clientX + 'px';
                touchElement.style.top = touch.clientY + 'px';
                touchElement.dataset.touchId = touch.identifier;
                
                touchesContainer.appendChild(touchElement);
                
                this.touches.push({
                    id: touch.identifier,
                    x: touch.clientX,
                    y: touch.clientY,
                    element: touchElement
                });
            }
        });
        
        this.checkForStability();
    }
    
    handleTouchEnd(e) {
        const currentTouchIds = Array.from(e.touches).map(touch => touch.identifier);
        
        this.touches = this.touches.filter(touch => {
            if (currentTouchIds.includes(touch.id)) {
                return true;
            } else {
                touch.element.remove();
                return false;
            }
        });
        
        this.checkForStability();
    }
    
    handleMouseDown(e) {
        const touchesContainer = document.getElementById('touchesContainer');
        
        const touchElement = document.createElement('div');
        touchElement.className = 'touch-point';
        touchElement.style.left = e.clientX + 'px';
        touchElement.style.top = e.clientY + 'px';
        
        touchesContainer.appendChild(touchElement);
        
        const mouseTouch = {
            id: 'mouse-' + Date.now(),
            x: e.clientX,
            y: e.clientY,
            element: touchElement
        };
        
        this.touches.push(mouseTouch);
        this.checkForStability();
    }
    
    handleMouseUp(e) {
        const lastMouseTouch = this.touches.find(touch => touch.id.includes('mouse'));
        if (lastMouseTouch) {
            lastMouseTouch.element.remove();
            this.touches = this.touches.filter(touch => touch.id !== lastMouseTouch.id);
        }
        
        this.checkForStability();
    }
    
    checkForStability() {
        const currentTouchCount = this.touches.length;
        const instruction = document.getElementById('instruction');
        
        if (currentTouchCount === 0) {
            instruction.textContent = 'מניחים את האצבע על המסך...';
        } else if (currentTouchCount === 1) {
            instruction.textContent = 'עוד שחקנים יכולים לצרף אצבע...';
        } else {
            instruction.textContent = `${currentTouchCount} שחקנים מחכים... עוד שחקנים יכולים להצטרף!`;
        }
        
        if (this.stabilityTimer) {
            clearTimeout(this.stabilityTimer);
            this.stabilityTimer = null;
        }
        
        if (currentTouchCount > 0) {
            this.stabilityTimer = setTimeout(() => {
                if (this.touches.length > 0) {
                    instruction.textContent = 'כולם מחזיקים את האצבע! הטיימר מתחיל...';
                    setTimeout(() => {
                        this.startCountdown();
                    }, 500);
                }
            }, this.stabilityDelay);
        }
        
        this.lastTouchCount = currentTouchCount;
    }
    
    startCountdown() {
        if (!this.waitingForTouches) return;
        
        let timeLeft = 3;
        const timerElement = document.getElementById('timer');
        const instruction = document.getElementById('instruction');
        
        instruction.textContent = 'אל תזיזו את האצבעות!';
        this.waitingForTouches = false;
        
        this.timer = setInterval(() => {
            timerElement.textContent = timeLeft;
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(this.timer);
                this.timer = null;
                this.selectRandomTouch();
            }
        }, 1000);
    }
    
    selectRandomTouch() {
        if (this.touches.length === 0) {
            this.resetGame();
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * this.touches.length);
        this.selectedTouch = this.touches[randomIndex];
        
        console.log(`נבחר מגע רנדומלי: ${randomIndex + 1} מתוך ${this.touches.length}`);
        
        document.getElementById('timer').style.display = 'none';
        document.getElementById('instruction').style.display = 'none';
        
        this.touches.forEach((touch, index) => {
            if (touch.id === this.selectedTouch.id) {
                touch.element.classList.add('selected');
            } else {
                touch.element.style.opacity = '0.3';
            }
        });
        
        setTimeout(() => {
            document.getElementById('touchArea').style.background = 'white';
            this.touches.forEach(touch => {
                if (touch.id !== this.selectedTouch.id) {
                    touch.element.style.background = 'radial-gradient(circle, #ddd 0%, #bbb 70%)';
                    touch.element.style.border = '3px solid #999';
                }
            });
            
            setTimeout(() => {
                this.showChoiceScreen();
            }, 2000);
        }, 1000);
    }
    
    showPlayerSelected(selectedPlayerName, isYou) {
        const selectedPlayerElement = document.getElementById('selectedPlayerName');
        
        if (isYou) {
            selectedPlayerElement.textContent = '🎉 נבחרת!';
        } else {
            selectedPlayerElement.textContent = `🎉 ${selectedPlayerName} נבחר!`;
        }
        
        this.showChoiceScreen(isYou);
    }
    
    showChoiceScreen(canChoose = true) {
        const choiceButtons = document.querySelector('.choice-buttons');
        
        if (this.gameMode === 'online' && !canChoose) {
            choiceButtons.style.display = 'none';
            const selectedPlayer = document.querySelector('.selected-player p');
            selectedPlayer.textContent = 'ממתין לבחירת השחקן...';
        } else {
            choiceButtons.style.display = 'flex';
        }
        
        this.showScreen('choiceScreen');
        
        const roundClass = `round-${((this.currentRound - 1) % 8) + 1}`;
        document.body.className = roundClass;
    }
    
    showQuestion(type) {
        if (this.gameMode === 'online') {
            this.socket.emit('chooseType', { type });
            return;
        }
        
        // Local game
        this.showLocalQuestion(type);
    }
    
    showLocalQuestion(type) {
        const questionTypeElement = document.getElementById('questionType');
        const questionTextElement = document.getElementById('questionText');
        
        let question;
        if (type === 'truth') {
            const randomIndex = Math.floor(Math.random() * this.truthQuestions.length);
            question = this.truthQuestions[randomIndex];
            questionTypeElement.textContent = '🤔 אמת';
            questionTypeElement.className = 'question-type truth';
        } else {
            const randomIndex = Math.floor(Math.random() * this.dareQuestions.length);
            question = this.dareQuestions[randomIndex];
            questionTypeElement.textContent = '💪 חובה';
            questionTypeElement.className = 'question-type dare';
        }
        
        questionTextElement.textContent = question;
        this.showScreen('questionScreen');
    }
    
    showOnlineQuestion(type, question) {
        const questionTypeElement = document.getElementById('questionType');
        const questionTextElement = document.getElementById('questionText');
        
        if (type === 'truth') {
            questionTypeElement.textContent = '🤔 אמת';
            questionTypeElement.className = 'question-type truth';
        } else {
            questionTypeElement.textContent = '💪 חובה';
            questionTypeElement.className = 'question-type dare';
        }
        
        questionTextElement.textContent = question;
        this.showScreen('questionScreen');
    }
    
    nextRound() {
        if (this.gameMode === 'online' && this.isHost) {
            this.socket.emit('nextRound');
        } else if (this.gameMode === 'local') {
            this.currentRound++;
            this.resetLocalGame();
        }
    }
    
    resetLocalGame() {
        this.touches = [];
        this.selectedTouch = null;
        this.waitingForTouches = true;
        this.lastTouchCount = 0;
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        if (this.stabilityTimer) {
            clearTimeout(this.stabilityTimer);
            this.stabilityTimer = null;
        }
        
        document.getElementById('touchesContainer').innerHTML = '';
        document.getElementById('timer').style.display = 'block';
        document.getElementById('timer').textContent = '3';
        document.getElementById('instruction').style.display = 'block';
        document.getElementById('instruction').textContent = 'מניחים את האצבע על המסך...';
        
        this.showScreen('startScreen');
        
        document.body.className = '';
        document.getElementById('touchArea').style.background = '';
    }
    
    resetGame() {
        // Reset all game state
        this.gameMode = null;
        this.roomCode = null;
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.currentRound = 1;
        this.hasVoted = false;
        
        // Reset local game state
        this.touches = [];
        this.selectedTouch = null;
        this.waitingForTouches = true;
        this.lastTouchCount = 0;
        
        // Clear timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        if (this.stabilityTimer) {
            clearTimeout(this.stabilityTimer);
            this.stabilityTimer = null;
        }
        
        // Reset UI
        document.getElementById('touchesContainer').innerHTML = '';
        document.getElementById('timer').textContent = '3';
        document.getElementById('createRoomSection').classList.add('hidden');
        document.getElementById('joinRoomSection').classList.add('hidden');
        document.getElementById('voteSection').style.display = 'none';
        
        // Clear inputs
        document.getElementById('playerName').value = '';
        document.getElementById('joinPlayerName').value = '';
        document.getElementById('roomCode').value = '';
        
        // Reset styling
        document.body.className = '';
        document.getElementById('touchArea').style.background = '';
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
}

// Global functions for HTML onclick events
function selectMode(mode) {
    window.game.selectMode(mode);
}

function backToModeSelection() {
    window.game.backToModeSelection();
}

function showCreateRoom() {
    window.game.showCreateRoom();
}

function showJoinRoom() {
    window.game.showJoinRoom();
}

function createRoom() {
    window.game.createRoom();
}

function joinRoom() {
    window.game.joinRoom();
}

function copyRoomCode() {
    window.game.copyRoomCode();
}

function leaveRoom() {
    window.game.leaveRoom();
}

function startOnlineGame() {
    window.game.startOnlineGame();
}

function startLocalGame() {
    window.game.startLocalGame();
}

function castVote() {
    window.game.castVote();
}

function showQuestion(type) {
    window.game.showQuestion(type);
}

function nextRound() {
    window.game.nextRound();
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TruthOrDareGame();
});

// Prevent mobile zooming and scrolling
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

document.addEventListener('gesturechange', function (e) {
    e.preventDefault();
});

document.addEventListener('gestureend', function (e) {
    e.preventDefault();
});

document.body.addEventListener('touchstart', function(e){
    if(e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });

document.body.addEventListener('touchend', function(e){
    if(e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });

document.body.addEventListener('touchmove', function(e){
    if(e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });