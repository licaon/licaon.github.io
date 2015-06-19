'use strict';

angular.module('audioRecordingApp')
  .controller('RecordCtrl', function ($scope, recorder, $timeout) {
    //Generate a graph (https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
    var audioContext = new AudioContext();
    var audioInput = null,
      realAudioInput = null,
      inputPoint = null,
      audioRecorder = null;
    var rafID = null;
    var analyserContext = null;
    var canvasWidth, canvasHeight;
    var recIndex = 0;
    var time = 0;
    $scope.recording = true;


    $scope.init = function () {

      //Check if browser suport  Wep Audio API
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia;
      navigator.cancelAnimationFrame = navigator.cancelAnimationFrame || navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
      navigator.requestAnimationFrame = navigator.requestAnimationFrame || navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

      //Ask for access to microphone (https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia)
      navigator.getUserMedia(
        {
          "audio": {
            "mandatory": {
              "googEchoCancellation": "false",
              "googAutoGainControl": "false",
              "googNoiseSuppression": "false",
              "googHighpassFilter": "false"
            },
            "optional": []
          }
        }, $scope.gotStream, function (e) {
          alert('Error getting audio');
          console.log(e);
        });
    };

    $scope.gotStream = function (stream) {

      inputPoint = audioContext.createGain();

      realAudioInput = audioContext.createMediaStreamSource(stream);
      audioInput = realAudioInput;
      audioInput.connect(inputPoint);


//    audioInput = convertToMono( input );

      $scope.analyserNode = audioContext.createAnalyser();
      $scope.analyserNode.fftSize = 2048;
      inputPoint.connect( $scope.analyserNode );

      audioRecorder = new recorder.Recorder( inputPoint );

      $scope.zeroGain = audioContext.createGain();
      $scope.zeroGain.gain.value = 0.0;
      inputPoint.connect( $scope.zeroGain );
      $scope.zeroGain.connect( audioContext.destination );
    };

    $scope.updateAnalysers = function(state) {
      if (!analyserContext) {
        var canvas = document.getElementById("analyser");
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        analyserContext = canvas.getContext('2d');
      }

      // analyzer draw code here
      {
        var SPACING = 3;
        var BAR_WIDTH = 1;
        var numBars = Math.round(canvasWidth / SPACING);
        var freqByteData = new Uint8Array($scope.analyserNode.frequencyBinCount);

        $scope.analyserNode.getByteFrequencyData(freqByteData);

        analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
        analyserContext.fillStyle = '#F6D565';
        analyserContext.lineCap = 'round';
        var multiplier = $scope.analyserNode.frequencyBinCount / numBars;

        // Draw rectangle for each frequency bin.
        for (var i = 0; i < numBars; ++i) {
          var magnitude = 0;
          var offset = Math.floor( i * multiplier );
          // gotta sum/average the block, or we miss narrow-bandwidth spikes
          for (var j = 0; j< multiplier; j++)
            magnitude += freqByteData[offset + j];
          magnitude = magnitude / multiplier;
          var magnitude2 = freqByteData[i * multiplier];
          analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
          analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
        }
      }

      rafID = window.requestAnimationFrame( $scope.updateAnalysers );
    };

    $scope.cancelAnalyserUpdates = function () {
      window.cancelAnimationFrame( rafID );
      rafID = null;
    };

    $scope.doneEncoding = function( blob ) {
      audioRecorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
      recIndex++;
    };

    $scope.gotBuffers = function( buffers ) {
      var canvas = document.getElementById( "wavedisplay" );
      drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffers[0] );
      audioRecorder.exportMonoWAV( $scope.doneEncoding );
    };

    $scope.beginRecording = function () {
      $scope.recording = !$scope.recording;
      if ($scope.recording) {
        $scope.cancelAnalyserUpdates();
        audioRecorder.stop();
        audioRecorder.getBuffers( $scope.gotBuffers );

      } else {
        time = 0;
        $timeout(updateTime, 100);
        $scope.updateAnalysers();
        audioRecorder.clear();
        audioRecorder.record();
      }
    };

    function convertTime(millseconds) {
      var seconds = Math.floor(millseconds / 1000);
      var days = Math.floor(seconds / 86400);
      var hours = Math.floor((seconds % 86400) / 3600);
      var minutes = Math.floor(((seconds % 86400) % 3600) / 60);
      var timeString = '';
      if(days > 0) timeString += (days > 1) ? (days + " days ") : (days + " day ");
      if(hours > 0) timeString += (hours > 1) ? (hours + " hours ") : (hours + " hour ");
      if(minutes >= 0) timeString += (minutes > 1) ? (minutes + " minutes ") : (minutes + " minute ");
      if(seconds >= 0) timeString += (seconds > 1) ? (seconds + " seconds ") : (minutes + " second ");
      return timeString;
    }

    function updateTime (){
      time += 100;
      $scope.printTime = convertTime(time);
      !$scope.recording && $timeout(updateTime, 100);
    }

    function drawBuffer( width, height, context, data ) {
      var step = Math.ceil( data.length / width );
      var amp = height / 2;
      context.fillStyle = "silver";
      context.clearRect(0,0,width,height);
      for(var i=0; i < width; i++){
        var min = 1.0;
        var max = -1.0;
        for (var j=0; j<step; j++) {
          var datum = data[(i*step)+j];
          if (datum < min)
            min = datum;
          if (datum > max)
            max = datum;
        }
        context.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
      }
    }

    $scope.init();
  });
