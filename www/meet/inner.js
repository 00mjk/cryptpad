// This is the initialization loading the CryptPad libraries
define([
    'jquery',
    '/bower_components/nthen/index.js',
    '/common/sframe-common.js',
    '/common/sframe-app-framework.js',
    '/common/common-util.js',
    '/common/common-hash.js',
    '/common/common-interface.js',
    '/common/modes.js',
    '/customize/messages.js',
    '/bower_components/chainpad-crypto/crypto.js',
    '/bower_components/seiyria-bootstrap-slider/dist/bootstrap-slider.js',
    '/bower_components/tweetnacl/nacl-fast.min.js',
    '/meet/resampler.js',
    'css!/bower_components/seiyria-bootstrap-slider/dist/css/bootstrap-slider.css',
    'less!/meet/app.less'
    /* Here you can add your own javascript or css to load */
], function (
    $,
    nThen,
    SFCommon,
    Framework,
    Util,
    Hash,
    UI,
    Modes,
    Messages,
    Crypto,
    Slider) {

    var Nacl = window.nacl;
    var videoWC;
    var videoEncryptor;
    var counter = 0;
    var videoCodec = 'video/webm; codecs="vp8"';
    var audioCodec = 'audio/webm; codecs="opus"';
    var sampleRate = "auto";
    var options = { "video" : { videoBitsPerSecond : 250000, mimeType : videoCodec }, "audio" : { audioBitsPerSecond : sampleRate, mimeType : audioCodec }}
    var remoteVideo = document.querySelector('#remotevideo');
    var remoteAudio = document.querySelector('#remoteaudio');
    var currentBitRate = 2;
    var maxBitRate = 2;
    var video = document.querySelector('#ownvideo');
    var stream = { "audio" : "", "video" : ""};
    var sendingDropped = { "audio" : 0, "video" : 0};
    var remoteDropped = { "audio" : 0, "video" : 0};
    var stream = { "audio" : "", "video" : ""};
    var lastStats = { "audio" : 0, "video" : 0};
    var mediaSending = false;
    var audioSendQueue = [];
    var videoSendQueue = [];
    var messageSendQueue = [];
    var screenSharingActive = false;
    var packetDuration = 300;
    var sharedDocument = "";
    var sharedDocumentActive = false;
    var isChrome = (navigator.userAgent.search("Firefox")>-1);
    var videoFullScreen = false;
    var debugLevel = 3;

    // audio capture objects
    var audioBufferSize = 2048;
    var audioInputSource;
    var audioGainNode;
    var audioInputProcessor;
    var audioPlayingProcessor;
    var audioMerger;
    var audioInputContext;
    var audioPlayingContext;
    var firstInput = true;
    var firstPlaying = [ true, true, true, true, true, true];

    var users = {}
    window.users = users;
    var availableAudioChannels = [0, 1, 2, 3, 4, 5];
    var status = { "video" : false, "audio" : false};

    var outputResampler = [];
    var inputResampler;
    

    const videoConstraints = {video: { width: 1024, height: 800 } };
    const screenSharingConstraints = { video: { width: 1024, height: 576, mediaSource: 'screen'}};
    const audioConstraints = { audio: { sampleRate: sampleRate } };
    const allConstraints = { audio: { sampleRate: sampleRate }, video: { width: 1024, height: 576 } };
    var maxStatsSize = 10;
    var stats = {};
    const average = arr => arr.reduce((a,b) => a + b, 0) / arr.length
    var qualityValues = [50, 100, 250, 500, 1000, 5000, 10000, 25000, 50000];

    function setDebugLevel(level) {
	debugLevel = level;
    }
    window.setDebugLevel = setDebugLevel;

    function debug(str) {
      if (debugLevel>3)
        console.log(str);
    }

    function info(str) {
      if (debugLevel>2)
	      console.info(str);
    }

    function warning(str) {
      if (debugLevel>1)
	      console.warn(str);
    }

    function error(str) {
      if (debugLevel>0)
	      console.error(str);
    }

    function setBitRate(bitRateId, display) {
      var val = qualityValues[bitRateId];
      if (display)
          $("#quality-bitrate").text("" + val + "kbits/sec");
      options["video"].videoBitsPerSecond = val*1000;
    }

    var waitChange = 0;
    function increaseBitRate() {
        if (waitChange>0) {
           waitChange--;
        } else if (currentBitRate<maxBitRate) {
           currentBitRate++;
           setBitRate(currentBitRate, false);
           warning("INCREASE BIT RATE TO " + qualityValues[currentBitRate] + "kbits/sec")
           waitChange = 20;
        }
    }

    function decreaseBitRate() {
        if (waitChange>0) {
           waitChange--;
        } else if (currentBitRate>0) {
           currentBitRate--;
           setBitRate(currentBitRate, false);
           warning("DECREASE BIT RATE TO " + qualityValues[currentBitRate] + "kbits/sec")
           waitChange = 20;
        }
    }

    /*
     Gathering statistics
    */
    function addStats(id, type, value) {
       var key = id + "-" + type;
       var statsItem = stats[key]
       if (statsItem==null) {
         stats[key] = statsItem = [];
       }
       if (statsItem.length>=maxStatsSize) 
        statsItem.shift()
       statsItem.push(value);
       // Update the stats
       var val = average(statsItem);
       val = Math.floor(val);
       $("#cp-stats-" + key).text("" + val + "ms");
       if (id=="remote")
         lastStats[type] = val;
    }

    function addSendingDropped(type, nb) {
        sendingDropped[type] = sendingDropped[type] + nb;
        $("#cp-dropped-sending-" + type).text(sendingDropped[type])
    }
    function addRemoteDropped(id, type, nb) {
        remoteDropped[type] = remoteDropped[type] + nb;
        $("#cp-dropped-remote-" + type).text(remoteDropped[type])
    }

    function getResampler(sampleRate) {
       var resampler = outputResampler[sampleRate];
       if (resampler)
	    return resampler;

       resampler = new Resampler(sampleRate, audioPlayingContext.sampleRate, 1, audioBufferSize);
       outputResampler[sampleRate] = resampler;
       return resampler;
    }


    /*
      Secret keys for the video channel
      TODO: generate a new secret key or use the secret key of the current pad
    */
    var hash = "/2/meet/edit/6Hwli0F5AsLHzhRenu412SNP/"; // Hash.createRandomHash('meet');
    var secret = Hash.getSecrets('meet', hash);
    secret.keys.signKey = "";

    var lastSampleDate = Date.now();
    var lastAudioReceivedDate = Date.now();
    function launchAudio(framework, cb) {
      info("Initializing audio sub-system");

      // get Audio autorisation so that we can play sound
      // we activate the audio system
      audioInputContext = new window.AudioContext();
      audioPlayingContext = new window.AudioContext();

      silence = new Float32Array(audioBufferSize);
      audioPlayingQueue = {
            buffers: [new Float32Array(0), new Float32Array(0), new Float32Array(0),
                       new Float32Array(0), new Float32Array(0), new Float32Array(0)],

            write: function(newAudio, audioChannel) {
              var buffer = this.buffers[audioChannel];
              debug("Adding new Audio in channel " + audioChannel + " " + newAudio.length)
              var currentQLength = buffer.length;
              var newBuffer = new Float32Array(currentQLength + newAudio.length);
              newBuffer.set(buffer, 0);
              newBuffer.set(newAudio, currentQLength);
              this.buffers[audioChannel] = buffer = newBuffer;
              debug("New length " + buffer.length)
            },

            read: function(nSamples, audioChannel) {
              var buffer = this.buffers[audioChannel];
              var samplesToPlay = buffer.subarray(0, nSamples);
              this.buffers[audioChannel] = buffer = buffer.subarray(nSamples, buffer.length);
             return samplesToPlay;
            },

            length: function(audioChannel) {
              var buffer = this.buffers[audioChannel];
              return buffer.length;
            },

            reset: function(audioChannel) {
              this.buffers[audioChannel] = new Float32Array(0);
            }
        };
      
       navigator.mediaDevices.getUserMedia(allConstraints).then((stream1) => {
          var pdata = framework._.sfCommon.getMetadataMgr().getUserData()
          stream["audio"] = stream1;
          
          info("Audio Input sample rate is " + audioInputContext.sampleRate);
          info("Audio Output sample rate is " + audioPlayingContext.sampleRate);
          audioInputSource = audioInputContext.createMediaStreamSource(stream1);
          audioInputProcessor = audioInputContext.createScriptProcessor(audioBufferSize, 1, 1);
	  audioMerger = audioPlayingContext.createChannelMerger(6);
          audioPlayingProcessor = audioPlayingContext.createScriptProcessor(audioBufferSize, 6, 6);
          inputResampler = (sampleRate=="auto") ? null : new Resampler(audioInputContext.sampleRate, sampleRate, 1, audioBufferSize);

          // this is the audio playing handling
          audioPlayingProcessor.onaudioprocess = function(e) {
	    // debug("in audio playing processor");
            // This part plays audio that is being received
            // If we are too much behind we drop packats to catch up
            for (var audioChannel=0;audioChannel<6;audioChannel++) {
                if (audioPlayingQueue.length(audioChannel)==0) {
                } else if (audioPlayingQueue.length(audioChannel)>audioBufferSize*10) {
                  warning("Sample in buffer too long. Dropping");
                  audioPlayingQueue.reset(audioChannel);
  	 	  var nb = audioPlayingQueue.length(audioChannel)/audioBufferSize;
                  addRemoteDropped(type, nb);
                } else {
                  debug("Playing a sample");
                  var sourceData = audioPlayingQueue.read(audioBufferSize, audioChannel);
                  var newQueueLength = audioPlayingQueue.length(audioChannel);
                  e.outputBuffer.getChannelData(audioChannel).set(sourceData);
                  var sampleDuration = e.outputBuffer.duration;
                  var sampleDate = Date.now();
                  var sampleDelay = sampleDate - lastSampleDate;
                  lastSampleDate = sampleDate;
	          if (firstPlaying[audioChannel])
                    info("Channel " + audioChannel + " Sample size: " + sourceData.length + " duration: " + sampleDuration 
                            + " delay since previous sample: " + sampleDelay + " queue left: " + newQueueLength);
		  else
		    debug("Channel " + audioChannel + " Sample size: " + sourceData.length + " duration: " + sampleDuration 
                            + " delay since previous sample: " + sampleDelay + " queue left: " + newQueueLength);
	          firstPlaying[audioChannel] = false;
                } 
            }
	  }


          // this is the audio recording handling
          audioInputProcessor.onaudioprocess = function(e) {
            // debug("in audio input processor");
            var startTime = lastAudioReceivedDate;
            lastAudioReceivedDate = Date.now();
            var type = "audio";
            // If the audio streaming is active we should send data
            if (status[type]) {
              
              // resampling the audio data to sampleRate
              var sourceData = e.inputBuffer.getChannelData(0);
              var data = (sampleRate=="auto") ? sourceData : inputResampler.resampler(sourceData);
              var mysampleRate = (sampleRate=="auto") ? audioInputContext.sampleRate : sampleRate;
	      if (firstInput)
		    info("Capturing source data duration " + e.inputBuffer.duration + "s (" + sourceData.length + ") resampled to " + mysampleRate + " "  + data.length)
	      else
	   	    debug("Capturing source data duration " + e.inputBuffer.duration + "s (" + sourceData.length + ") resampled to " + mysampleRate + " "  + data.length)
	      firstInput = false;
              var uint8array = new Uint8Array(data.buffer)
              var prepareTime = Date.now();
              var msg = { id: pdata.netfluxId, name: pdata.name, startTime: startTime, prepareTime: prepareTime, type: type, counter: counter++, data: ab2str(uint8array), averageTime: lastStats[type] , sampleRate: mysampleRate };
              if (audioSendQueue.length>5) {
                warning("AUDIO QUEUE TOO FULL. DROPPING 10 Packets")
                msg.dropped = audioSendQueue.length;
                addSendingDropped(msg.type, audioSendQueue.length);
                audioSendQueue = [];
              }
             audioSendQueue.push(msg);
             emptyQueue();
            }
          };

          audioInputSource.connect(audioInputProcessor);
          audioInputProcessor.connect(audioInputContext.destination);

          audioPlayingProcessor.connect(audioMerger);
	  audioPlayingContext.destination.channelCount = 1;
          audioMerger.connect(audioPlayingContext.destination, 0, 0);
          cb();
        });  
      }
    
    function getNextAudioChannel(user) {
      info("Current available Channels " + availableAudioChannels.length)
      debug(availableAudioChannels)
      var id = availableAudioChannels.shift();
      if (id!=null) {
        warning("Attributed audio channel " + id + " to " + user.name + " " + user.id)
	firstPlaying[id] = true;
        return id;
      } else {
        error("ERROR: no more audio channels available");
      }
      return null;
    }
    
    function dropAudioChannel(user) {
      info("Giving back audioChannel " + user.audioChannel);
      availableAudioChannels.push(user.audioChannel);
    }
    
    /*
      Display user name on own video
    */
    function updateUserName() {
      var pdata = framework._.sfCommon.getMetadataMgr().getUserData()
      $("#cp-app-meet-own-name").text(pdata.name + " (me)");
    }
    
    /*
     Setup a new remote user
    */
    function checkRemoteUser(clientId, name, cb) {
      if ((clientId==null) || (clientId==""))
	  cb(null);

      var user = users[clientId];
      if (!user) {
       debug("Creating user " + clientId);
       users[clientId] = user = {};
       user.id = clientId;
       user.name = (name=="") ? clientId : name;
       window.videoUser = user;
      }
 
      if (!user.audioChannel)
         user.audioChannel = getNextAudioChannel(user);
      user.lastSeen = Date.now();
      if (!user.remoteUserDoc) {
        var html = "<div id='cp-app-meet-REMOTEUSER' class='cp-app-meet-video col-sm-6'> \
                            <div id='cp-app-meet-video-REMOTEUSER' class='cp-app-meet-video-element'> \
                                <div class='cp-app-remote-stats'> \
                                    <span id='cp-app-meet-REMOTEUSER-name' class='cp-app-meet-remote-name'></span> \
                                    <span id='cp-stats-REMOTEUSER-video' class='cp-app-stats-item'></span> \
                                    <span id='cp-stats-REMOTEUSER-audio' class='cp-app-stats-item'></span> \
                                    <span id='cp-stats-REMOTEUSER-receive-video' class='cp-app-stats-item'></span> \
                                    <span id='cp-stats-REMOTEUSER-receive-audio' class='cp-app-stats-item'></span> \
                                    <span id='cp-kbits-REMOTEUSER-video' class='cp-app-stats-item'></span> \
                                    <span id='cp-kbits-REMOTEUSER-audio' class='cp-app-stats-item'></span> \
                                    <span id='cp-dropped-REMOTEUSER-video' class='cp-app-stats-item'></span> \
                                    <span id='cp-dropped-REMOTEUSER-audio' class='cp-app-stats-item'></span> \
                                </div> \
                                <video id='REMOTEUSERvideo' class='remotevideo' width='1000' height='800' autoplay></video> \
                            </div> \
                </div>";
        var remoteUserHTML = html.replace(/REMOTEUSER/g, "remote" + clientId);
        debug("Inserting HTML")
        $(remoteUserHTML).insertAfter($("#cp-app-meet-own"));
        $("#cp-app-meet-remote" + clientId+ "-name").text(user.name);
        user.remoteUserDoc = $("#cp-app-meet-remote" + clientId); 
        // resize videos
        setVideoWidth();
        if (videoFullScreen)
	    user.remoteUserDoc.hide();
        user.remoteVideo = document.querySelector('#remote' + clientId + 'video');

        // Adding full-screen handler
        $(user.remoteVideo).click(function(e) {
            debug("Remote video CLICK")
            var el = $(this).parent().parent();
            if ($(el).hasClass("meet-fullscreen")) {
               videoFullScreen = false;
               $(el).removeClass("meet-fullscreen")
               $(el).addClass("col-sm-6")
               $(".cp-app-meet-video").show()
               if (sharedDocumentActive)
                $(".cp-app-meet-document").show()
            } else {
               videoFullScreen = true;
               $(el).addClass("meet-fullscreen")
               $(".cp-app-meet-video").hide()
               $(".cp-app-meet-document").hide()
               $(el).addClass("col-sm-12")
               $(el).show();
               $(".cp-app-meet-video-element").width("85%");
            }
            setVideoWidth();
        });
      }
 
      if (!user.mediaSource) {
        var mediaSource = new MediaSource();
        user.mediaSource = mediaSource;
	user.currentTime = 0;
	user.freezedBlocks = 0;
        mediaSource.addEventListener('error', function (e) {
          error("MEDIASOURCE ERROR", e)
        }, false);
        mediaSource.addEventListener('sourceopen', function() { 
          info("Remote video source open for user " + clientId)
        
          try {
            user.videoSourceBuffer = mediaSource.addSourceBuffer(videoCodec);
            user.videoSourceBuffer.mode = "sequence";
            user.videoSourceBuffer.onerror = function(e) {
		error("Error in video source buffer");
		error(e);
	    };
            user.videoSourceBuffer.onabort = function(e) {
		error("Abort in video source buffer");
		error(e);
	    };
            user.videoSourceBuffer.onupdatestart = function(e) {
		debug("Update start");
	    };
            user.videoSourceBuffer.onupdate = function(e) {
		debug("Update");
	    };
            user.videoSourceBuffer.onupdateend = function(e) {
		debug("Update end");
	    };
          } catch (e) {
            error("Error initing video stream for " + user.id);
          }
          cb(user);
        }, false);
	user.remoteVideo.src = window.URL.createObjectURL(mediaSource);
      } else {
        cb(user);
      }
      debug(user);
    }

       /*
     Setup a new remote user
    */
    function dropRemoteUser(clientId, accountName, cb) {

      if (!audioPlayingContext)
        return;

      var user = users[clientId];
      if (user) {
        // free the audio channel
        try {
        dropAudioChannel(user);
        } catch (e) {
          error("Error dropping audio channel", e)
        }
	dropVideoChannel(user)
        try {
          $("#cp-app-meet-remote" + clientId).remove();
        } catch (e) {
          error("Error removing HTML element", e)
        }
      } else {
	  info("Could not find user " + clientId);
      }
      // removing user from the array
      users[clientId] = null;
      setVideoWidth();
    }

	      
    function dropVideoChannel(user, removeSrc) {
        // free video elements
        try {
          if (user.videoSourceBuffer)
            user.mediaSource.removeSourceBuffer(user.videoSourceBuffer);
        } catch (e) {
          error("Error removing source buffer", e)
        }
        try {
            user.mediaSource.endOfStream();
        } catch (e) {
          error("Error calling endOfStream", e)
        }

        try {
          if (removeSrc)
            user.remoteVideo.src = null;
        } catch (e) {
          error("Error removing source from video", e)
        }
	user.videoSourceBuffer = null;
	user.mediaSource = null;
    }

    /*
      Recoding and transmission
    */
    var record = (stream, options, ms) => {
      var rec = new MediaRecorder(stream, options), data = [];
      rec.ondataavailable = e => data.push(e.data);
      rec.start();
      log(rec.state + " for "+ (ms / 1000) +" seconds.");
      var stopped = new Promise((r, e) => (rec.onstop = r, rec.onerror = e));
      return Promise.all([stopped, wait(ms).then(() => rec.stop())])
      .then(() => { return data });
    };

    var stop = stream => stream.getTracks().forEach(track => track.stop());
    var wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    var log = msg => debug(msg);
    var failed = e => log(e.name +", line "+ e.lineNumber);

    function ab2str(buf) {
      return Nacl.util.encodeBase64(buf);
    }
    function str2ab(str) {
      return Nacl.util.decodeBase64(str);
    }

    function sendMessage(msg) {
        mediaSending = false;
        var startTime = msg.startTime;
        var cmsg = Crypto.encrypt(JSON.stringify(msg), secret.keys.cryptKey)
        videoWC.bcast(cmsg).then(function () {
                    mediaSending = false;
                    var sendTime = Date.now();
                    var duration = sendTime - startTime;
                    addStats("sending", msg.type, duration);
                    msg.sendTime = sendTime;
                    debug("Sending " + msg.type + " done " + msg.counter + " time: " + duration + "ms");
                    // onsole.log(msg)
                    if (msg.type=="video") {
                      if (duration>2000) {
                          decreaseBitRate();
                      } else if (duration<600) {
                          increaseBitRate();
                      }
                    }
                    if (mediaSending)
                      addSendingDelayed(msg.type);
                    else
                      emptyQueue();
        }, function (err) {
                    error("Error sending message");
                    mediaSending = false;
                    emptyVideoQueue();
        }); 
    }

    function emptyQueue() {
        if (audioSendQueue.length==0 && videoSendQueue.length==0 && messageSendQueue.length==0)
          return;
        if (mediaSending) {
          info("Sending channel not ready. Waiting");
          return;
        }
        if (audioSendQueue.length>0) {
          var msg = audioSendQueue.shift();
          sendMessage(msg);
        } else if (videoSendQueue.length>0) {
          var msg = videoSendQueue.shift();
          sendMessage(msg);
        } else if (messageSendQueue.length>0) {
          var msg = messageSendQueue.shift();
          sendMessage(msg);
	}
    }

    function sendStream(stream, type) {        
        var startTime = Date.now();
        record(stream, options[type], packetDuration).then(recording => {
          var prepareTime = Date.now();
          var duration = prepareTime - startTime;       

          // stop(stream);
          var fr = new FileReader();
          var arrayBuffer;
           fr.onload = function(event) {
             var uint8Array = new Uint8Array(event.target.result);
             var pdata = framework._.sfCommon.getMetadataMgr().getUserData()
             var msg = { id: pdata.netfluxId, name: pdata.name, startTime: startTime, prepareTime: prepareTime, type: type, counter: counter, data: ab2str(uint8Array), averageTime: lastStats[type] }
             var kbit = Math.floor((uint8Array.length / 1024)*8*1000/duration);
             $("#cp-kbits-sending-" + type).text("" + kbit + "kbits/sec")
             if (msg.type=="video") {
                if (videoSendQueue.length>5) {
                    error("VIDEO QUEUE TOO FULL. DROPPING 5 Packets")
                    decreaseBitRate();
                    addSendingDropped(msg.type, videoSendQueue.length);
                    msg.dropped = videoSendQueue.length;
                    addSendingDropped(msg.type, audioSendQueue.length);
                    videoSendQueue = [];
                }
                videoSendQueue.push(msg);
                if (!status[type]) {
                  messageSendQueue.push({ id: pdata.netfluxId, name: pdata.name, startTime: 0, prepareTime: 0, type: "message", action : "stopvideo" });
                }
             }
             if (msg.type=="audio") {
                if (audioSendQueue.length>10) {
                    error("AUDIO QUEUE TOO FULL. DROPPING 10 Packets")
                    msg.dropped = audioSendQueue.length;
                    addSendingDropped(msg.type, audioSendQueue.length);
                    audioSendQueue = [];
                }
                audioSendQueue.push(msg);
             }
             emptyQueue();
             };
           fr.readAsArrayBuffer(recording[0]);
           if (status[type])
              sendStream(stream, type);
        })
    }

    function countUsers(users) {
      var count = 0;

      for(var prop in users) {
          if(users.hasOwnProperty(prop)&&users[prop]!=null)
              ++count;
      }

      return count;
    }

    function setVideoWidth() {
      if (videoFullScreen)
        return;

      var screenWidth = $("#cp-app-meet-container-row").width();
      var screenHeight = $("body").height() - 160;
      var nbVideos = countUsers(users) + 1;
      if (sharedDocumentActive)
        nbVideos += 1;

      if (!screenWidth || !screenHeight || !nbVideos)
        return 0;
      
      debug("W: " + screenWidth + " H: " + screenHeight + " nbvideos: " + nbVideos);
      var baseRatio = 1
      var ratio = screenWidth/screenHeight;
      var maxWidth = 0;
      var nbCols = 1;
      for (var rows=1;rows<10;rows++) {
        var cols = Math.ceil(nbVideos / rows);
        var w;
        var r = ratio * rows / cols
        if (r<baseRatio)
          w = screenWidth / cols
        else
          w = baseRatio * (screenHeight / rows)
        if (w>maxWidth) {
           maxWidth = w
           nbCols = cols;
        }
        debug("Rows: " + rows + " Cols: " + cols + " Ratio: " + r + " width: " + w);
      }
      debug("Max Width: " + maxWidth);
      var w = Math.floor(maxWidth);
      var h = Math.floor(maxWidth / baseRatio);
      if (w>0) {
        $(".cp-app-meet-video-element, .cp-app-meet-document-element").width(w);
        $(".cp-app-meet-document-element").height(h);
        var nb = 12/nbCols;
        var classes = "col-sm-" + nb;
        debug("Set class: " + classes);
        $(".cp-app-meet-video, .cp-app-meet-document").removeClass("col-sm-12");
        $(".cp-app-meet-video, .cp-app-meet-document").removeClass("col-sm-6");
        $(".cp-app-meet-video, .cp-app-meet-document").removeClass("col-sm-4");
        $(".cp-app-meet-video, .cp-app-meet-document").removeClass("col-sm-3");
        $(".cp-app-meet-video, .cp-app-meet-document").removeClass("col-sm-2");
        $(".cp-app-meet-video, .cp-app-meet-document").addClass(classes);
      }
    }

  
    window.setVideoWidth = setVideoWidth;

    $( window ).resize(function() {
        debug("Window resize");
        setVideoWidth();
    });

    function stopStream(type, screenSharing) {
      var stream1 = stream[type]
      debug('Testing ' + stream1.screenSharing + "," + screenSharing)
      if (stream1 && stream1.screenSharing==screenSharing) {
        debug("Stopping stream");
        stream1.getTracks().forEach(function(track) {
          track.stop();
        });
        status[type] = false;
      }
    }


    function launchVideo(screenSharing) {
      
      var type = "video";
      var constraints = (screenSharing==true) ? screenSharingConstraints : videoConstraints
      stopStream(type, !screenSharing);
      if (screenSharing) {
          $("#cp-app-meet-camera").removeClass("cp-app-meet-camera-on")
          $("#cp-app-meet-camera").addClass("cp-app-meet-camera-off")
      } else {
          $("#cp-app-meet-screen").removeClass("cp-app-meet-screen-on")
          $("#cp-app-meet-screen").addClass("cp-app-meet-screen-off")        
      }

      if (status[type]==false) { 
            var media;
            try {
              media = navigator.mediaDevices.getUserMedia(constraints);
            } catch(e) {
              error(e);
            }
            media.then((stream1) => {
                stream1.screenSharing = screenSharing;
                if (screenSharing) {
                  $("#cp-app-meet-screen").removeClass("cp-app-meet-screen-off")
                  $("#cp-app-meet-screen").addClass("cp-app-meet-screen-on")
                } else {
                  $("#cp-app-meet-camera").removeClass("cp-app-meet-camera-off")
                  $("#cp-app-meet-camera").addClass("cp-app-meet-camera-on")
                }
                status[type] = true;
                video.srcObject = stream1;
                stream[type] = stream1;
                sendStream(stream1, type);
            });
       } else {
         stopStream(type, screenSharing);
         if (screenSharing) {
          $("#cp-app-meet-screen").removeClass("cp-app-meet-screen-on")
          $("#cp-app-meet-screen").addClass("cp-app-meet-screen-off")
         } else {
          $("#cp-app-meet-camera").removeClass("cp-app-meet-camera-on")
          $("#cp-app-meet-camera").addClass("cp-app-meet-camera-off")
        }
        status[type] = false;
       }
    } 

    function initButtons() {

      /*
        Managing Video Quality Bitrate
      */
      $("#quality-bitrate").text("" + Math.floor(options["video"].videoBitsPerSecond/1000) + "kbits/sec")
      $("#quality").slider({
        id: "quality",
        value: maxBitRate,
        min: 0,
        max: 8,
        formatter: function(value) {
          return "" + value + "kbits/sec";
        }   
      }).on('change', function(event) {
        debug("Slider value: " + event.value.newValue);
        maxBitRate = event.value.newValue;
        currentBitRate = maxBitRate;
        setBitRate(maxBitRate, true);
      });

      /*
        Handling buttons
      */
      $("#cp-app-meet-camera").click(function() {
        // make sure the audio sub-system is launched
        // because of chrome we can't launch it right away
        launchVideo(false);
      });

      $("#cp-app-meet-screen").click(function() {
          launchVideo(true);
      });

      $("#cp-app-meet-microphone").click(function() {
        // make sure the audio sub-system is launched
        // because of chrome we can't launch it right away
        
         var type = "audio";
         if (status[type]==false) { 
             $("#cp-app-meet-microphone").removeClass("cp-app-meet-microphone-off")
             $("#cp-app-meet-microphone").addClass("cp-app-meet-microphone-on")
             status[type] = true;
             /*
             navigator.mediaDevices.getUserMedia(audioConstraints).
                then((stream1) => {
                  // connect the receiver part
                  // audioSourceBuffer.connect(scriptPlayingNode);
                  // scriptPlayingNode.connect(audioContext.destination);
                  //try { audioSourceBuffer.start(); } catch (e) {}
                  // audioContext = new window.AudioContext()


                  $("#cp-app-meet-microphone").removeClass("cp-app-meet-microphone-off")
                  $("#cp-app-meet-microphone").addClass("cp-app-meet-microphone-on")
                  status[type] = true;
              });
	      */
         } else {
            $("#cp-app-meet-microphone").removeClass("cp-app-meet-microphone-on")
            $("#cp-app-meet-microphone").addClass("cp-app-meet-microphone-off")
            status[type] = false;
         }
      });

      $("#cp-app-meet-docbutton").click(function() {
          if (sharedDocumentActive) {
            $("#cp-app-meet-document").hide();
            sharedDocumentActive = false;
            setVideoWidth();
          } else {
            // UI.prompt(Messages.shareDocumentChooseUrl, sharedDocument, function (src) {
            UI.prompt(sharedDocument, sharedDocument, function (src) {
                insertSharedDoc(src);
          });
         }
      });

      /*
        Managing full screen video display
      */
      $(".cp-app-meet-document-button").click(function() {
           debug("Document click")
           if ($("#cp-app-meet-document").hasClass("meet-fullscreen")) {
             videoFullScreen = false;
             $("#cp-app-meet-document").removeClass("meet-fullscreen")
             $(".cp-app-meet-video").show()
             if (sharedDocumentActive)
              $(".cp-app-meet-document").show()
             $("#cp-app-meet-document").width("auto");
             $("#cp-app-meet-document").height("auto");
          } else {
             videoFullScreen = true;
             $("#cp-app-meet-document").addClass("meet-fullscreen")
             $(".cp-app-meet-video").hide()
             $(".cp-app-meet-document").hide()
             $(".cp-app-meet-document").addClass("col-sm-12")
             $(".cp-app-meet-document").show();
             $("#cp-app-meet-document").width("85%");
             $("#cp-app-meet-document").height("85%");
             $("#cp-app-meet-document-element").width("85%");
             $("#cp-app-meet-document-element").height("85%");
          }
          setVideoWidth();
      });


      $("#ownvideo").click(function() {
            debug("Own video CLICK")
            var el = $(this).parent().parent();
            if ($(el).hasClass("meet-fullscreen")) {
               videoFullScreen = false;
               $(el).removeClass("meet-fullscreen")
               $(".cp-app-meet-video").show()
               if (sharedDocumentActive)
                 $(".cp-app-meet-document").show()
            } else {
               videoFullScreen = true;
               $(el).addClass("meet-fullscreen")
               $(".cp-app-meet-video").hide()
               $(".cp-app-meet-document").hide()
               $(el).addClass("col-sm-12")
               $(el).show();
               $(".cp-app-meet-video-element").width("85%");
           }
           setVideoWidth();
      });
    }

    function insertSharedDoc(src) {
        activateSharedDoc(src);
         
         // Informing other users that the document has been inserted
         messageSendQueue.push({ id: "", name: "", startTime: 0, prepareTime: 0, type: "message", action : "showshareddoc" , url: src});
         emptyQueue();

         // Adding document to permanently shared doc
         addToSharedDocuments(src);
    }

    function activateSharedDoc(src) {
      info("Activating shared document");
      if (src && src!="" && src != $("#cp-app-meet-document-iframe")[0].src) {
        $("#cp-app-meet-document-iframe")[0].src = ""; 
        $("#cp-app-meet-document-iframe")[0].src = src;	
      }
      $("#cp-app-meet-document").show();
	    sharedDocumentActive = true;
	    setVideoWidth();
    }

    function addToSharedDocuments(src) {
      var metadataMgr = framework._.cpNfInner.metadataMgr;
      var metadata = metadataMgr.getMetadata();
      var metadata2 = JSON.parse(JSON.stringify(metadataMgr.getMetadata()));
      if (!metadata2.sharedDocuments) {
   	    metadata2.sharedDocuments = [];
	    }
      metadata2.sharedDocuments.push(src);
      metadataMgr.updateMetadata(metadata2)
      framework.localChange();
    }

    function startVideoConf(framework) {

        $("#cp-meet-start").hide();
        $("#cp-app-meet-container").show();
        launchAudio(framework, function() {
        
        /*
          Manager connecting to Video WebSocket and receiving data
        */
        require([
            '/bower_components/netflux-websocket/netflux-client.js',
            '/common/outer/network-config.js'
        ], function (Netflux, NetConfig) {
            var wsUrl = "wss://meet-alpha.cryptpad.fr/cryptpad_websocket"; 
            // wsUrl = NetConfig.getWebsocketURL();
            wsUrl = "ws://localhost:3000/cryptpad_websocket";
            // wsUrl = "wss://cryptpad.dubost.name/cryptpad_websocket";
            info("Connecting to video channel " + wsUrl);
            Netflux.connect(wsUrl).then(function (network) {
                var privateData = framework._.sfCommon.getMetadataMgr().getPrivateData();
                updateUserName(framework);

                network.join(privateData.channel + "01").then(function (wc) {
                    info("Connected to video channel")
                    videoWC = wc;

                    updateUsers();

                    wc.on('message', function (cryptMsg) {
                        debug("Receiving encrypted data");
                        // debug("Receiving encrypted data ", cryptMsg);
                        // var msg = videoEncryptor.decrypt(cryptMsg, null, true);
                        // debug("Decrypting with key: " + secret.keys.cryptKey);
                        var msg = Crypto.decrypt(cryptMsg, secret.keys.cryptKey);
                        // debug("Receiving message ", msg);
                        var parsed;
                        try {
                            parsed = JSON.parse(msg);
                            if (parsed) {
                                checkRemoteUser(parsed.id, parsed.name, function(user) {

                                try {
                                    if (parsed.type=="message") {
					info("Received message " + parsed.action);
                                        if (parsed.action==="stopvideo") {
					        dropVideoChannel(user, true);	
						try { user.remoteVideo.load(); } catch (e) {};
                                        }
					if (parsed.action==="showshareddoc") {
				    	   activateSharedDoc(parsed.url);
					}
                                        /*
                                        if (parsed.action=="join") {
                                            videoSendQueue.push({ id: privateData.clientId, name: privateData.accountName, startTime: 0, prepareTime: 0, type: "message", action : "ping" });
                                            emptyQueue();
                                        }*/
                                      // special message
                                    } else {
                                      if (parsed.dropped) {
                                            addRemoteDropped(parsed.id, parsed.type, parsed.dropped);
                                      }

                                      var uint8Array = str2ab(parsed.data);
                                      
                                      if (parsed.type=="video") {
                                        var doneTime = Date.now();
                                        var doneDuration = doneTime - parsed.startTime;
                                        var delay = 0;
                                        if (delay>0)
					    debug("Delaying video by " + delay + "ms")
                                        // window.setTimeout(function() {
					   if (true) { // user.videoSourceBuffer && !user.videoSourceBuffer.updating) { 
                                            debug("Video sourcebuffer appending for user " + parsed.id)
                                            if (1==1) {
						var maxLag = (isChrome) ? 3 : 10;
						if (user.currentTime==user.remoteVideo.currentTime) {
							if (user.currentTime!=0) {
								user.freezedBlocks += 1;
								warning("Video has not advanced ", user.freezedBlocks);
							}
						}
						user.currentTime = user.remoteVideo.currentTime;
						if (user.freezedBlocks > maxLag) {
							warning("Video frozen - resetting playing stream " + user.freezedBlocks);
							dropVideoChannel(user, false);
							checkRemoteUser(parsed.id, parsed.name, function(user) {
								user.videoSourceBuffer.appendBuffer(uint8Array);
								user.currentTime += packetDuration / 1000;
							});
						} else {
						  user.videoSourceBuffer.appendBuffer(uint8Array);
						  user.currentTime += packetDuration / 1000;
						}
					    } else {
						var thisBlob = new Blob([uint8Array],{type:"video/webm"});
					        var url = URL.createObjectURL(thisBlob);
					        user.remoteVideo.src = url;
				                user.remoteVideo.currentTime = 0;
					    }
				 	    try { user.remoteVideo.play(); } catch (e) {};
                                            var videoDisplayDoneTime = Date.now();
                                            var duration = videoDisplayDoneTime - parsed.startTime;
                                            addStats("remote" + parsed.id, "video", duration);
                                            var name = (parsed.name=="") ? parsed.id : parsed.name;
                                            $("#cp-app-meet-remote" + parsed.id + "-name").text(name);
                                            $("#cp-stats-remote" + parsed.id + "-receive-video").text("" + parsed.averageTime+ "ms");
                                            var kbit = Math.floor((uint8Array.length / 1024)*1000*8/packetDuration);
                                            $("#cp-kbits-remote" + parsed.id + "-video").text("" + kbit + "kbits/sec")
                                            debug("Video sourcebuffer for user " + parsed.id + " appending done: " + duration + "ms")
                                          } else {
                                           error("VIDEO SOURCE BUFFER IS BUSY FOR USER " + parsed.id)
                                           addRemoteDropped(parsed.id, parsed.type, 1);
                                          }
                                       // }, delay);
                                      }

                                      if (parsed.type=="audio") {
                                          debug("Audio SourceBuffer appending")

                                          if (!audioInputContext) {
                                            info("AudioContext is not ready for receiving data");
                                           return;
                                          }
                                          
                                          debug(parsed.counter);
                                          var dView1 = new DataView(uint8Array.buffer)
                                          var audioData  = new Float32Array(uint8Array.length / 4);
                                          var p = 0;
                                          for(var j=0; j < audioData.length; j++){
                                              p = j * 4;
                                              audioData[j] = dView1.getFloat32(p,true);
                                          }
                                          
                                          // debug(audioData);
                                          // we need to resampler before adding to the playing queue
                                          var resampler = getResampler(parsed.sampleRate);
			                  if (!resampler) {
                                              info("Audio context is not yet ready")
                                          } else {
                                              var data = resampler.resampler(audioData);
                                              if (user.audioChannel!=null)
                                                 audioPlayingQueue.write(data, user.audioChannel)
                                              else 
                                                 error("No audio channel for this user " + user.id)
                                              var audioDoneTime = Date.now();
                                              var duration = audioDoneTime - parsed.startTime;
                                              addStats("remote", "audio", duration);
                                              $("#cp-app-meet-remote-name").text(parsed.name);
                                              $("#cp-stats-remote-receive-audio").text("" + parsed.averageTime+ "ms");
                                              var kbit = Math.floor((uint8Array.length / 1024)*1000/packetDuration);
                                              $("#cp-kbits-remote-audio").text("" + kbit + "kbits/sec")
                                              debug("Audio SourceBuffer for package " + parsed.counter + " appending done: " + duration + "ms")
                                          }
                                        }
                                      }
                                  } catch (e) { error(e); }
                                });
                            }
                        } catch (e) { error(e); }
                    });
                }, function (err) {
                  error("Failed opening video channel")
                });
            }, function (err) {
                error("Could not get network")
            });
        });
      });
    }

    function updateUsers() {
            var userId = framework._.sfCommon.getMetadataMgr().getUserData().netfluxId;
            var cpUsers =  framework._.sfCommon.getMetadataMgr().getMetadata().users;
            debug("Check user start");
            for (user in cpUsers) {
              if (userId != user) {
                var userData = cpUsers[user];
                info("Adding user " + user + " " + userData.name);
                checkRemoteUser(user, userData.name, function(user) {});
              }
            }
            for (videoUser in users) {
              if (!cpUsers[videoUser]) {
                info("Could not find user " + videoUser + " dropping it")
                dropRemoteUser(videoUser)
              }
            }
            debug("Check user end");

            var sharedDocs = framework._.sfCommon.getMetadataMgr().getMetadata().sharedDocuments;
	    if (sharedDocs) {
               var sharedDoc = sharedDocs[sharedDocs.length-1];
	       if (!sharedDoc || sharedDoc==sharedDocument) {
		       // it's the same shared doc, return
	       } else {
		  activateSharedDoc(sharedDoc);
	       }
	    }	
    }

    function updateFilePicker(framework) {
            var common = framework._.sfCommon;
            var privateDat = framework._.cpNfInner.metadataMgr.getPrivateData();
            var origin = privateDat.fileHost || privateDat.origin;

            common.initFilePicker({
                onSelect: function (data) {
                  var url = origin + data.href + "/embed/";
                  if (data.type=="slide")
                    url += "present/"
                  info("Embedding url " + url)
                  insertSharedDoc(url);
                }
            });
            
            $embedButton = common.createButton('mediatag', true).click(function () {
                common.openFilePicker({
                    types: ["pad", "slide", "sheet", "whiteboard", "code", "ooslide", "oodoc", "kanban", "poll"],
                    where: ['root']
                });
            });

            framework._.toolbar.$rightside.append($embedButton);
    };
    
    // Prepare buttons
    initButtons();

    // This creates a delayed start of the Video Conferencing
    $("#cp-meet-start").click(function() { 
      updateFilePicker(framework)
      startVideoConf(framework) 
    });

    // This is the main initialization loop
    var andThen2 = function (framework) {
        var common = framework._.sfCommon;
        var privateData = common.getMetadataMgr().getPrivateData();
        
        // Here you can load the objects or call the functions you have defined

        // This is the function from which you will receive updates from CryptPad
        // In this example we update the textarea with the data received
        framework.onContentUpdate(function (newContent) {
            // debug("Content should be updated to " + newContent);
            // $("#cp-app-meet-content").val(newContent.content);
        });

        // This is the function called to get the current state of the data in your app
        // Here we read the data from the textarea and put it in a javascript object
        framework.setContentGetter(function () {
            return {
              content: ""
            };
            /*
            var content = $("#cp-app-meet-content").val();
            debug("Content current value is " + content);
            return {
                content: content
            };
            */
        });

        // This is called when the system is ready to start editing
        // We focus the textarea
        framework.onReady(function (newPad) {
            $("body").focus();
            
            /*
            var fmConfig = {
                dropArea: $('body'),
                body: $('body'),
                onUploaded: function (ev, data) {
                    var parsed = Hash.parsePadUrl(data.url);
                    var secret = Hash.getSecrets('file', parsed.hash, data.password);
                    var fileHost = privateData.fileHost || privateData.origin;
                    var src = fileHost + Hash.getBlobPathFromHex(secret.channel);
                    var key = Hash.encodeBase64(secret.keys.cryptKey);
                    debug(data.url);
                    // var mt = '<media-tag src="' + src + '" data-crypto-key="cryptpad:' + key + '"></media-tag>';
                    // editor.replaceSelection(mt);

                }
            };
            common.createFileManager(fmConfig);
            */

            $(".cp-toolbar-icon-mediatag").remove();
        });


        framework.setMediaTagEmbedder(function (mt) {
             debug("Received media-tag");
             debug(mt);
        });

        framework._.sfCommon.getSframeChannel().on('EV_RT_JOIN', function (ev) {
           if (audioPlayingContext)
            checkRemoteUser(ev, "", function(user) {});
        });

       framework._.sfCommon.getSframeChannel().on('EV_RT_LEAVE', function (ev) {
           if (audioPlayingContext)
            dropRemoteUser(ev);
        });

       framework._.sfCommon.getMetadataMgr().onChange(updateUsers);

        // We add some code to our application to be informed of changes from the textarea
        var oldVal = "";
        $("#cp-app-meet-content").on("change keyup paste", function () {
            var currentVal = $(this).val();
            if (currentVal === oldVal) {
                return; //check to prevent multiple simultaneous triggers
            }
            oldVal = currentVal;
            // action to be performed on textarea changed
            debug("Content changed");
            // we call back the cryptpad framework to inform data has changes
            framework.localChange();
        });

        // starting the CryptPad framework
        window.framework = framework;
        framework.start();
    };

    // This is the main starting loop
    var main = function () {
        var framework;

        nThen(function (waitFor) {

            // Framework initialization
            Framework.create({
                toolbarContainer: '#cme_toolbox',
                contentContainer: '#cp-app-meet-editor'
            }, waitFor(function (fw) {
                framework = fw;
                andThen2(framework);
            }));
        });
    };
    main();
});
