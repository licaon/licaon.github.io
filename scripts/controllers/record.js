var recorderApp = angular.module('recorder', []);

recorderApp
  .config([
    '$compileProvider',
    function ($compileProvider) {
      $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|data):/);
    }
  ]);

recorderApp.controller('RecorderController', ['$scope', '$sce', '$timeout', function ($scope, $sce, $timeout) {
  $scope.trustSrc = function (src) {
    return $sce.trustAsResourceUrl(src);
  };
  $scope.stream = null;
  $scope.recording = false;
  $scope.encoder = null;
  $scope.ws = null;
  $scope.input = null;
  $scope.node = null;
  $scope.samplerate = 22050;
  $scope.samplerates = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
  $scope.bitrate = 64;
  $scope.bitrates = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320];
  $scope.recordings = [];
  $scope.test = 0;
  $scope.server = false;
  $scope.time = 0;
  $scope.printTime = '';
  var buffer = new Uint8Array();

  var _appendBuffer = function (buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  };

  $scope.startRecording = function () {
    if ($scope.recording)
      return;
    console.log('start recording');
    $scope.encoder = new Worker('scripts/worker/encoder.js');
    console.log('initializing encoder with samplerate = ' + $scope.samplerate + ' and bitrate = ' + $scope.bitrate);
    $scope.encoder.postMessage({cmd: 'init', config: {samplerate: $scope.samplerate, bitrate: $scope.bitrate}});

    $scope.encoder.onmessage = function (e) {
      //$scope.ws.send(e.data.buf);
      buffer = _appendBuffer(buffer, e.data.buf);
      if (e.data.cmd == 'end') {
        //$scope.ws.close();
        //$scope.ws = null;
        $scope.encoder.terminate();
        $scope.encoder = null;

        $scope.time = 0;

        $scope.recordings.push({
          url: 'data:audio/mp3;base64,' + encode64(buffer),
          name: 'audio_recording_' + new Date().getTime() + '.mp3'
        });
        buffer = new Uint8Array();

        $scope.$apply();
      } else {
        $timeout(updateTime, 100);
      }
    };

    //This can be used with a WebSocket
    //$scope.ws = new WebSocket("ws://" + window.location.host + "/ws/audio");
    //$scope.ws.onopen = function() {
    $scope.initializeMedia();
    //};

    function encode64(buffer) {
      var binary = '',
        bytes = new Uint8Array(buffer),
        len = bytes.byteLength;

      for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    function convertTime(millseconds) {
      var seconds = Math.floor(millseconds / 1000);
      var roundSeconds = seconds % 60;
      var days = Math.floor(seconds / 86400);
      var hours = Math.floor((seconds % 86400) / 3600);
      var minutes = Math.floor(((seconds % 86400) % 3600) / 60);
      var timeString = '';
      if (days > 0) timeString += (days > 1) ? (days + " days ") : (days + " day ");
      if (hours > 0) timeString += (hours > 1) ? (hours + " hours ") : (hours + " hour ");
      if (minutes >= 0) timeString += (minutes > 1) ? (minutes + " minutes ") : (minutes + " minute ");
      if (roundSeconds >= 0) timeString += (roundSeconds > 1) ? (roundSeconds + " seconds ") : (roundSeconds + " second ");
      return timeString;
    }

    function updateTime() {
        $scope.time += 100;
        $scope.printTime = convertTime($scope.time);
    }

  };

  $scope.userMediaFailed = function (code) {
    console.log('grabbing microphone failed: ' + code);
    alert('To record we need access to your microphone');
  };

  $scope.initializeMedia = function () {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!navigator.getUserMedia) {
      alert('You\'re browser doesn\'t support recording');
    } else {
      navigator.getUserMedia({video: false, audio: true}, $scope.gotUserMedia, $scope.userMediaFailed);
    }
  };

  $scope.gotUserMedia = function (localMediaStream) {
    $scope.recording = true;
    $scope.recordButtonStyle = '';

    console.log('success grabbing microphone');
    $scope.stream = localMediaStream;

    var audio_context = new window.AudioContext();

    $scope.input = audio_context.createMediaStreamSource($scope.stream);
    $scope.node = $scope.input.context.createScriptProcessor(4096, 1, 1);

    console.log('sampleRate: ' + $scope.input.context.sampleRate);

    $scope.node.onaudioprocess = function (e) {
      if (!$scope.recording)
        return;
      var channelLeft = e.inputBuffer.getChannelData(0);
      $scope.encoder.postMessage({cmd: 'encode', buf: channelLeft});
    };

    $scope.input.connect($scope.node);
    $scope.node.connect(audio_context.destination);

    $scope.$apply();
  };

  $scope.stopRecording = function () {
    if (!$scope.recording) {
      return;
    }
    console.log('stop recording');
    $scope.stream.stop();
    $scope.recording = false;
    $scope.encoder.postMessage({cmd: 'finish'});

    $scope.input.disconnect();
    $scope.node.disconnect();
    $scope.input = $scope.node = null;
  };

}]);

