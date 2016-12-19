angular.module('app.profile', [])

.controller('ProfileController', function($scope, UserInfo, $location, Upload, $timeout) {

  $scope.user = UserInfo.user;
  $scope.rooms = UserInfo.rooms;
  $scope.avatar = UserInfo.user.avatar;

  $scope.uploadAvatar = function(file) {
    $scope.file = file;
    if (file) {
      console.log(file);
      Upload.upload({
        url: 'api/profile/upload/',
        method: 'POST',
        data: {avatar: file, username: $scope.user.username},
      })
      .then(function (response) {
        console.log(response);
        $scope.avatar = response.data;
      });
    }
  };
});
