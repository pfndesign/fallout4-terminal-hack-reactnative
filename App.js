import React from 'react';
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import { activateKeepAwake } from 'expo-keep-awake';
import * as serviceWorkerRegistration from "./src/serviceWorkerRegistration";
import ShareTechMono from './assets/font/ShareTechMono-Regular.ttf';
import FastpaceTypingSound from './assets/sound/fast-pace-Typing.mp3';
const windowheight = Dimensions.get('window').height;
const windowwidth = Dimensions.get('window').width;
const lineHeight = 21;//each line height
//first response from server
const serverInitResponse = {
  attemptremained: 4,
  passwords: [
    { value: 'SLIP' },
    { value: 'PAWN' },
    { value: 'SOAP' },
    { value: 'LANE' },
    { value: 'PALM' },
    { value: 'MEAT' },
    { value: 'CROP' },
  ], //words to include in memory dump
  lockoutwait: 100000, //ms , if fail to find words in 4 attempts must wait xms to retry or -1 to fully lockout
  likeness: 0, //likeness to answer
  answer: false, // is answer must
};
//server response after sending the selected charecter to server
const serverPostResponse = {
  attemptremained: 4, //remained attempts
  passwords: [
    { value: 'SLIP' },
    { value: 'PAWN' },
    { value: 'SOAP' },
    { value: 'LANE' },
    { value: 'PALM' },
    { value: 'MEAT' },
    { value: 'CROP' },
  ], //words to include in memory dump
  likeness: 1, //likeness to answer
  answer: false, // is answer
  lockoutwait: 5000, //ms , if fail to find words in 4 attempts must wait xms to retry or -1 to fully lockout
};
class App extends React.Component {
  state = {
    lines: 0, //how many lines can fit in screen
    maxcharperline: 0, //max charecter that fit in a line
    charcount: 0, // how many character can fit in does lines
    data: serverInitResponse, //data from server
    pointerendlocations: [],//array of pointer locations{y:ylocation,width:width of the line}
    level: 'NOVICE',//game level
    answer: 'freedom trail',//game answer
    highlightedwords: [],//entry word to use for hightlight
    highlightedwordsreset: false,//reset memory dump flatlist after hightlight changed
    attempts: [], //attempts array(object),
    entrylog: [{ text: 'Memory dumped.' }],//entry log
    memorydump: [], //memory dump array(object) {key: number,onPress: (function),character: string,word: string,wordlocation: array or number}
    hextable: [], //memory hex location array()
    reset: false,//reset game
    typinganimation: new Animated.Value(0),
    pointeranimation: new Animated.Value(0),
    pointeranimationblink: new Animated.Value(0),
    pointeranimationY: 0,
    pointerblinkstart: false,
    fontsLoaded: false,
    soundLoaded: false,
    sound: null,
    soundPlaying: false,
    generatedmemorydump: false,
    pointerlocationcalced: false,
  };
  /**
   * constructor
   * create ref for enty check flatlist
   * by using this ref after adding new entry we will be scrolling to the end of the list
   * @date 2022-02-26
   * @override
   */
  constructor(props) {
    super(props);
    this.entrycheckflatlist = React.createRef();
  }
  /**
   * loadFonts
   * load console font
   * page will not render until font is loaded
   * @date 2022-02-26
   * @async
   * @statechange fontsLoaded
   */
  async loadFonts() {
    await Font.loadAsync({
      ShareTechMono: {
        uri: ShareTechMono,
        display: Font.FontDisplay.SWAP,
      },
    });
    //set the font is loaded
    this.setState({ fontsLoaded: true });
  }
  /**
   * loadSound
   * load console typing sound
   * page will not render until sound is loaded
   * @date 2022-02-26
   * @async
   * @statechange sound
   * @statechange soundLoaded
   */
  async loadSound() {
    const { sound } = await Audio.Sound.createAsync(FastpaceTypingSound);
    //set the sound to loop
    await sound.setIsLoopingAsync(true);
    //set start position at 500ms (first 500ms is nothing)
    await sound.setPositionAsync(500);
    //decrese volume because typing sound is load
    await sound.setVolumeAsync(0.2);
    //set the sound is loaded
    this.setState({ sound: sound, soundLoaded: true });
  }
  /**
   * unloadSound
   * unload sound from memory
   * @date 2022-02-26
   * @async
   * @stateuse sound
   */
  async unloadSound() {
    await this.state.sound.unloadAsync();
  }
  /**
   * componentDidMount
   * @date 2022-02-26
   * @async
   * @fires loadFonts
   * @fires loadSound
   * @fires initHexTable
   * @fires initAttempts
   * @fires caclmemoryspace
   * @fires initAnimationpointer
   * @fires initAnimationpointer
   * @fires initAnimationpointerblink
   * @statechange lines
   */
  async componentDidMount() {
    //don't sleep
    activateKeepAwake();
    //loadfont
    await this.loadFonts();
    //load sound effect
    await this.loadSound();
    //calc memory lines
    var topbarheight = 63,//top bar height
      bottombarheight = 63, //bottom bar (entrylist) height
      windowspace = windowheight - Constants.statusBarHeight,
      avaliblespace = windowspace - (topbarheight + bottombarheight), //space avalible for memorydump texts
      lines = Math.floor(avaliblespace / lineHeight);
    //each memory dump height is 22px
    //set avalible lines for memory dump
    this.setState({ lines: lines }, () => {
      //init after lines are set
      this.initHexTable();
      this.initAttempts();
      this.caclmemoryspace();
      this.initAnimationpointer();
      this.initAnimationpointerblink();
    });
  }
  /**
   * componentWillUnmount
   * @date 2022-02-26
   * @async
   * @fires unloadSound
   * @stateuse soundLoaded
   */
  async componentWillUnmount() {
    if (this.state.soundLoaded) {
      await this.unloadSound();
    }
  }
  /**
   * componentDidUpdate
   * @date 2022-02-26
   * @async
   * @param {object} prevProps
   * @param {object}  prevState
   * @listens state.charcount
   * @listens state.reset
   * @listens state.memorydump
   * @listens state.generatedmemorydump
   * @listens state.soundLoaded
   * @listens state.pointerblinkstart
   * @listens state.soundPlaying
   * @listens state.pointeranimationY
   * @listens state.soundPlaying
   * @listens state.soundPlaying
   * @fires caclmemoryspace
   * @fires generateMemoryDump
   * @fires playSound
   * @fires stopSound
   * @statechange memorydump
   * @statechange generatedmemorydump
   * @statechange soundPlaying
   */
  componentDidUpdate(prevProps, prevState) {
    //if character count changed or game reseted and memory dump is empty
    if (
      (prevState.charcount != this.state.charcount ||
        prevState.reset != this.state.reset) &&
      !this.state.memorydump.length &&
      !this.state.generatedmemorydump &&
      this.state.generatedmemorydump == prevState.generatedmemorydump
    ) {
      //recheck memory fit and regenerate memory dump
      this.setState({ generatedmemorydump: true }, () => {
        this.caclmemoryspace();
        this.setState({
          memorydump: this.generateMemoryDump(this.state.charcount),
          generatedmemorydump: false,
        });
      });
      return;
    }
    //if sound is loaded and pointer is blinking and sound is not playing
    if (
      this.state.soundLoaded &&
      this.state.pointerblinkstart &&
      this.state.soundPlaying == prevState.soundPlaying &&
      !this.state.soundPlaying
    ) {
      //play the sound
      this.setState({ soundPlaying: true }, () => {
        this.playSound();
      });
      return;
    }
    //if pointer is at the end of the page and sound is playing and loaded
    if (
      this.state.pointeranimationY >= windowheight &&
      this.state.soundPlaying == prevState.soundPlaying &&
      this.state.soundPlaying &&
      this.state.soundLoaded
    ) {
      //stop the sound
      this.setState({ soundPlaying: false }, () => {
        this.stopSound();
      });
      return;
    }
  }
  /**
   * playSound
   * play typing sound
   * @date 2022-02-26
   * @async
   * @stateuse sound
   * @statechange soundPlaying
   */
  async playSound() {
    await this.state.sound.playAsync();
    //set sound is playing if state is not set
    if (!this.state.soundPlaying) this.setState({ soundPlaying: true });
  }
  /**
   * stopSound
   * reset the position of the sound and stop it
   * @date 2022-02-26
   * @async
   * @stateuse sound
   * @statechange soundPlaying
   */
  async stopSound() {
    //reset position
    await this.state.sound.setPositionAsync(500);
    await this.state.sound.stopAsync();
    //set sound is not playing if state is not set
    if (this.state.soundPlaying) this.setState({ soundPlaying: false });
  }
  /**
   * initAnimationpointer
   * start pointer animation
   * @date 2022-02-26
   * @requires Animated
   * @fires initAnimationpointer
   * @constantuse lineHeight
   * @constantuse windowwidth
   * @constantuse windowheight
   * @stateuse pointerendlocations
   * @stateuse pointeranimationY
   * @stateuse pointeranimation
   * @statechange pointeranimation by animation
   * @statechange pointeranimationY
   */
  initAnimationpointer() {
    var typingpointerwidth = (lineHeight / 2) + 1,
      pointermaxwordlength = this.state.pointerendlocations.find(
        (x) => x.y == this.state.pointeranimationY
      ),//find pointer info based on animation y locations
      currentlinetextmaxchars =
        typeof pointermaxwordlength != 'undefined'
          ? pointermaxwordlength.width - 12
          : windowwidth, // if pointer location exists animate to width if not animate to window width
      lastlinehardcode = 121,//last line is entry check and usualy it's just one line because it's flatlist can't calc it's entry width
      animationtovalue = currentlinetextmaxchars / windowwidth,// cacl animation value between 0 and 1 as windows width is 1
      maxpointerinline = Math.floor(
        currentlinetextmaxchars / typingpointerwidth
      ),//how many pointer can fit in the animation line
      duforeachline = maxpointerinline * 20; // many ms for each pointer in line
    //hard code last line because of flatlist problem
    if (
      this.state.pointerendlocations.length &&
      this.state.pointerendlocations.findIndex(
        (x) => x.y == this.state.pointeranimationY
      ) ==
      this.state.pointerendlocations.length - 1
    )
      animationtovalue = lastlinehardcode / windowwidth;
    Animated.timing(this.state.pointeranimation, {
      toValue: animationtovalue,
      duration: duforeachline,
      useNativeDriver: true,
      easing: Easing.linear,
    }).start((finished) => {
      //if animation finished and pointer locations is not at end ot the window
      if (
        finished &&
        ((this.state.pointerendlocations.length &&
          this.state.pointeranimationY <
          this.state.pointerendlocations[
            this.state.pointerendlocations.length - 1
          ].y) ||
          (!this.state.pointerendlocations.length &&
            this.state.pointeranimationY < windowheight))
      ) {
        // got to the next pointer location and reset animations
        this.setState(
          { pointeranimationY: this.state.pointeranimationY + lineHeight },
          () => {
            this.state.pointeranimation.setValue(0);
            this.initAnimationpointer();
          }
        );
      } else if (finished && this.state.pointeranimationY >= windowheight) {
        //if pointer location is at the end of the window height stop the animation
        this.setState({ pointeranimationY: windowheight });
      }
    });
  }
  /**
   * initAnimationpointerblink
   * pointer blinking animation
   * @date 2022-02-26
   * @requires Animated
   * @fires nitAnimationpointerblink
   * @constantuse windowheight
   * @stateuse pointerblinkstart
   * @stateuse pointeranimationblink
   * @statechange pointerblinkstart
   */
  initAnimationpointerblink = () => {
    if (!this.state.pointerblinkstart)
      this.setState({ pointerblinkstart: true });
    //reset animation value
    this.state.pointeranimationblink.setValue(0);
    Animated.timing(this.state.pointeranimationblink, {
      toValue: 1,
      duration: 20,
      useNativeDriver: Platform.OS == 'web' ? true : false,
    }).start((finished) => {
      //if pinter is not at the end of the page
      if (finished && this.state.pointeranimationY <= windowheight) {
        //loop animation
        this.initAnimationpointerblink();
      } else if (finished) {
        //if pinter is at the end of the page stop the animations
        this.setState({ pointerblinkstart: false });
      }
    });
  };
  /**
   * initHexTable
   * create hex table address
   * @date 2022-02-26
   * @fires renderHexTableItem
   * @stateuse lines
   * @statechange hextable
   */
  initHexTable = () => {
    var randomhexstart = Math.random(),
      hextabletmp = [];
    //fake memory hex address
    for (let i = 0; i < this.state.lines; i++) {
      let n = ((randomhexstart + i) * 0xfffff * 1000000).toString(16);
      hextabletmp.push(this.renderHexTableItem(i, n.slice(0, 4)));
    }
    this.setState({ hextable: hextabletmp });
  };

