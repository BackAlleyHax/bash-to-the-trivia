angular.module('app.profile', [])

.controller('ProfileController', function($scope, UserInfo, $location, Upload, $timeout) {

  $scope.user = UserInfo.user;
  $scope.rooms = UserInfo.rooms;
  $scope.avatar = UserInfo.user.avatar;

  $scope.uploadAvatar = function(file) {
    UserInfo.uploadAvatar(file, $scope);
  };
});
