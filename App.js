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
import * as serviceWorkerRegistration from "./src/serviceWorkerRegistration";
import { activateKeepAwake } from 'expo-keep-awake';
const windowheight = Dimensions.get('window').height;
const windowwidth = Dimensions.get('window').width;
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
const AttemptItem = (props) => {
  return <View style={styles.attemptremainedindicat} />;
};
const Attempts = (props) => {
  return (
    <View style={styles.attempts}>
      <Text style={[styles.line, styles.consoletext]}>Attempts Remained :</Text>
      <View style={styles.attemptremained}>{props.attempts}</View>
    </View>
  );
};
const MemorydumpItem = (props) => {
  return (
    <TouchableOpacity onPress={props.onPress}>
      <Text
        style={[
          styles.consoletext,
          styles.consoletexttouchable,
          styles.memorydatachar,
        ]}>
        {props.character}
      </Text>
    </TouchableOpacity>
  );
};
const HexTableItem = (props) => {
  return (
    <Text
      style={[
        styles.hexlocation,
        styles.consoletext,
        styles.consoletexttouchable,
      ]}>
      0x{props.location}
    </Text>
  );
};
const MemoryView = (props) => {
  var itemheight = 21;
  return (
    <View style={styles.memory}>
      <View style={[styles.hextable, styles.line]}>{props.hextable}</View>
      <FlatList
        keyExtractor={(item) => item.key}
        data={props.memorydump}
        refreshing={true}
        renderItem={({ item }) => {
          return item;
        }}
        columnWrapperStyle={{ height: itemheight }}
        numColumns={props.numColumns}
        getItemLayout={(data, index) => ({
          length: itemheight,
          offset: itemheight * index,
          index,
        })}></FlatList>
    </View>
  );
};
const EntrylogItem = (props) => {
  return (
    <Text style={[styles.entrychecktext, styles.consoletext]}>
      {'>'}
      {props.value}
    </Text>
  );
};
class App extends React.Component {
  state = {
    lines: 0, //how many likes can fit in screen
    maxcharperline: 0, //max charecter that fit in a line
    charcount: 0, // how many character can fit in does lines
    data: serverInitResponse, //data from server
    pointerendlocations: [],
    answer: 'freedom trail',
    attempts: [], //attempts array(object),
    entrylog: [{ text: 'Memory dumped.' }],
    memorydump: [], //memory dump array(MemorydumpItem)
    hextable: [], //memory hex location array()
    reset: false,
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
  constructor(props) {
    super(props);
    this.entrycheckflatlist = React.createRef();
  }
  async loadFonts() {
    await Font.loadAsync({
      ShareTechMono: {
        uri: require('./assets/font/ShareTechMono-Regular.ttf'),
      },
    });
    this.setState({ fontsLoaded: true });
  }
  async loadSound() {
    const { sound } = await Audio.Sound.createAsync(
      require('./assets/sound/fast-pace-Typing.mp3')
    );
    await sound.setIsLoopingAsync(true);
    await sound.setPositionAsync(500);
    await sound.setVolumeAsync(0.3);
    this.setState({ sound: sound, soundLoaded: true });
  }
  async unloadSound() {
    //this.stopSound();
    await this.state.sound.unloadAsync();
  }
  componentDidMount() {
    //don't sleep
    activateKeepAwake();
    //loadfont
    this.loadFonts();
    //load sound effect
    this.loadSound();
    //calc memory lines
    var topbarheight = 63,
      bottombarheight = 63,
      windowspace = windowheight - Constants.statusBarHeight,
      avaliblespace = windowspace - (topbarheight + bottombarheight), //space avalible for memorydump texts
      lines = Math.floor(avaliblespace / 21);
    //each memory dump height is 22px
    //set avalible lines for memory dump
    this.setState({ lines: lines }, () => {
      //init after lines are set
      this.initHexTable();
      this.initAttempts();
      this.checkmemoryfit();
      this.initAnimationpointer();
      this.initAnimationpointerblink();
    });
  }
  componentWillUnmount() {
    if (this.state.soundLoaded) {
      this.unloadSound();
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (
      (prevState.charcount != this.state.charcount ||
        prevState.reset != this.state.reset) &&
      !this.state.memorydump.length &&
      !this.state.generatedmemorydump &&
      this.state.generatedmemorydump == prevState.generatedmemorydump
    ) {
      this.setState({ generatedmemorydump: true }, () => {
        this.checkmemoryfit();
        this.setState({
          memorydump: this.generateMemeoryDump(this.state.charcount),
          generatedmemorydump: false,
        });
      });
      return;
    }
    if (
      this.state.soundLoaded &&
      this.state.pointerblinkstart &&
      this.state.soundPlaying == prevState.soundPlaying &&
      !this.state.soundPlaying
    ) {
      this.setState({ soundPlaying: true }, () => {
        this.playSound();
      });
      return;
    }
    if (
      this.state.pointeranimationY >= windowheight &&
      this.state.soundPlaying == prevState.soundPlaying &&
      this.state.soundPlaying &&
      this.state.soundLoaded
    ) {
      this.setState({ soundPlaying: false }, () => {
        this.stopSound();
      });
      return;
    }
  }
  async playSound() {
    await this.state.sound.playAsync();
    if (!this.state.soundPlaying) this.setState({ soundPlaying: true });
  }
  async stopSound() {
    await this.state.sound.setPositionAsync(500);
    await this.state.sound.stopAsync();
    if (this.state.soundPlaying) this.setState({ soundPlaying: false });
  }
  async initAnimationpointer() {
    var typingpointerwidth = 12,
      pointermaxwordlength = this.state.pointerendlocations.find(
        (x) => x.y == this.state.pointeranimationY
      ),
      currentlinetextmaxchars =
        typeof pointermaxwordlength != 'undefined'
          ? pointermaxwordlength.width - 12
          : windowwidth,
      lastlinehardcode = 121,
      animationtovalue = currentlinetextmaxchars / windowwidth,
      maxpointerinline = Math.floor(
        currentlinetextmaxchars / typingpointerwidth
      ),
      duforeachline = maxpointerinline * 20; //pointer blink
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
        this.setState(
          { pointeranimationY: this.state.pointeranimationY + 21 },
          () => {
            this.state.pointeranimation.setValue(0);
            this.initAnimationpointer();
          }
        );
      } else if (finished && this.state.pointeranimationY != windowheight) {
        this.setState({ pointeranimationY: windowheight });
      }
    });
  }
  initAnimationpointerblink = () => {
    if (!this.state.pointerblinkstart)
      this.setState({ pointerblinkstart: true });
    this.state.pointeranimationblink.setValue(0);
    Animated.timing(this.state.pointeranimationblink, {
      toValue: 1,
      duration: 20,
      useNativeDriver: Platform.os == 'web' ? true : false,
    }).start((finished) => {
      if (finished && this.state.pointeranimationY <= windowheight) {
        this.initAnimationpointerblink();
      } else if (finished) {
        this.setState({ pointerblinkstart: false });
      }
    });
  };
  //init data
  initHexTable = () => {
    var randomhexstart = Math.random(),
      hextabletmp = [];
    //fake memory hex address
    for (let i = 0; i < this.state.lines; i++) {
      let n = ((randomhexstart + i) * 0xfffff * 1000000).toString(16);
      hextabletmp.push(<HexTableItem key={i} location={n.slice(0, 4)} />);
    }
    this.setState({ hextable: hextabletmp });
  };
  //init remained attempts
  initAttempts = () => {
    var attempts = [];
    //attempts
    for (let i = 0; i < this.state.data.attemptremained; i++) {
      attempts.push(<AttemptItem key={i} />);
    }
    this.setState({ attempts: attempts });
  };
  //calc each line end x locations for animation
  onLayoutPointerlocations = (event, interpolate) => {
    if (this.state.pointerlocationcalced) return;
    const { x, y, width, height } = event.nativeEvent.layout;
    var pointerlocations = this.state.pointerendlocations,
      itemheight = 21,
      locationheight = y + height;
    if (height > 21 && interpolate) {
      for (var liney = y; liney <= locationheight; liney += itemheight) {
        pointerlocations.push({
          y: liney,
          width: width,
        });
        if (liney + itemheight >= locationheight) {
          this.setState({ pointerlocationcalced: true });
        }
      }
    } else {
      pointerlocations.push({
        y: y,
        width: width,
      });
    }
    this.setState({ pointerendlocations: pointerlocations });
  };
  //shufle alg
  durstenfeldShuffle = (array) => {
    for (var i = array.length - 1; i > 0; i--) {
      var rand = Math.floor(Math.random() * (i + 1));
      [array[i], array[rand]] = [array[rand], array[i]];
    }
  };
  //random number between
  randomIntFromInterval = (min, max) => {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  };
  //generate random words
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
    while (bestmatchrating == 0) {
      similartoanwser = stringSimilarity.findBestMatch(answer, wordbylength);
      bestmatchrating = similartoanwser.bestMatch.rating;
      //there is no similar word to answer
      if (similartoanwser.bestMatch.rating == 0) {
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
    return { answer: answer.toUpperCase(), words: wordlist };
  };
  // generate memeory dump
  generateMemeoryDumpserverbased = (length) => {
    var result = [],
      characters = '~!@#$%^&*()_+|}{":;\'/.<>=-`',
      charactersLength = characters.length,
      passwordlength = 0,
      passwords = this.state.data.passwords;

    //rand passwords order
    this.durstenfeldShuffle(passwords);
    //calc password length
    //add passwords
    passwords.map((item, index) => {
      passwordlength += item.value.length;
      result.push(
        <MemorydumpItem
          key={'P' + index}
          onPress={() => this.checkEntry(item.value, false)}
          character={item.value}
          word={item}
        />
      );
    });
    length -= passwordlength;
    //add rest of the characters
    for (let i = 0; i < length; i++) {
      let character = characters.charAt(
        Math.floor(Math.random() * charactersLength)
      );
      result.push(
        <MemorydumpItem
          key={'c' + i}
          onPress={() => this.checkEntry(character, false)}
          character={character}
          word={character}
        />
      );
    }
    //shuffle
    this.durstenfeldShuffle(result);
    // terminal cheats
    var cheatstartchart = ['{', '(', '{'];
    ///now find the word delete them and add each of their words in their locations
    result.map((item, index) => {
      if (item.props.character.length > 1) {
        //replace og word with first letter of that word
        result[index] = (
          <MemorydumpItem
            key={'p' + index}
            onPress={() => this.checkEntry(item.props.character, false)}
            character={item.props.character[0]}
            word={item.props.character}
            wordlocation={index}
          />
        );
        //re add each char after another
        for (let i = 1; i < item.props.character.length; i++) {
          result.splice(
            index + i,
            0,
            <MemorydumpItem
              key={'p' + i}
              onPress={() => this.checkEntry(item.props.character, false)}
              character={item.props.character[i]}
              word={item.props.character}
              wordlocation={index}
            />
          );
        }
      } else if (
        cheatstartchart.indexOf(item.props.character) > -1 &&
        typeof result[index + 1] != 'undefined'
      ) {
        var chars = item.props.character;
        // if there is () or {} or [] reset attempts and remove duds
        // max char include between is 12 char
        for (let i2 = index + 1; i2 < result.length - 1; i2++) {
          chars += result[i2].props.character;
          if (
            ((item.props.character == '{' &&
              result[i2].props.character == '}') ||
              (item.props.character == '(' &&
                result[i2].props.character == ')') ||
              (item.props.character == '[' &&
                result[i2].props.character == ']') ||
              (item.props.character == '<' &&
                result[i2].props.character == '>')) &&
            chars.length <= 12
          ) {
            result[index] = (
              <MemorydumpItem
                key={'c' + index}
                onPress={() => this.checkEntry(chars, true)}
                character={item.props.character}
              />
            );
            result[i2] = (
              <MemorydumpItem
                key={'c' + i2}
                onPress={() => this.checkEntry(chars, true)}
                character={result[i2].props.character}
              />
            );
            break;
          }
        }
      }
    });
    return result;
  };
  generateMemeoryDump = (length) => {
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
    //save answer
    this.setState({
      answer: cryptojS.AES.encrypt(
        pickanswer,
        "Hey, chin up. I know the night just got darker, but it won't last forever"
      ),
    });
    //add passwords
    generateWords.words.map((item, index) => {
      passwordlength += item.length;
      result.push(
        <MemorydumpItem
          key={'w' + index + item}
          onPress={() => this.checkEntry(item, false)}
          character={item}
          word={item}
        />
      );
    });
    length -= passwordlength;
    //add rest of the characters
    for (let i = 0; i < length; i++) {
      let character = characters.charAt(
        Math.floor(Math.random() * charactersLength)
      );
      result.push(
        <MemorydumpItem
          key={'c' + i + character}
          onPress={() => this.checkEntry(character, false)}
          character={character}
          word={character}
        />
      );
    }
    //shuffle
    this.durstenfeldShuffle(result);
    // terminal cheats
    var cheatstartchart = ['{', '(', '{'];
    ///now find the word delete them and add each of their words in their locations
    result.map((item, index) => {
      if (item.props.character.length > 1) {
        //replace og word with first letter of that word
        result[index] = (
          <MemorydumpItem
            key={'w' + index + item.props.character}
            onPress={() => this.checkEntry(item.props.character, false)}
            character={item.props.character[0]}
            word={item.props.character}
            wordlocation={index}
          />
        );
        //re add each char after another
        for (let i = 1; i < item.props.character.length; i++) {
          result.splice(
            index + i,
            0,
            <MemorydumpItem
              key={'w' + i + item.props.character}
              onPress={() => this.checkEntry(item.props.character, false)}
              character={item.props.character[i]}
              word={item.props.character}
              wordlocation={index}
            />
          );
        }
      } else if (
        cheatstartchart.indexOf(item.props.character) > -1 &&
        typeof result[index + 1] != 'undefined'
      ) {
        var chars = item.props.character;
        // if there is () or {} or [] reset attempts and remove duds
        // max char include between is 12 char
        for (let i2 = index + 1; i2 < result.length - 1; i2++) {
          chars += result[i2].props.character;
          if (
            ((item.props.character == '{' &&
              result[i2].props.character == '}') ||
              (item.props.character == '(' &&
                result[i2].props.character == ')') ||
              (item.props.character == '[' &&
                result[i2].props.character == ']') ||
              (item.props.character == '<' &&
                result[i2].props.character == '>')) &&
            chars.length <= 12
          ) {
            result[index] = (
              <MemorydumpItem
                key={item.key}
                onPress={() => this.checkEntry(chars, true)}
                character={item.props.character}
                word={chars}
                wordlocation={[index, i2]}
              />
            );
            result[i2] = (
              <MemorydumpItem
                key={result[i2].key}
                onPress={() => this.checkEntry(chars, true)}
                character={result[i2].props.character}
                word={chars}
                wordlocation={[index, i2]}
              />
            );
            break;
          }
        }
      }
    });
    return result;
  };
  checkmemoryfit = () => {
    var padding = 20,
      hextablewidth = 70,
      width = windowwidth - (hextablewidth + padding),
      maxcharperline = Math.floor(width / 12),
      charcount = maxcharperline * this.state.lines;
    //calc max char that fit in memory view
    this.setState({ charcount: charcount, maxcharperline: maxcharperline });
  };
  checkEntryserverbased = (value, cheat) => {
    //reset attempts and remove dud
    //1 in 5 chance to reset and 4 in 5 to remove a dud once
    if (cheat) {
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
      this.addLog([value, 'attempt reset.']);
      return false;
    }

    if (this.state.data.attemptremained == 0 || this.state.data.answer === true)
      return false;
    //send to fake server for now
    var tempdata = serverPostResponse;
    tempdata.attemptremained -= 1; //fake attempt reduce for test
    //save fake data as new data
    this.setState({ data: tempdata }, () => {
      this.initAttempts();
    });
    if (tempdata.answer == true) {
      this.addLog(['access granted.']);
    } else {
      if (tempdata.attemptremained == 0) {
        //if lockout wait is allowed
        if (serverPostResponse.lockoutwait != -1) {
          this.addLog([
            value,
            'Entry denied.',
            'Likeness=' + serverPostResponse.likeness,
            'initiate lockdown.',
            'wait ' + serverPostResponse.lockoutwait + 'ms.',
          ]);
          // reactive terminal
          setTimeout(() => {
            this.reset();
          }, serverPostResponse.lockoutwait);
        } else {
          //lock out wait is not allowed and user is logout form terminal
          this.addLog([
            value,
            'Entry denied.',
            'Likeness=' + serverPostResponse.likeness,
            'initiate lockdown.',
            'lockdown complete.',
          ]);
        }
      } else {
        //normal entry check
        this.addLog([
          value,
          'Entry denied.',
          'Likeness=' + serverPostResponse.likeness,
        ]);
      }
    }
  };
  checkEntry = (value, cheat) => {
    //finish the animation
    if (this.state.pointeranimationY != windowheight) {
      this.setState({ pointeranimationY: windowheight });
      return false;
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
        this.addLog([value, 'Tries reset.']);
      } else {
        this.removerandomdud(value, true);
        this.addLog([value, 'Dud removed.']);
      }
      return false;
    }
    if (this.state.data.attemptremained == 0 || this.state.data.answer === true)
      return false;
    //send to fake server for now
    var tempdata = serverPostResponse;
    tempdata.attemptremained -= 1; //fake attempt reduce for test
    //save fake data as new data
    this.setState({ data: tempdata }, () => {
      this.initAttempts();
    });
    var likenesss = this.checkLikeness(value);
    if (likenesss == -1) {
      this.addLog(['Password Accepted.', 'Reset Terminal.']);
      // reactive terminal
      setTimeout(() => {
        this.reset();
      }, serverPostResponse.lockoutwait);
    } else {
      if (tempdata.attemptremained == 0) {
        //if lockout wait is allowed
        if (serverPostResponse.lockoutwait != -1) {
          this.addLog([
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
          this.addLog([
            value,
            'Entry denied.',
            'Likeness=' + likenesss,
            'initiate lockdown.',
            'lockdown complete.',
          ]);
        }
      } else {
        //normal entry check
        this.addLog([value, 'Entry denied.', 'Likeness=' + likenesss]);
      }
    }
  };
  checkLikeness = (value) => {
    var stringSimilarity = require('string-similarity'),
      cryptojS = require('crypto-js'),
      bytes = cryptojS.AES.decrypt(
        this.state.answer.toString(),
        "Hey, chin up. I know the night just got darker, but it won't last forever"
      ),
      answer = bytes.toString(cryptojS.enc.Utf8),
      similarity = stringSimilarity.compareTwoStrings(answer, value) * 100,
      maxlikeness = value.length > 1 ? value.length : 4,
      likeness = Math.floor(1 + (similarity / 100) * maxlikeness);
    //likeness bettwen 0 and word length -1
    likeness--;
    return similarity == 100 ? -1 : likeness;
  };
  removerandomdud(cheatword, removedud) {
    var removed = false,
      tmpmemorydump = this.state.memorydump;
    //looking into memory dump
    tmpmemorydump.map((char, index) => {
      //check if word is more than 1 and there is wordlocation and word is not the answer and pick randomly
      var randomchance = this.randomIntFromInterval(0, 1);
      if (
        removedud &&
        char.props.word.length > 1 &&
        typeof char.props.wordlocation != 'undefined' &&
        !Array.isArray(char.props.wordlocation) &&
        char.props.word != this.state.answer &&
        !removed &&
        randomchance == 1
      ) {
        //find last index based on the first word location
        var toindex = char.props.wordlocation + char.props.word.length;
        //loop chars and replace them with .
        for (var i = char.props.wordlocation; i < toindex; i++) {
          if (tmpmemorydump[i].props.word == char.props.word)
            tmpmemorydump[i] = (
              <MemorydumpItem
                key={tmpmemorydump[i].key}
                onPress={() => this.checkEntry('.', false)}
                character={'.'}
                word={'.'}
              />
            );
        }
        removed = true;
      } else if (
        char.props.word == cheatword &&
        Array.isArray(char.props.wordlocation)
      ) {
        //deactive the cheat word
        tmpmemorydump[index] = (
          <MemorydumpItem
            key={char.key}
            onPress={() => this.checkEntry(char.props.word, false)}
            character={char.props.character}
            word={char.props.word}
          />
        );
      }
    });
    this.setState({ memorydump: [] }, () => {
      this.setState({ memorydump: tmpmemorydump });
    });
  }
  addLog = (logs) => {
    this.playSound();
    setTimeout(() => {
      this.stopSound();
    }, 500);
    var logtmp = this.state.entrylog,
      newlogs = [];
    logs.map((item) => {
      newlogs.push({ text: item });
    });
    Array.prototype.push.apply(logtmp, newlogs);
    this.setState({ entrylog: logtmp }, () => {
      this.entrycheckflatlist.current.scrollToEnd({ animated: true });
    });
  };
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
      },
      () => {
        this.initAttempts();
        this.initAnimationpointer();
        this.initAnimationpointerblink();
      }
    );
  };

  renderEntrycheck = (data) => {
    var itemheight = 21;
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
            return <EntrylogItem key={index} value={item.text} />;
          }}
          getItemLayout={(data, index) => ({
            length: itemheight,
            offset: itemheight * index,
            index,
          })}></FlatList>
      </View>
    );
  };
  render() {
    if (this.state.fontsLoaded && this.state.soundLoaded) {
      return (
        <View style={styles.container}>
          <View style={styles.topbar}>
            <Text
              style={[styles.line, styles.consoletext]}
              onLayout={(e) => this.onLayoutPointerlocations(e, false)}>
              Welcome to DIGITALEMAN Termlink
            </Text>
            <Text
              style={[styles.line, styles.consoletext]}
              onLayout={(e) => this.onLayoutPointerlocations(e, false)}>
              Password Required
            </Text>
            <View onLayout={(e) => this.onLayoutPointerlocations(e, true)}>
              <Attempts attempts={this.state.attempts} />
            </View>
          </View>
          <View
            style={styles.console}
            onLayout={(e) => this.onLayoutPointerlocations(e, true)}>
            <MemoryView
              hextable={this.state.hextable}
              lines={this.state.lines}
              memorydump={this.state.memorydump}
              numColumns={this.state.maxcharperline}
            />
          </View>
          {this.renderEntrycheck(this.state.entrylog)}
          <Animated.View
            style={[
              styles.typinganimation,
              {
                transform: [
                  {
                    translateY: this.state.pointeranimationY + 21,
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
    lineHeight: 21,
  },
  consoletext: {
    fontFamily: 'ShareTechMono',
    textAlign: 'left',
    color: '#00FF7F',
    fontSize: 14,
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
    lineHeight: 21,
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
    lineHeight: 21,
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
    height: 21,
    top: 0,
    left: 10,
    backgroundColor: '#010203',
    justifyContent: 'center',
  },
  typingpointer: {
    width: 12,
    height: 12,
    backgroundColor: '#00FF7F',
  },
});

export default App;

if (Platform.OS == 'web')
  serviceWorkerRegistration.register();