  /**
   * initAttempts
   * render attempts
   * @date 2022-02-26
   * @fires renderAttemptItem
   * @stateuse data.attemptremained
   * @statechange attempts
   */
  initAttempts = () => {
    var attempts = [];
    //attempts
    for (let i = 0; i < this.state.data.attemptremained; i++) {
      attempts.push(this.renderAttemptItem(i));
    }
    this.setState({ attempts: attempts });
  };

  /**
   * onLayoutPointerlocations
   * calc each line y and width for pointer animations
   * @date 2022-02-26
   * @param {nativeEvent} event
   * @param {bool}  interpolate
   * @constantuse lineHeight
   * @stateuse pointerlocationcalced
   * @stateuse pointerendlocations
   * @statechange pointerlocationcalced
   * @statechange pointerendlocations
   */
  onLayoutPointerlocations = (event, interpolate) => {
    //if locations calculated stop
    if (this.state.pointerlocationcalced) return;
    const { x, y, width, height } = event.nativeEvent.layout;
    var pointerlocations = this.state.pointerendlocations,
      locationheight = y + height;
    //if layout is multi line and we should interpolate it
    if (height > lineHeight && interpolate) {
      //create pointer location for each line
      for (var liney = y; liney <= locationheight; liney += lineHeight) {
        pointerlocations.push({
          y: liney,
          width: width,
        });
        //if it's the last line job is done
        // because last thing is memory dump area this line works
        if (liney + lineHeight >= locationheight) {
          this.setState({ pointerlocationcalced: true });
        }
      }
    } else {
      //layout is not multiline
      pointerlocations.push({
        y: y,
        width: width,
      });
    }
    //save the pointer locations
    this.setState({ pointerendlocations: pointerlocations });
  };

