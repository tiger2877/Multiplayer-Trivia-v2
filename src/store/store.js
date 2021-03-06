import Vue from 'vue'
import Vuex from 'vuex'
import firebase from 'firebase'
import { timer } from './modules/timer'

Vue.use(Vuex); // Vuex
Vue.use(firebase); // Firebase

// Firebase config
var config = {
  apiKey: "AIzaSyDzwzbzxZAXsaifw0-TGz_d1aHvvKUDfpM",
  authDomain: "multiplayer-trivia-fb860.firebaseapp.com",
  databaseURL: "https://multiplayer-trivia-fb860.firebaseio.com",
  projectId: "multiplayer-trivia-fb860",
  storageBucket: "multiplayer-trivia-fb860.appspot.com",
  messagingSenderId: "826236380922"
};
// Initialize Firebase
firebase.initializeApp(config);

export const store = new Vuex.Store({
  // Hard coded initial state so browser doesn't 'break'...
  // ...while waiting on firebase db
  state: {
    // Chat - message history
    _chat: {
      "-L6mfeJDqiuUbqT6xS4Q": {
        message: " ",
        name: " "
      }
    },
    _questionBank: [

    ],
    // Players - name, points, answer chosen
    _players: {
      
    },
    // Timer - initial set time, seconds remaining
    _timer: {
    initial: 30,
    remaining: 0
  },
    // Trivia - question + correct/incorrect answers
    _trivia: {
      category: "",
      correct_answer: "",
      difficulty: "",
      incorrect_answers: [],
      question: "",
      type: ""
    }
  },
  getters: {
    getCorrectAnswer(state) {
      if (state._trivia) {
        return state._trivia.correct_answer;
      }
      return false;
    },
    getQuestionCount(state) {
      if (state._questionBank) {
        return state._questionBank.length
      }
      return false;
    },
    isKeyInDb: function (state) {
      let key = localStorage.getItem("playerKey");
      // Handle if no players exist
      if (state._players) {
        // Test db for presence of key
        return state._players.hasOwnProperty(key)
          ? true
          : false;
      }
      // When no players exist
      return false;
    },
    getQuestion: function (state) {
      if (state._trivia) {
        return state._trivia.question;
      }
      return false;
    },
    getChatHistory: function (state) {
      // Array of message objects
      return state._chat
        ? Object.values(state._chat)
        : false;
    },
    getChoices: function (state) {
      if (state._trivia) {
        // Combine incorrect/correct choices (throws err's)
        let choices = state._trivia.incorrect_answers;
        // Splice correct answer to random index of choices array
        let randomIndex = Math.floor(Math.random() * (choices.length + 1));
        choices.splice(randomIndex, 0, state._trivia.correct_answer);
        return choices;
      }
      return false;
    },
    getPoints: function (state) {
      let key = localStorage.getItem("playerKey");
      if (state._players) {
        return state._players.hasOwnProperty(key)
          ? state._players[key].points
          : false;
      }
      return false;
    },
    getRank(state) {
      let key = localStorage.getItem("playerKey");
      // Sort players in array
      let sortedArray = Object.values(state._players).sort( 
        (a, b) => b.points - a.points 
      );
      let rank;
      // Calculate rank
      for (let i = 0; i < sortedArray.length; i++) {
        if (sortedArray[i].name === state._players[key].name) {
          rank = i + 1;
        }
      }
      return rank;
    },
    getName(state) {
      let key = localStorage.getItem("playerKey");

      return state._players[key]
        ? state._players[key].name
        : "Create Player Name";
    },
    getSecondsInitial: function (state) {
      return state._timer
        ? state._timer.initial
        : false;
    },
    getSecondsRemaining: function (state) {
      return state._timer
        ? state._timer.remaining
        : false;
    },
    getPlayers: function (state) {
      return state._players
        ? state._players
        : false;
    },
    getLeaders: function (state) {
      // How many leaders to show on leaderboard
      let leaderboardLimit = 10;
      // if state is present
      if (state._players) {
        // Transform player object of objects into array
        let objArray = Object.values(state._players);
        // Sort players from highest to lowest points
        let leaders = objArray.sort( (a,b) => b.points - a.points );
        // Only return (at most) the top 10 players
        return leaders.length > leaderboardLimit 
          ? leaders.slice(0, leaderboardLimit)
          : leaders;
      }
      // If state not yet present
      return false;
    }
  },
  mutations: {
    setTimer:  (state, timerObj)   => state._timer   = timerObj,
    setChat:   (state, chatObj)    => state._chat    = chatObj,
    setTrivia: (state, triviaObj)  => state._trivia  = triviaObj,
    setPlayers: (state, playerObj) => state._players = playerObj,
    setQuestionBank: (state, qArray) => state._questionBank = qArray
  },
  actions: {
    tallyScore(context) {
      // declare variable to store correct answer
      let answer = context.state._trivia.correct_answer;
      // iterate over players
      for (let playerKey in context.state._players) {
        let name = context.state._players[playerKey].name;
        let points = context.state._players[playerKey].points;
        let choice = context.state._players[playerKey].choice;
        // compare chosen answer to correct answer
        if (choice === answer) {
          points++;
        }
        // push updated player objects to db
        firebase.database().ref('/players/').child(playerKey).update({
          name: name,
          points: points
        });
      }
    },
    startTimer(context) {
      let initial = context.state._timer.initial;
      let timerRef = firebase.database().ref('/timer');

      const timer = {
        intervalId: null,
        secondsRemaining: 0,
        setTimer(seconds) {
          timer.secondsRemaining = seconds;
          return timerRef.update({
            initial: initial,
            remaining: initial
          });
        },
        startTimer() {
          return timer.intervalId = setInterval(timer.countDown, 1000);
        },
        countDown() {
          timer.secondsRemaining--;

          timerRef.update({
            initial: context.state._timer.initial,
            remaining: timer.secondsRemaining
          });
            
          if (timer.secondsRemaining <= 0) {
            return timer.timeRanOut();
          }
        },
        timeRanOut() {
          context.dispatch('tallyScore');
          return clearInterval(timer.intervalId);
        }
      };
      // set timer
      timer.setTimer(initial);
      // start timer
      // setTimeout(timer.startTimer, 1000);
      timer.startTimer();
    },
    postQuestion(context, payload) {
      context.dispatch('startTimer');
      // retrieve question object at payload (payload = index)
      let nextQuestionObj = context.state._questionBank[payload];
      // set trivia db ref to trivia object
      return firebase.database().ref('/trivia').set(nextQuestionObj);
    },
    deleteAllPlayers(context) {
      return firebase.database().ref('/players').set({});
    },
    resetAllScores(context) {
      // Ignore input when no players exist
      if (context.state._players) {
        // Iterate over players
        for (let playerKey in context.state._players) {
          let points = 0;
          let name = context.state._players[playerKey].name;
          firebase.database().ref('/players/').child(playerKey).update({
            name: name,
            points: points
          })
        }
      }
    },
    clearAllChats(context) {
      return firebase.database().ref('/chat').set({});
    },
    setTimerInitial(context, payload) {
      let number = parseInt(payload);
      return firebase.database().ref('/timer').update({
        initial: number,
        remaining: context.state._timer.remaining
      });
    },
    // Player chose an answer to a trivia question
    chooseAnswer(context, payload) {
      let playerKey = localStorage.getItem("playerKey");
      return firebase.database().ref('/players').update({
        [playerKey]: {
          name: context.state._players[playerKey].name,
          points: context.state._players[playerKey].points,
          choice: payload
        }
      });
    },
    // Add playerName to database, or change name if key exists
    setPlayerName(context, payload) {
      // playerKey already exists, or get a new one
      let playerKey = localStorage.getItem("playerKey") || firebase.database().ref('/players').push().key;
      // Existing players keep current points
      let points;
      // Test if any players exist
      if (context.state._players) {
        // Test if player key exists in db
        if (context.state._players.hasOwnProperty(playerKey)) {
          points = context.state._players[playerKey].points;
        }
      }
      // Just in case playerKey was not present, send to localStorage
      localStorage.setItem("playerKey", playerKey);
      // Create new object to post to db
      let newPlayer = {};
      // Add key/value of newPlayerKey
      newPlayer[playerKey] = {
        name: payload,
        points: points || 0
      };
      return firebase.database().ref('/players').update(newPlayer);
    },
    sendMessage(context, payload) {
      // Get firebase key for new message
      let newMessageKey = firebase.database().ref('/chat').push().key;
      // Get player key from session storage
      let playerKey = localStorage.getItem("playerKey");
      // Lookup player name
      let name = context.state._players[playerKey].name;
      // Create new object to post to db
      let newMessage = {};
      // Add key/value of newMessageKey
      newMessage[newMessageKey] = {
        name: name,
        message: payload
      };
      return firebase.database().ref('/chat').update(newMessage);
    },
    /************
     * FIREBASE *
     ************/
    getFirebaseQuestionBank: function (context) {
      firebase.database().ref('/questionBank').on("value", snapshot => {
        return context.commit('setQuestionBank', snapshot.val());
      });
    },
    getFirebaseChat: function(context) {
      firebase.database().ref('/chat').on("value", snapshot => {
        return context.commit('setChat', snapshot.val());
      });
    },
    getFirebasePlayers: function(context) {
      firebase.database().ref('/players').on("value", snapshot => {
        return context.commit('setPlayers', snapshot.val())
      });
    },
    getFirebaseTimer: function(context) {
      firebase.database().ref('/timer').on("value", snapshot => {
        return context.commit('setTimer', snapshot.val());
      });
    },
    getFirebaseTrivia: function(context) {
      firebase.database().ref('/trivia').on("value", snapshot => {
        return context.commit('setTrivia', snapshot.val());
      });
    }
  }
});