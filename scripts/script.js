"use strict";

// Creating the canvas element in JS so that my autocomplete works in vs code
const canvas = document.createElement("canvas");
canvas.id = "canvas";
document.getElementById("game-screen").appendChild(canvas);
canvas.width = 1200;
canvas.height = 600;

// declaration of constants
const UP = "up";
const RIGHT = "right";
const DOWN = "down";
const LEFT = "left";
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 75;

const KEYFRAME_DURATION = 1000 / 60;
const DEATH_CHECK_DURATION = 100;

const game = {
  // Variables
  // General Variables
  isRunning: false,
  currentScreen: undefined,
  screens: {
    start: document.getElementById("start-screen"),
    game: document.getElementById("game-screen"),
    gameOver: document.getElementById("game-over-screen"),
  },
  elems: {
    startScreen: {
      pressEnter: document.getElementById("enter"),
      menu: document.getElementById("menu"),
      playerNameInput: document.getElementById("player-name-input"),
      addPlayerButton: document.getElementById("add-player-button"),
      playerBikeSelect: document.getElementById("player-bike-select"),
      startGameButton: document.getElementById("start-game-button"),
      bikePhoto: document.getElementById("bike-photo"),
      helpButton: document.getElementById("help-button"),
      helpModal: document.getElementById("modal"),
      helpOkButton: document.getElementById("ok-modal-button"),
      playersJoined: document.getElementById("players-joined"),
      normalSpeed: document.getElementById("normal"),
      toggleThemeMusicButton: document.getElementById("theme-music-toggle"),
    },
    gameScreen: {
      scoreBoard: document.getElementById("scoreboard"),
      gameOverPopup: document.getElementById("game-over-popup"),
      victoryText: document.getElementById("victory-text"),
      playAgainButton: document.getElementById("play-again-button"),
      quitButton: document.getElementById("quit-button"),
    },
    gameOverScreen: {
      credits: document.getElementById("credits"),
    },
  },
  audio: {
    titleTrack: document.getElementById("title-track"),
    gameTrack: document.getElementById("game-track"),
    gameTrackNormal: document.getElementById("game-track"),
    gameTrackLudicrous: document.getElementById("game-track-ludicrous"),
    gameOverVoice: document.getElementById("game-over-voice"),
  },
  players: [],
  ctx: canvas.getContext("2d"),
  // Canvas Specific Variables
  animationIntervalId: undefined,
  lastTimestamp: undefined,
  deathTimestamp: undefined,
  colors: {
    neonPurple: "#ee47f6",
  },
  GRID: {
    VERTICAL_COLUMNS: 16,
    HORIZONTAL_COLUMNS: 8,
  },
  // Functions
  init: function () {
    game.initializeEventListeners();
    game.switchScreen(game.screens.start, true);
  },
  initializeEventListeners: function () {
    game.elems.startScreen.toggleThemeMusicButton.addEventListener(
      "click",
      game.toggleTitleMusic
    );
    game.elems.startScreen.playerNameInput.addEventListener(
      "input",
      game.updateStartScreenButtons
    );
    game.elems.startScreen.addPlayerButton.addEventListener(
      "click",
      game.addPlayer
    );
    game.elems.startScreen.startGameButton.addEventListener("click", () => {
      game.switchScreen(game.screens.game);
      game.toggleGameRunning();
    });
    game.elems.startScreen.helpButton.addEventListener("click", () => {
      game.toggleHelpModal();
    });
    game.elems.startScreen.helpOkButton.addEventListener("click", () => {
      game.toggleHelpModal();
    });
    game.elems.startScreen.playerBikeSelect.addEventListener(
      "change",
      game.updateBikePhoto
    );
    game.elems.gameScreen.playAgainButton.addEventListener("click", () => {
      game.playAgain();
    });
    game.elems.gameScreen.quitButton.addEventListener("click", () => {
      game.resetGame();
      game.switchScreen(game.screens.gameOver);
    });
    game.elems.gameOverScreen.credits.addEventListener("animationend", () => {
      game.switchScreen(game.screens.start);
    });
    document.addEventListener("keydown", game.keyDownHandler);
  },
  switchScreen: function (selectedScreen, firstLaunch = false) {
    game.currentScreen = selectedScreen;
    // first we hide all the screens
    for (let screen in game.screens) {
      game.screens[screen].classList.add("hidden");
    }
    // let's also stop any music that may be running
    for (let song in game.audio) {
      game.audio[song].pause();
      game.audio[song].src = game.audio[song].src; // to reset other properties like volume, position in track.
    }
    // then we remove it from the screen passed in to the function
    selectedScreen.classList.remove("hidden");
    // Then depending on the new selectedScreen we make sure any internal components are set to the proper initial state.
    switch (selectedScreen) {
      case game.screens.start:
        game.elems.startScreen.pressEnter.hidden = false;
        game.elems.startScreen.menu.hidden = true;
        game.elems.startScreen.playerBikeSelect.innerHTML = `
            <option value="red">RED</option>
            <option value="blue">BLUE</option>
            <option value="green">GREEN</option>
        `;
        game.updateBikePhoto();
        game.updateStartScreenButtons();
        // the select innerhtml and updatebikephoto method are to handle
        // when the game resets after already playing a session, as the addPlayer() method removes option tags from the DOM.
        if (!firstLaunch) {
          // to prevent DOM Exception error for autoplay
          game.audio.titleTrack.play();
        }
        // The following 2 lines is to fix a bug where after the credits end and it switches back to the start screen
        // The video file is stuck for ~5 seconds, resetting the src attribute resolves this.
        document.getElementById("start-video").src =
          document.getElementById("start-video").src;
        document.getElementById("start-video").play();
        game.elems.startScreen.startGameButton.disabled = true;
        break;
      case game.screens.game:
        game.elems.gameScreen.gameOverPopup.classList.remove("slide-down");
        break;
      case game.screens.gameOver:
        game.elems.gameOverScreen.credits.classList.remove("credits-animation");
        game.elems.gameOverScreen.credits.classList.add("credits-animation");
        game.audio.titleTrack.play();
        break;
      default:
        break;
    }
  },
  updateStartScreenButtons: function () {
    // This ensures that the "Add Player" and "Start Game" buttons
    // are only clickable under appropriate circumstances.

    const playerHasName =
      game.elems.startScreen.playerNameInput.value.length > 0;
    const twoPlayersAdded = game.players.length === 2;
    if (!twoPlayersAdded && playerHasName) {
      game.elems.startScreen.addPlayerButton.disabled = false;
      game.elems.startScreen.startGameButton.disabled = true;
    } else if (twoPlayersAdded) {
      game.elems.startScreen.addPlayerButton.disabled = true;
      game.elems.startScreen.startGameButton.disabled = false;
    }
  },
  addPlayer: function (event, name = "", bikeColor = "") {
    if (!game.elems.startScreen.playerNameInput.value) {
      // defensive return
      return;
    }
    if (!name && !bikeColor) {
      // for debug purposes, allowing me to quickly add players via console commands.
      // If I have not entered values, then it pulls from the HTML
      name = game.elems.startScreen.playerNameInput.value;
      bikeColor = game.elems.startScreen.playerBikeSelect.value;
    }
    const playerNum = game.players.length + 1;
    // Creating Player Score Card
    const playerScoreCardElem = document.createElement("div");
    playerScoreCardElem.classList.add("player-score-card");
    playerScoreCardElem.innerHTML = `<h2>P${playerNum}: ${name}</h2>
     <img src="./media/${bikeColor}Bike.png"/>
     <span class="trophies"></span>`;
    game.elems.gameScreen.scoreBoard.appendChild(playerScoreCardElem);

    // We create a notification card that will spawn on start screen
    const playerPopUp = document.createElement("div");
    playerPopUp.classList.add("player-popup", "pop-in");
    playerPopUp.innerHTML = `<h2>P${playerNum} Joined!</h2>
     <h2>${name}</h2>
     <img src="./media/${bikeColor}Bike.png"/>`;
    playerPopUp.addEventListener("animationend", () => {
      playerPopUp.remove();
    });
    setTimeout(() => {
      playerPopUp.remove();
      // to cleanup leftover elements in case animation end not triggered.
      // animationcancel event did not work for some reason
    }, 5000);
    // we append to the players joined notification area
    game.elems.startScreen.playersJoined.append(playerPopUp);

    // Need to establish player starting conditions
    // I track this data in order to reset each player back to their original spawn point
    // if the players decide to play again
    const startingConditions = {
      x: playerNum === 1 ? 0 : canvas.width,
      y: canvas.height / 2 - PLAYER_HEIGHT,
      direction: playerNum === 1 ? RIGHT : LEFT,
      // Depending on whether the player is 1 or 2, they are spawned
      // either on the left side or right side with the appropriate direction
    };

    const player = new Player(
      name,
      bikeColor,
      startingConditions,
      playerScoreCardElem
    );
    game.players.push(player);
    const selectedBikeElem =
      game.elems.startScreen.playerBikeSelect.querySelector(
        `option[value="${game.elems.startScreen.playerBikeSelect.value}"]`
      );
    // remove it so the next player cannot reuse the same value
    selectedBikeElem.remove();
    // Updates to one of the remaining bike colors
    game.updateBikePhoto();
    // reset input for the next player
    game.elems.startScreen.playerNameInput.value = "";
    game.updateStartScreenButtons(); // to reset add Player button, as setting the value to an empty string does not seem to generate an input event.
  },
  toggleHelpModal: function () {
    // slightly confusing.. but since the BG is the parent of the actual modal
    // I named it helpModal in elems for simplicities sake
    // here it break it out into sub elements
    const helpModalBg = game.elems.startScreen.helpModal;
    const helpModal = helpModalBg.children[0];
    if (helpModalBg.classList.contains("hidden")) {
      helpModalBg.classList.remove("hidden");
      setTimeout(function () {
        helpModal.classList.add("animate-modal");
      }, 500);
    } else {
      // modal is already open
      helpModal.classList.remove("animate-modal");
      setTimeout(function () {
        helpModalBg.classList.add("hidden");
      }, 600);
    }
    // The timeouts create a nice effect of dimming the screen before/after the modal itself animates
  },
  updateBikePhoto: function () {
    const newBikeColor = game.elems.startScreen.playerBikeSelect.value;
    game.elems.startScreen.bikePhoto.src = `./media/${newBikeColor}Bike.png`;
  },
  keyDownHandler: function (event) {
    // Uses currentScreen to determine how to handle incoming events
    switch (game.currentScreen) {
      case game.screens.start:
        game.startScreenKeyEvents(event);
        break;
      case game.screens.game:
        game.updateAllPlayersDirection(event);
        break;
      case game.screens.gameOver:
        if (event.key === "Enter") {
          // "Skip Credits Functionality"
          game.switchScreen(game.screens.start);
        }
        break;
      default:
        break;
    }
  },
  startScreenKeyEvents: function (event) {
    // NOTE: I created this for the most part to experiment with activeElement property
    // as I don't really indicate in the GUI that this navigation is possible.

    // Uses the active element property as well as the values of elements on the start screen
    // to automatically advance the user through different stages of navigating the menu
    // if we are on splash screen, it opens the menu
    // it then moves the user through the process of adding player names and bike color choices
    // once 2 players are added, the enter key automatically begins the game
    switch (event.key) {
      case "Enter":
        game.updateStartScreenButtons();
        if (game.elems.startScreen.pressEnter.hidden === false) {
          // if on splash screen
          game.elems.startScreen.pressEnter.hidden = true;
          game.elems.startScreen.menu.hidden = false;
          game.elems.startScreen.playerNameInput.focus();
        } else if (
          // player name selected
          document.activeElement === game.elems.startScreen.playerNameInput
        ) {
          game.elems.startScreen.playerBikeSelect.focus();
        } else if (
          // bike color selected
          document.activeElement === game.elems.startScreen.playerBikeSelect
        ) {
          if (game.players.length < 2) {
            game.addPlayer();
            game.elems.startScreen.playerNameInput.focus();
          }
        } else {
          // don't add a player if 2 already added
          game.elems.startScreen.playerNameInput.focus();
        }
        if (game.players.length === 2) {
          // two players added
          game.switchScreen(game.screens.game);
          game.toggleGameRunning();
        }
        break;

      default:
        break;
    }
  },
  toggleTitleMusic: function () {
    game.elems.startScreen.toggleThemeMusicButton.parentElement.childNodes[1].remove(); // remove "Click notification"
    if (
      game.elems.startScreen.toggleThemeMusicButton.classList.contains("mute")
    ) {
      game.elems.startScreen.toggleThemeMusicButton.classList.remove("mute");
      game.audio.titleTrack.src = game.audio.titleTrack.src;
      game.audio.titleTrack.play();
    } else {
      game.elems.startScreen.toggleThemeMusicButton.classList.add("mute");
      game.audio.titleTrack.pause();
    }
  },
  // Canvas Specific Functions
  toggleGameRunning: function () {
    game.isRunning = !game.isRunning;
    if (game.isRunning) {
      game.startGame();
    } else {
      // to cancel the animation frame and reset things
      cancelAnimationFrame(game.animationIntervalId);
      game.animationIntervalId = undefined;
      game.lastTimestamp = undefined;
      game.deathTimestamp = undefined;
    }
  },
  startGame: function () {
    // we need to find out the checked value and then adjust player speed and soundtrack
    if (game.elems.startScreen.normalSpeed.checked) {
      game.audio.gameTrack = game.audio.gameTrackNormal;
      game.players.forEach((player) => {
        player.movementSpeed = 3;
      });
    } else {
      game.audio.gameTrack = game.audio.gameTrackLudicrous;
      game.players.forEach((player) => {
        player.movementSpeed = 8;
      });
    }
    game.isRunning = true;
    game.animationIntervalId = requestAnimationFrame(game.drawLoop);
    // Volume is lowered on player death, resetting to normal volume
    game.audio.gameTrack.volume = 1;
    game.audio.gameTrack.play();
  },
  endGame: function () {
    game.isRunning = false;
    const player1Victory = game.players[0].isAlive && !game.players[1].isAlive;
    const player2Victory = !game.players[0].isAlive && game.players[1].isAlive;
    let victoryText = "";
    let trophy = document.createElement("span");
    trophy.innerText = "🏆";
    if (player1Victory) {
      victoryText = `${game.players[0].name} Wins!`;
      game.players[0].scoreBoardElem
        .querySelector(".trophies")
        .appendChild(trophy);
    } else if (player2Victory) {
      victoryText = `${game.players[1].name} Wins!`;
      game.players[1].scoreBoardElem
        .querySelector(".trophies")
        .appendChild(trophy);
    } else {
      victoryText = "Tie Game!";
    }
    cancelAnimationFrame(game.animationIntervalId);
    game.animationIntervalId = undefined;
    game.lastTimestamp = undefined;
    game.deathTimestamp = undefined;
    setTimeout(() => {
      game.audio.gameOverVoice.play();
      game.elems.gameScreen.victoryText.textContent = victoryText;
      game.elems.gameScreen.gameOverPopup.classList.add("slide-down");
      game.elems.gameScreen.playAgainButton.focus();
      // I wait 4/10ths of a second as the player object also triggers a game over noise
      // this prevents overlap
    }, 400);
  },
  playAgain: function () {
    // so this needs to reset all conditions back to how they were when the game first began
    // remove the class on the popup
    game.elems.gameScreen.gameOverPopup.classList.remove("slide-down");
    // reset players to original positions
    game.players.forEach((player) => {
      player.isAlive = true;
      player.x = player.startingConditions.x;
      player.y = player.startingConditions.y;
      player.direction = player.startingConditions.direction;
      player.linePoints = [];
      player.horizontalLines = [];
      player.verticalLines = [];
      player.saveLinePoint(); // setup new initial line point
    });
    game.startGame();
  },
  resetGame: function () {
    game.players.forEach((player) => {
      player.scoreBoardElem.remove();
    });
    game.isRunning = false;
    game.players = [];
    cancelAnimationFrame(game.animationIntervalId);
    game.animationIntervalId = undefined;
    game.lastTimestamp = undefined;
    game.deathTimestamp = undefined;
    game.elems.startScreen.normalSpeed.checked = true;
    game.elems.startScreen.playerNameInput.value = "";
  },
  drawBackground: function () {
    //   Draw the outer border
    game.ctx.beginPath();
    game.ctx.lineWidth = 2;
    game.ctx.strokeStyle = game.colors.neonPurple;
    game.ctx.strokeRect(0, 0, canvas.width, canvas.height);
    game.ctx.closePath();
    // Draw the inner grid

    // I must face my mortal enemy: MATH.
    // The grid is 1200 pixels wide
    // and 600 pixels tall
    // this means that I must divide the width by the number of lines I want?
    // so I would require 16 Vertical and 7 Horizontal grid lines roughly
    // divide 1200 pixels into 16 equal pieces is... one grid line every 75 pixels
    // divide 600 pixels into 8 equal pieces is... one grid line every 75 pixels
    // I first use moveTo, to get to the appropriate x and y coordinates
    // then I use lineTo, to tell it where it should terminate the line
    // I repeat that process over and over

    game.ctx.beginPath();
    let x = 75;
    for (
      let columnNum = 0;
      columnNum < game.GRID.VERTICAL_COLUMNS;
      columnNum++
    ) {
      game.ctx.moveTo(x, 0);
      game.ctx.lineTo(x, canvas.height);
      x += 75;
    }
    let y = 75;
    for (let rowNum = 0; rowNum < game.GRID.HORIZONTAL_COLUMNS; rowNum++) {
      game.ctx.moveTo(0, y);
      game.ctx.lineTo(canvas.width, y);
      y += 75;
    }
    game.ctx.stroke();
    game.ctx.closePath();
  },
  drawPlayers: function () {
    game.players.forEach((player) => {
      if (player.isAlive) {
        // Saving canvas context before I rotate everything
        // depending on player direction
        this.ctx.save();

        switch (player.direction) {
          case UP:
            // Image faces up naturally, no need to translate here.
            game.ctx.drawImage(
              player.bikeImage,
              player.x - player.width / 2,
              player.y - player.height
            );
            break;
          case DOWN:
            this.ctx.translate(
              player.x + player.width / 2,
              player.y + player.height / 2
            );
            this.ctx.rotate((180 * Math.PI) / 180);
            this.ctx.translate(
              -(player.x + player.width / 2),
              -(player.y + player.height / 2)
            );
            this.ctx.drawImage(
              player.bikeImage,
              player.x + player.width / 2,
              player.y
            );
            break;
          case LEFT:
            this.ctx.translate(
              player.x + player.width / 2,
              player.y + player.height / 2
            );
            this.ctx.rotate((270 * Math.PI) / 180);
            this.ctx.translate(
              -(player.x + player.width / 2),
              -(player.y + player.height / 2)
            );
            this.ctx.drawImage(
              player.bikeImage,
              player.x + player.width - 2,
              player.y - player.height / 1.3
            );
            break;
          case RIGHT:
            this.ctx.translate(
              player.x + player.width / 2,
              player.y + player.height / 2
            );
            this.ctx.rotate((90 * Math.PI) / 180);
            this.ctx.translate(
              -(player.x + player.width / 2),
              -(player.y + player.height / 2)
            );
            this.ctx.drawImage(
              player.bikeImage,
              player.x - player.height / 2,
              player.y - player.width / 2
            );
            break;
          default:
            break;
        }
        this.ctx.restore();
      } else {
        // player is dead
        this.ctx.save();
        switch (player.direction) {
          case UP:
            game.ctx.drawImage(
              player.deadImage,
              player.x - player.width / 2,
              player.y - player.height
            );
            break;
          case DOWN:
            this.ctx.translate(
              player.x + player.width / 2,
              player.y + player.height / 2
            );
            this.ctx.rotate((180 * Math.PI) / 180);
            this.ctx.translate(
              -(player.x + player.width / 2),
              -(player.y + player.height / 2)
            );
            this.ctx.drawImage(
              player.deadImage,
              player.x + player.width / 2,
              player.y
            );
            break;
          case LEFT:
            this.ctx.translate(
              player.x + player.width / 2,
              player.y + player.height / 2
            );
            this.ctx.rotate((270 * Math.PI) / 180);
            this.ctx.translate(
              -(player.x + player.width / 2),
              -(player.y + player.height / 2)
            );
            this.ctx.drawImage(
              player.deadImage,
              player.x + player.width - 2,
              player.y - player.height / 1.3
            );
            break;
          case RIGHT:
            this.ctx.translate(
              player.x + player.width / 2,
              player.y + player.height / 2
            );
            this.ctx.rotate((90 * Math.PI) / 180);
            this.ctx.translate(
              -(player.x + player.width / 2),
              -(player.y + player.height / 2)
            );
            this.ctx.drawImage(
              player.deadImage,
              player.x - player.height / 2,
              player.y - player.width / 2
            );
            break;
          default:
            break;
        }
        this.ctx.restore();
      }
    });
  },
  drawPlayersLines: function () {
    game.players.forEach((player) => {
      this.ctx.strokeStyle = player.bikeColor;
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      player.linePoints.forEach((linePoint, index) => {
        const { x, y } = linePoint;
        if (index === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      });
      this.ctx.lineTo(player.x, player.y);
      // To draw a line to the players current location
      this.ctx.stroke();
      this.ctx.closePath();
    });
  },
  updateAllPlayersDirection: function (event) {
    // this code is very bad spaghetti. It is not a spicy meatball. But it does work.
    // This function serves to prevent the player from moving backwards into one of their
    // Own lines, and to prevent direction changes after death.
    if (game.isRunning) {
      const [player1, player2] = game.players;
      player1.lastDirection = player1.direction;
      player2.lastDirection = player2.direction;
      switch (event.key) {
        case "w":
          if (player1.lastDirection !== DOWN && player1.isAlive) {
            player1.updatePlayerDirection(UP);
          }
          break;
        case "d":
          if (player1.lastDirection !== LEFT && player1.isAlive) {
            player1.updatePlayerDirection(RIGHT);
          }
          break;
        case "s":
          if (player1.lastDirection !== UP && player1.isAlive) {
            player1.updatePlayerDirection(DOWN);
          }
          break;
        case "a":
          if (player1.lastDirection !== RIGHT && player1.isAlive) {
            player1.updatePlayerDirection(LEFT);
          }
          break;
        case "ArrowUp":
          if (player2.lastDirection !== DOWN && player2.isAlive) {
            player2.updatePlayerDirection(UP);
          }
          break;
        case "ArrowRight":
          if (player2.lastDirection !== LEFT && player2.isAlive) {
            player2.updatePlayerDirection(RIGHT);
          }
          break;
        case "ArrowDown":
          if (player2.lastDirection !== UP && player2.isAlive) {
            player2.updatePlayerDirection(DOWN);
          }
          break;
        case "ArrowLeft":
          if (player2.lastDirection !== RIGHT && player2.isAlive) {
            player2.updatePlayerDirection(LEFT);
          }
          break;
        default:
          break;
      }
    }
  },
  drawLoop: function (timestamp) {
    if (!game.isRunning) {
      return;
    }

    if (!game.lastTimestamp) {
      game.lastTimestamp = timestamp;
    }

    const updateCanvasKeyframe =
      timestamp - KEYFRAME_DURATION > game.lastTimestamp;

    if (updateCanvasKeyframe) {
      game.lastTimestamp = timestamp;
      game.players.forEach((player) => {
        if (player.isAlive) {
          player.move();
        }
      });
      const playerHasDied =
        !game.players[0].isAlive || !game.players[1].isAlive;
      if (playerHasDied && !game.deathTimestamp) {
        game.deathTimestamp = timestamp;
        // Start tracking time since a player has died, 100ms later we will run endGame() method
      }
      // Clear the canvas
      game.ctx.clearRect(0, 0, canvas.width, canvas.height);
      game.drawBackground();
      game.drawPlayers();
      game.drawPlayersLines();
    }

    const playerDeathKeyframe =
      timestamp - DEATH_CHECK_DURATION > game.deathTimestamp;

    if (playerDeathKeyframe) {
      // I wait 10th of a second to see if the other player dies before calling endGame to account for Tie games.
      game.endGame();
      return;
    }

    game.animationIntervalId = requestAnimationFrame(game.drawLoop);
  },
};

class Player {
  constructor(name, bikeColor, startingConditions, scoreBoardElem) {
    this.name = name;
    this.bikeColor = bikeColor;
    this.bikeImage = new Image();
    this.deadImage = new Image();
    this.gameOverNoise = document.createElement("audio");
    this.isAlive = true;
    this.scoreBoardElem = scoreBoardElem;
    this.movementSpeed = 3;
    this.startingConditions = startingConditions;
    this.width = PLAYER_WIDTH;
    this.height = PLAYER_HEIGHT;
    this.x = startingConditions.x;
    this.y = startingConditions.y;
    this.direction = startingConditions.direction;
    this.lastDirection = undefined;
    this.linePoints = [];
    this.horizontalLines = [];
    this.verticalLines = [];

    this.bikeImage.src = `./media/${this.bikeColor}Bike.png`;
    this.deadImage.src = "./media/uDedLol.png";
    this.gameOverNoise.src = "./media/audio/gameOverSound.wav";
    // calling this once to set an initial line segment when bike spawns
    this.saveLinePoint();
  }
  move = () => {
    let newX = this.x;
    let newY = this.y;

    switch (this.direction) {
      case UP:
        newY -= this.movementSpeed;
        break;
      case RIGHT:
        newX += this.movementSpeed;
        break;
      case DOWN:
        newY += this.movementSpeed;
        break;
      case LEFT:
        newX -= this.movementSpeed;
        break;
      default:
        break;
    }

    this.checkBounds(newX, newY);
    this.checkObstacles(newX, newY);

    if (this.isAlive) {
      switch (this.direction) {
        case UP:
          this.y = newY;
          break;
        case RIGHT:
          this.x = newX;
          break;
        case DOWN:
          this.y = newY;
          break;
        case LEFT:
          this.x = newX;
          break;
        default:
          break;
      }
    }
  };
  checkBounds = (newX, newY) => {
    // the front of the bike changes in every direction because the bike is rectangular
    // I've written many switch cases throughout this codebase to account for this

    switch (this.direction) {
      case UP:
        if (newY - this.height < 0) {
          this.die();
        }
        break;
      case RIGHT:
        if (newX + this.height > canvas.width) {
          this.die();
        }
        break;
      case DOWN:
        if (newY + this.height > canvas.height) {
          this.die();
        }
        break;
      case LEFT:
        if (newX - this.height < 0) {
          this.die();
        }
        break;
      default:
        break;
    }
  };
  checkObstacles = (newX, newY) => {
    // This function:
    // concats all obstacles from both players,
    // including each players most recent position or "active line"
    // horizontal lines have a X1, X2, Y Schema
    // vertical lines have a Y1, Y2, X Schema
    // the direction of the player creates a unique bounding box
    // so all 4 directions required slightly different code

    // I initially planned only to check vertical lines if the player is moving left/right
    // and vice versa, this created the problem of players being able to pass through eachother
    // if they were on the exact same x or y axis, so I added a second layer of obstacle
    // checking on each direction.

    let bikeFront;
    let bikeBack;
    let obstacleLines = [];

    game.players.forEach((player) => {
      obstacleLines = obstacleLines.concat(player.verticalLines);
      obstacleLines = obstacleLines.concat(player.horizontalLines);
      const latestLinePoint = player.linePoints[player.linePoints.length - 1];
      if (latestLinePoint.x === player.x) {
        obstacleLines.push({
          y1: latestLinePoint.y,
          y2: player.y,
          x: latestLinePoint.x,
        });
      } else if (latestLinePoint.y === player.y) {
        obstacleLines.push({
          x1: latestLinePoint.x,
          x2: player.x,
          y: latestLinePoint.y,
        });
      }
    });
    switch (this.direction) {
      case UP:
        // Detecting Horizontal Lines
        bikeFront = newY - this.height;
        bikeBack = newY;
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionYAxis =
            obstacle.y < bikeBack && obstacle.y > bikeFront;
          // to get x axis collision I need to find out which x value is larger to normalize the data
          const obstacleXLarge = Math.max(obstacle.x1, obstacle.x2);
          const obstacleXSmall = Math.min(obstacle.x1, obstacle.x2);
          const bikeCollisionXAxis =
            this.x < obstacleXLarge && this.x > obstacleXSmall;
          if (bikeCollisionYAxis && bikeCollisionXAxis) {
            this.die();
          }
        });
        // End Detecting Horizontal Lines
        // Detecting Vertical Lines
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionXAxis = this.x === obstacle.x;
          const obstacleYLarge = Math.max(obstacle.y1, obstacle.y2);
          const obstacleYSmall = Math.min(obstacle.y1, obstacle.y2);
          const bikeCollisionYAxis =
            bikeFront < obstacleYLarge && bikeFront > obstacleYSmall;
          if (bikeCollisionXAxis && bikeCollisionYAxis) {
            this.die();
          }
        });
        // End Detecting Vertical Lines
        break;
      case RIGHT:
        // Detecting Vertical Lines
        bikeFront = newX + this.height;
        bikeBack = newX;
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionXAxis =
            bikeFront > obstacle.x && bikeBack < obstacle.x;
          const obstacleYLarge = Math.max(obstacle.y1, obstacle.y2);
          const obstacleYSmall = Math.min(obstacle.y1, obstacle.y2);
          const bikeCollisionYAxis =
            this.y < obstacleYLarge && this.y > obstacleYSmall;
          if (bikeCollisionXAxis && bikeCollisionYAxis) {
            this.die();
          }
        });
        // End Vertical Line Detection
        // Detecting Horizontal Lines
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionYAxis = this.y === obstacle.y;
          const obstacleXLarge = Math.max(obstacle.x1, obstacle.x2);
          const obstacleXSmall = Math.min(obstacle.x1, obstacle.x2);
          const bikeCollisionXAxis =
            bikeFront > obstacleXSmall && bikeFront < obstacleXLarge;
          if (bikeCollisionYAxis && bikeCollisionXAxis) {
            this.die();
          }
        });
        // End Horizontal Line Detection
        break;
      case DOWN:
        // Detecting Horizontal Lines
        bikeFront = newY + this.height;
        bikeBack = newY;
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionYAxis =
            obstacle.y > bikeBack && obstacle.y < bikeFront;
          // to get x axis collision I need to find out which x value is larger to normalize the data
          const obstacleXLarge = Math.max(obstacle.x1, obstacle.x2);
          const obstacleXSmall = Math.min(obstacle.x1, obstacle.x2);
          const bikeCollisionXAxis =
            this.x < obstacleXLarge && this.x > obstacleXSmall;
          if (bikeCollisionYAxis && bikeCollisionXAxis) {
            this.die();
          }
        });
        // End Detecting Horizontal Lines
        // Detecting Vertical Lines
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionXAxis = this.x === obstacle.x;
          const obstacleYLarge = Math.max(obstacle.y1, obstacle.y2);
          const obstacleYSmall = Math.min(obstacle.y1, obstacle.y2);
          const bikeCollisionYAxis =
            bikeFront < obstacleYLarge && bikeFront > obstacleYSmall;
          if (bikeCollisionXAxis && bikeCollisionYAxis) {
            this.die();
          }
        });
        // End Detecting Vertical Lines
        break;
      case LEFT:
        // Detecting Vertical Lines
        bikeFront = newX - this.height;
        bikeBack = newX;

        obstacleLines.forEach((obstacle) => {
          const bikeCollisionXAxis =
            bikeFront < obstacle.x && bikeBack > obstacle.x;
          const obstacleYLarge = Math.max(obstacle.y1, obstacle.y2);
          const obstacleYSmall = Math.min(obstacle.y1, obstacle.y2);
          const bikeCollisionYAxis =
            this.y < obstacleYLarge && this.y > obstacleYSmall;
          if (bikeCollisionXAxis && bikeCollisionYAxis) {
            this.die();
          }
        });
        // End Vertical Line Detection
        // Detecting Horizontal Lines
        obstacleLines.forEach((obstacle) => {
          const bikeCollisionYAxis = this.y === obstacle.y;
          const obstacleXLarge = Math.max(obstacle.x1, obstacle.x2);
          const obstacleXSmall = Math.min(obstacle.x1, obstacle.x2);
          const bikeCollisionXAxis =
            bikeFront > obstacleXSmall && bikeFront < obstacleXLarge;
          if (bikeCollisionYAxis && bikeCollisionXAxis) {
            this.die();
          }
        });
        // End Horizontal Line Detection
        break;
      default:
        break;
    }
  };
  updatePlayerDirection = (newDirection) => {
    this.saveLinePoint();
    this.direction = newDirection;
  };
  saveLinePoint = () => {
    // Not sure if it was completely necessary to create 3
    // separate points of data storage for the player lines
    // But it helped things to make more sense in my head.

    if (this.linePoints.length >= 1) {
      const latestLinePoint = this.linePoints[this.linePoints.length - 1];
      if (latestLinePoint.x === this.x) {
        this.verticalLines.push({
          y1: latestLinePoint.y,
          y2: this.y,
          x: latestLinePoint.x,
        });
      } else if (latestLinePoint.y === this.y) {
        this.horizontalLines.push({
          x1: latestLinePoint.x,
          x2: this.x,
          y: latestLinePoint.y,
        });
      }
    }
    // convert the "Active Line" into a linePoint
    this.linePoints.push({ x: this.x, y: this.y });
  };
  die = () => {
    game.audio.gameTrack.volume = 0.2;
    this.isAlive = false;
    this.gameOverNoise.play();
  };
}

window.addEventListener("DOMContentLoaded", () => {
  game.init();
});