  /**
   * durstenfeldShuffle
   * durstenfeld array shuffle
   * @date 2022-02-26
   * @param {array} array
   */
  durstenfeldShuffle = (array) => {
    for (var i = array.length - 1; i > 0; i--) {
      var rand = Math.floor(Math.random() * (i + 1));
      [array[i], array[rand]] = [array[rand], array[i]];
    }
  };
  /**
   * randomIntFromInterval
   * generate random number bettwen min and max
   * @date 2022-02-26
   * @param {Number} min
   * @param {Number}  max
   * @returns {Number} random number
   */
  randomIntFromInterval = (min, max) => {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  };

  /**
   * generateWords
   * generate words for memory dump
   * @date 2022-02-26
   * @param {Number} wordlength length of the generated words
   * @param {Number} totalwords total word to generate
   * @param {Number} similarcount total similar word to generate
   * @returns {object} {answer: string,words: array,bestMatch: float}
   * @requires an-array-of-english-words
   * @requires string-similarity
   * @fires randomIntFromInterval
   */
  generateWords = (wordlength, totalwords, similarcount) => {
    var words = require('an-array-of-english-words'),
      stringSimilarity = require('string-similarity'),
      wordbylength = words.filter((d) => d.length == wordlength); //find word by length
    //shuffle
    this.durstenfeldShuffle(wordbylength);

    var wordlist = wordbylength.slice(0, totalwords), //slice the array
      answer = wordlist[this.randomIntFromInterval(0, totalwords - 1)], //find random answer
      answerindex = wordbylength.indexOf(answer), //index of answer in words array
      bestmatchrating = 0, //best match match word founded in array
      similartoanwser = [], //similar words to the answer
      similarwordsbyrating = []; //sorted similar words to answer
    //remove the answer from wordlist
    wordbylength.splice(answerindex, 1);
    //pick similar words
    while (bestmatchrating < 0.1) {
      similartoanwser = stringSimilarity.findBestMatch(answer, wordbylength);
      bestmatchrating = similartoanwser.bestMatch.rating;
      //there is no similar word to answer
      if (similartoanwser.bestMatch.rating < 0.1) {
        //select another answer
        answer =
          wordlist[this.randomIntFromInterval(0, wordbylength.length - 1)];
      }
    }
    similarwordsbyrating = similartoanwser.ratings;
    //sort similar words by rating
    similarwordsbyrating.sort((a, b) =>
      a.rating > b.rating ? -1 : b.rating > a.rating ? 1 : 0
    );
    //slice similar answers
    similarwordsbyrating = similarwordsbyrating.slice(0, similarcount);
    //map answers
    similarwordsbyrating = similarwordsbyrating.map(function (item) {
      return item['target'];
    });
    wordlist.concat(similarwordsbyrating);
    wordlist = wordlist.map((name) => name.toUpperCase());
    return {
      answer: answer.toUpperCase(),
      words: wordlist,
      bestMatch: similartoanwser.bestMatch.rating,
    };
  };
  /**
   * generateMemoryDump
   * generate memory dump data for flatlist
   * @date 2022-02-26
   * @param {Number} length total memory dump character length
   * @returns {array} {key: number,onPress: (function),character: string,word: string,wordlocation: array or number}
   * @requires crypto-js
   * @fires randomIntFromInterval
   * @fires generateWords
   * @statechange answer
   * @statechange level
   */
  generateMemoryDump = (length) => {
    var result = [],
      characters = '~!@#$%^&*()_+|}{":;\'/.<>=-`',
      charactersLength = characters.length,
      passwordlength = 0,
      cryptojS = require('crypto-js'),
      wordlength = this.randomIntFromInterval(4, 8),
      totalwords = this.randomIntFromInterval(4, 8),
      similarwordcount = this.randomIntFromInterval(4, 8),
      generateWords = this.generateWords(
        wordlength,
        totalwords,
        similarwordcount
      ),
      pickanswer = generateWords.answer;
    //level
    var level = 0,
      // word length 4 is 0 and 8 is 0.125
      wordlengthdifficulty = (wordlength * 0.25) / 8 - 0.125,
      // total words 4 is 0 and 8 is 0.125
      totalwordsdifficulty = (totalwords * 0.25) / 8 - 0.125,
      // similar words 4 is 0 and 8 is 0.125 - must be subtracted from difficulty
      similarworddifficulty = (similarwordcount * 0.25) / 8 - 0.125,
      // generate Word 8 is 0 and 16 is 0.125
      generateWorddifficulty = (generateWords.words.length * 0.25) / 16 - 0.125,
      // bestmatch difficulty 0.1 is 0 and 0.9 is 0.2 - must be subtracted from difficulty ((generateWords.bestMatch * 0.25) /1)-0.025
      bestmatchdifficulty = (generateWords.bestMatch * 0.25) / 1 - 0.025,
      //min difficulty is -0.325 and max is 0.375 by addin 0.325 number is between 0 and 0.7
      difficultylevel =
        wordlengthdifficulty +
        totalwordsdifficulty +
        generateWorddifficulty -
        (bestmatchdifficulty + similarworddifficulty) +
        0.325;
    // calc level
    if (difficultylevel <= 0.2) level = 'NOVICE';
    else if (difficultylevel <= 0.4) level = 'ADVANCED';
    else if (difficultylevel <= 0.5) level = 'EXPERT';
    else if (difficultylevel <= 0.7) level = 'MASTER';
    //save answer
    this.setState({
      answer: cryptojS.AES.encrypt(
        pickanswer,
        "Hey, chin up. I know the night just got darker, but it won't last forever"
      ),
      level: level,
    });
    //add passwords
    generateWords.words.map((item, index) => {
      passwordlength += item.length;
      result.push({
        key: 'w' + index + item,
        onPress: () => this.checkEntry(item, false),
        character: item,
        word: item,
      });
    });
    length -= passwordlength;
    //add rest of the characters
    for (let i = 0; i < length; i++) {
      let character = characters.charAt(
        Math.floor(Math.random() * charactersLength)
      );
      result.push({
        key: 'c' + i + character,
        onPress: () => this.checkEntry(character, false),
        character: character,
        word: character,
      });
    }
    //shuffle
    this.durstenfeldShuffle(result);
    // terminal cheats
    var cheatstartchart = ['{', '(', '{'];
    ///now find the word delete them and add each of their words in their locations
    result.map((item, index) => {
      if (item.character.length > 1) {
        //replace og word with first letter of that word
        result[index] = {
          key: 'w' + index + item.character,
          onPress: () => this.checkEntry(item.character, false),
          character: item.character[0],
          word: item.character,
          wordlocation: index,
        };

        //re add each char after another
        for (let i = 1; i < item.character.length; i++) {
          result.splice(index + i, 0, {
            key: 'w' + i + item.character,
            onPress: () => this.checkEntry(item.character, false),
            character: item.character[i],
            word: item.character,
            wordlocation: index,
          });
        }
      } else if (
        cheatstartchart.indexOf(item.character) > -1 &&
        typeof result[index + 1] != 'undefined'
      ) {
        var chars = item.character;
        // if there is () or {} or [] reset attempts and remove duds
        // max char include between is 12 char
        for (let i2 = index + 1; i2 < result.length - 1; i2++) {
          chars += result[i2].character;
          if (
            ((item.character == '{' && result[i2].character == '}') ||
              (item.character == '(' && result[i2].character == ')') ||
              (item.character == '[' && result[i2].character == ']') ||
              (item.character == '<' && result[i2].character == '>')) &&
            chars.length <= 12
          ) {
            result[index] = {
              key: item.key,
              onPress: () => this.checkEntry(chars, true),
              character: item.character,
              word: chars,
              wordlocation: [index, i2],
            };
            result[i2] = {
              key: result[i2].key,
              onPress: () => this.checkEntry(chars, true),
              character: result[i2].character,
              word: chars,
              wordlocation: [index, i2],
            };
            break;
          }
        }
      }
    });
    return result;
  };
  /**
   * caclmemoryspace
   * calculate memory dump space 
   * @date 2022-02-26
   * @sateuse lines
   * @statechange charcount
   * @statechange maxcharperline
   */
  caclmemoryspace = () => {
    var padding = 20,//container patting
      hextablewidth = 70,//hextable width
      width = windowwidth - (hextablewidth + padding),//remaining space for memory dump area
      maxcharperline = Math.floor(width / 12),//each character has a 12px width
      charcount = maxcharperline * this.state.lines; // total charecters fit in the area
    //calc max char that fit in memory view
    this.setState({ charcount: charcount, maxcharperline: maxcharperline });
  };
  /**
   * checkEntry
   * check user selected character with answer
   * @date 2022-02-26
   * @async
   * @param {string} value user selected word
   * @param {boolean} cheat is word a cheat or not
   * @fires randomIntFromInterval
   * @fires removerandomdud
   * @fires initAttempts
   * @fires addEntry
   * @fires checkLikeness
   * @fires reset
   * @constantuse windowheight
   * @constantuse serverInitResponse
   * @constantuse serverPostResponse
   * @stateuse pointeranimationY
   * @stateuse highlightedwords
   * @stateuse data.attemptremained
   * @stateuse data.answer
   * @statechange pointeranimationY
   * @statechange highlightedwords
   * @statechange highlightedwordsreset
   * @statechange data
   * @statechange reset
   */
  checkEntry = (value, cheat) => {
    //finish the animation
    if (this.state.pointeranimationY < windowheight) {
      this.setState({ pointeranimationY: windowheight });
      return false;
    }
    //add to highlighted words
    var highlightedwords = this.state.highlightedwords;
    if (value.length > 1 && !highlightedwords.includes(value)) {
      highlightedwords.push(value);
    }
    //1 in 5 chance to reset and 4 in 5 to remove a dud once
    if (cheat) {
      if (this.randomIntFromInterval(1, 5) == 1) {
        //remove the cheat
        this.removerandomdud(value, false);
        //reset attempts
        serverPostResponse.attemptremained = serverInitResponse.attemptremained;
        this.setState(
          {
            data: serverInitResponse,
            reset: !this.state.reset,
          },
          () => {
            this.initAttempts();
          }
        );
        this.addEntry([value, 'Tries reset.']);
      } else {
        this.removerandomdud(value, true);
        this.addEntry([value, 'Dud removed.']);
      }
      return false;
    }
    if (this.state.data.attemptremained == 0 || this.state.data.answer === true)
      return false;
    //send to fake server for now
    var tempdata = serverPostResponse;
    tempdata.attemptremained -= 1; //fake attempt reduce for test
    //save fake data as new data
    this.setState(
      {
        data: tempdata,
        highlightedwords: highlightedwords,
        highlightedwordsreset: !this.state.highlightedwordsreset,
      },
      () => {
        this.initAttempts();
      }
    );
    var likenesss = this.checkLikeness(value);
    if (likenesss == -1) {
      this.addEntry(['Password Accepted.', 'Reset Terminal.']);
      // reactive terminal
      setTimeout(() => {
        this.reset();
      }, serverPostResponse.lockoutwait);
    } else {
      if (tempdata.attemptremained == 0) {
        //if lockout wait is allowed
        if (serverPostResponse.lockoutwait != -1) {
          this.addEntry([
            value,
            'Entry denied.',
            'Likeness=' + likenesss,
            'initiate lockdown.',
            'wait ' + serverPostResponse.lockoutwait + 'ms.',
          ]);
          // reactive terminal
          setTimeout(() => {
            this.reset();
          }, serverPostResponse.lockoutwait);
        } else {
          //lock out wait is not allowed and user is logout form terminal
          this.addEntry([
            value,
            'Entry denied.',
            'Likeness=' + likenesss,
            'initiate lockdown.',
            'lockdown complete.',
          ]);
        }
      } else {
        //normal entry check
        this.addEntry([value, 'Entry denied.', 'Likeness=' + likenesss]);
      }
    }
  };
  /**
   * checkLikeness
   * check user selected word with answer for likness rating
   * @date 2022-02-26
   * @param {string} value selected word
   * @returns {number} between 0 and word length
   * @requires string-similarity
   * @requires crypto-js
   * @stateuse answer
   */
  checkLikeness = (value) => {
    var stringSimilarity = require('string-similarity'),
      cryptojS = require('crypto-js'),
      bytes = cryptojS.AES.decrypt(
        this.state.answer.toString(),
        "Hey, chin up. I know the night just got darker, but it won't last forever"
      ),
      answer = bytes.toString(cryptojS.enc.Utf8),//decrypted anwser
      similarity = stringSimilarity.compareTwoStrings(answer, value) * 100,//check for similarity and convert to 3 digit number between 0 and 100
      maxlikeness = value.length > 1 ? value.length : 4, // likness is bettwen 0 and word length
      likeness = Math.floor(1 + (similarity / 100) * maxlikeness);// interpolate likeness bettwen 1 and wordlength
    //decress it so likness is starting from 0
    likeness--;
    return similarity == 100 ? -1 : likeness;
  };
  /**
   * removerandomdud
   * remove a random dud from memory dump
   * @date 2022-02-26
   * @param {string} cheatword cheat word used
   * @param {boolean} removedud remove dud or reset attempt
   * @requires crypto-js
   * @fires randomIntFromInterval
   * @stateuse memorydump
   * @stateuse answer
   * @statechange memorydump
   */
  removerandomdud(cheatword, removedud) {
    var removed = false,
      tmpmemorydump = this.state.memorydump,
      cryptojS = require('crypto-js'),
      bytes = cryptojS.AES.decrypt(
        this.state.answer.toString(),
        "Hey, chin up. I know the night just got darker, but it won't last forever"
      ),
      answer = bytes.toString(cryptojS.enc.Utf8);
    //looking into memory dump
    tmpmemorydump.map((char, index) => {
      //check if word is more than 1 and there is wordlocation and word is not the answer and pick randomly
      var randomchance = this.randomIntFromInterval(0, 1);
      if (
        removedud &&
        char.word.length > 1 &&
        typeof char.wordlocation != 'undefined' &&
        !Array.isArray(char.wordlocation) &&
        char.word != answer &&
        !removed &&
        randomchance == 1
      ) {
        //find last index based on the first word location
        var toindex = char.wordlocation + char.word.length;
        //loop chars and replace them with .
        for (var i = char.wordlocation; i < toindex; i++) {
          if (tmpmemorydump[i].word == char.word)
            tmpmemorydump[i] = {
              key: tmpmemorydump[i].key,
              onPress: () => this.checkEntry('.', false),
              character: '.',
              word: '.',
            };
        }
        removed = true;
      } else if (char.word == cheatword && Array.isArray(char.wordlocation)) {
        //deactive the cheat word
        tmpmemorydump[index] = {
          key: char.key,
          onPress: () => this.checkEntry(char.word, false),
          character: char.character,
          word: char.word,
        };
      }
    });
    this.setState({ memorydump: tmpmemorydump });
  }
  /**
   * addEntry
   * @date 2022-02-26
   * @param {array} logs array of entrys
   * @fires playSound
   * @fires stopSound
   * @stateuse entrylog
   * @statechange entrylog
   */
  addEntry = (logs) => {
    //play typing sound
    this.playSound();

    var logtmp = this.state.entrylog,
      newlogs = [];
    //push logs
    logs.map((item) => {
      newlogs.push({ text: item });
    });
    //combine logs
    Array.prototype.push.apply(logtmp, newlogs);
    //update the entrylog
    this.setState({ entrylog: logtmp }, () => {
      //scroll entrycheck flatlist to the end
      this.entrycheckflatlist.current.scrollToEnd({ animated: true });
      //stop typing sound
      this.stopSound();
    });
  };
  /**
   * reset
   * resst the game
   * @date 2022-02-26
   * @fires initHexTable
   * @fires initAttempts
   * @fires initAnimationpointer
   * @fires initAnimationpointerblink
   * @constantuse serverInitResponse
   * @constantuse serverPostResponse
   * @stateuse reset
   * @stateuse highlightedwordsreset
   * @statechange data
   * @statechange entrylog
   * @statechange memorydump
   * @statechange reset
   * @statechange pointeranimationY
   * @statechange highlightedwords
   * @statechange highlightedwordsreset
   */
  reset = () => {
    serverPostResponse.attemptremained = serverInitResponse.attemptremained;
    this.state.typinganimation.setValue(0);
    this.state.pointeranimation.setValue(0);
    this.state.pointeranimationblink.setValue(0);
    this.initHexTable();
    this.setState(
      {
        data: serverInitResponse,
        entrylog: [{ text: 'Memory dumped.' }],
        memorydump: [],
        reset: !this.state.reset,
        pointeranimationY: 0,
        highlightedwords: [],
        highlightedwordsreset: !this.state.highlightedwordsreset,
      },
      () => {
        this.initAttempts();
        this.initAnimationpointer();
        this.initAnimationpointerblink();
      }
    );
  };
  /**
   * renderAttempts
   * @date 2022-02-26
   * @param {array} attempts renderAttemptItem
   * @returns {View}
   */
  renderAttempts = (attempts) => {
    return (
      <View style={styles.attempts}>
        <Text style={[styles.line, styles.consoletext]}>
          Attempts Remained :
        </Text>
        <View style={styles.attemptremained}>{attempts}</View>
      </View>
    );
  };
  /**
   * renderMemoryView
   * @date 2022-02-26
   * @constantuse lineHeight
   * @stateuse hextable
   * @stateuse maxcharperline
   * @stateuse memorydump
   * @stateuse highlightedwordsreset
   * @returns {View}
   */
  renderMemoryView = () => {
    return (
      <View style={styles.memory}>
        <View style={[styles.hextable, styles.line]}>
          {this.state.hextable}
        </View>
        {this.state.maxcharperline == 0 ? (
          <FlatList key={'tmp'} />
        ) : (
          <FlatList
            key={'memorydump'}
            keyExtractor={(item) => item.key}
            data={this.state.memorydump}
            extraData={this.state.highlightedwordsreset}
            refreshing={true}
            renderItem={({ item }) => {
              return this.renderMemorydumpItem(item);
            }}
            columnWrapperStyle={{ height: lineHeight }}
            numColumns={this.state.maxcharperline}
            getItemLayout={(data, index) => ({
              length: lineHeight,
              offset: lineHeight * index,
              index,
            })}
          />
        )}
      </View>
    );
  };
  /**
   * renderEntrycheck
   * @date 2022-02-26
   * @param {array} data entrylog data
   * @returns {View}
   * @ref entrycheckflatlist
   * @constuse lineHeight
   * @stateuse reset
   */
  renderEntrycheck = (data) => {
    return (
      <View style={styles.entrycheck}>
        <FlatList
          ref={this.entrycheckflatlist}
          style={styles.entrychecklist}
          keyExtractor={(item, index) => index + item.text}
          data={data}
          extraData={this.state.reset}
          refreshing={true}
          renderItem={({ item, index }) => {
            return this.renderEntrylogItem(index, item.text);
          }}
          getItemLayout={(data, index) => ({
            length: lineHeight,
            offset: lineHeight * index,
            index,
          })}></FlatList>
      </View>
    );
  };
  /**
   * renderAttemptItem
   * @date 2022-02-26
   * @param {number} key item key
   * @returns {View}
   */
  renderAttemptItem = (key) => {
    return <View key={key} style={styles.attemptremainedindicat} />;
  };
  /**
   * renderHexTableItem
   * @date 2022-02-26
   * @param {number} key item key
   * @param {string} location memory hex location string
   * @returns {View}
   */
  renderHexTableItem = (key, location) => {
    return (
      <Text
        key={key}
        style={[
          styles.hexlocation,
          styles.consoletext,
          styles.consoletexttouchable,
        ]}>
        0x{location}
      </Text>
    );
  };
  /**
   * renderMemorydumpItem
   * @date 2022-02-26
   * @param {object} props {key: number,onPress: (function),character: string,word: string,wordlocation: array or number}
   * @returns {View}
   */
  renderMemorydumpItem = (props) => {
    return (
      <TouchableOpacity data={props} key={props.key} onPress={props.onPress}>
        <Text
          style={[
            styles.consoletext,
            styles.consoletexttouchable,
            styles.memorydatachar,
            this.state.highlightedwords.includes(props.word)
              ? styles.consoletexthighlight
              : null,
          ]}>
          {props.character}
        </Text>
      </TouchableOpacity>
    );
  };
  /**
   * renderEntrylogItem
   * @date 2022-02-26
   * @param {number} key item key
   * @param {string} value entry log text
   * @returns {value}
   */
  renderEntrylogItem = (key, value) => {
    return (
      <Text key={key} style={[styles.entrychecktext, styles.consoletext]}>
        {'>'}
        {value}
      </Text>
    );
  };
  render() {
    //if font and sound is loaded
    if (this.state.fontsLoaded && this.state.soundLoaded) {
      return (
        <View style={styles.container}>
          {/* topbar */}
          <View style={styles.topbar}>
            <Text
              style={[styles.line, styles.consoletext]}
              onLayout={(e) => this.onLayoutPointerlocations(e, false)}>
              Welcome to Termlink access
            </Text>
            <Text
              style={[styles.line, styles.consoletext]}
              onLayout={(e) => this.onLayoutPointerlocations(e, false)}>
              Password Required [{this.state.level}]
            </Text>
            <View onLayout={(e) => this.onLayoutPointerlocations(e, true)}>
              {this.renderAttempts(this.state.attempts)}
            </View>
          </View>
          {/* memory dump and hextable */}
          <View
            style={styles.console}
            onLayout={(e) => this.onLayoutPointerlocations(e, true)}>
            {this.renderMemoryView()}
          </View>
          {/* entry check */}
          {this.renderEntrycheck(this.state.entrylog)}
          {/* animated pointer */}
          <Animated.View
            style={[
              styles.typinganimation,
              {
                transform: [
                  {
                    translateY: this.state.pointeranimationY + lineHeight,
                  },
                ],
              },
            ]}
            pointerEvents="none"></Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.typingpointerbg,
              {
                transform: [
                  {
                    translateX: this.state.pointeranimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, windowwidth],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    translateY: this.state.pointeranimationY,
                  },
                ],
              },
            ]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.typingpointer,
                {
                  backgroundColor: this.state.pointeranimationblink.interpolate(
                    {
                      inputRange: [0, 1],
                      outputRange: ['#010203', '#00FF7F'],
                    }
                  ),
                },
              ]}
            />
          </Animated.View>
          <StatusBar style="light" />
        </View>
      );
    } else {
      return null;
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#010203',
    padding: 10,
    overflow: 'hidden',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  topbar: {
    height: 63,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  line: {
    lineHeight: lineHeight,
  },
  consoletext: {
    fontFamily: 'ShareTechMono',
    textAlign: 'left',
    color: '#00FF7F',
    fontSize: 14,
  },
  consoletexthighlight: {
    backgroundColor: '#00FF7F',
    color: '#010203',
  },
  consoletexttouchable: {
    fontSize: 18,
  },
  attempts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attemptremained: {
    marginLeft: 10,
    flexDirection: 'row',
  },
  attemptremainedindicat: {
    width: 10,
    height: 10,
    backgroundColor: '#00FF7F',
    marginRight: 10,
  },
  memory: {
    flex: 1,
    flexDirection: 'row',
  },
  hexlocation: {
    marginRight: 10,
    lineHeight: lineHeight,
  },
  console: {
    flex: 1,
  },
  entrycheck: {
    width: '100%',
    height: 63,
    overflow: 'hidden',
  },
  entrychecktext: {
    lineHeight: lineHeight,
  },
  memorydatachar: {
    minWidth: 12,
    display: Platform.OS == 'web' ? 'inline-block' : 'flex',
    textAlign: 'center',
  },
  typinganimation: {
    position: 'absolute',
    backgroundColor: '#010203',
    width: windowwidth,
    height: '100%',
    top: 0,
    left: 0,
  },
  typingpointerbg: {
    position: 'absolute',
    width: '100%',
    height: lineHeight,
    top: 0,
    left: 10,
    backgroundColor: '#010203',
    justifyContent: 'center',
  },
  typingpointer: {
    width: (lineHeight / 2) + 1,
    height: (lineHeight / 2) + 1,
    backgroundColor: '#00FF7F',
  },
});

export default App;

if (Platform.OS == 'web')
  serviceWorkerRegistration.register();