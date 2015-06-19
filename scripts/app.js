'use strict';

/**
 * @ngdoc overview
 * @name audioRecordingApp
 * @description
 * # audioRecordingApp
 *
 * Main module of the application.
 */
angular
  .module('audioRecordingApp', [
    'ngAnimate',
    'ngAria',
    'ngCookies',
    'ngMessages',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/record.html',
        controller: 'RecordCtrl'
      })
      .when('/play', {
        templateUrl: 'views/play.html',
        controller: 'PlayCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
