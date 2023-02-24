/*
阿里云盘自动签到工具
*/

const accesssTokenURL = "https://auth.aliyundrive.com/v2/account/token";
const siginURL = "https://member.aliyundrive.com/v1/activity/sign_in_list";
const pushUrl = 'http://www.pushplus.plus/send';
const pushToken = '';
const refreshTokenList = getRefreshTokens();

function getRefreshTokens() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getRange(1,1,sheet.getLastRow()).getValues();
  return range.map(function(i) {return i[0];});
}

function sendNotify(message) {
  UrlFetchApp.fetch(pushUrl, {
    'method': 'post',
    'contentType': 'application/json; charset=UTF-8',
    'payload': JSON.stringify({
      'token': pushToken,
      'title': '阿里云盘签到',
      'content': message,
      'template': 'json'
    })
  })
}

function aliyunCheckin() {
  var message = {};
  for (var index = 0; index < refreshTokenList.length; index ++) {
    var queryBody = {
      'grant_type': 'refresh_token',
      'refresh_token': refreshTokenList[index]
    };
    //使用refreshtoken 更新 accesstoken
    try {
      var res = UrlFetchApp.fetch(accesssTokenURL,{
        'method': 'POST',
        'contentType': 'application/json; charset=UTF-8',
        'payload': JSON.stringify(queryBody)
      });
    } catch(e) {
      //Logger.log('获取access token发生错误：' + e);
      break;
    };
    var accessToken = JSON.parse(res)["access_token"];
    var nickName = JSON.parse(res)['nick_name'];
    //签到
    try {
      var checkin = UrlFetchApp.fetch(siginURL,{
        'method': 'POST',
        'contentType': 'application/json; charset=UTF-8',
        'payload': JSON.stringify(queryBody),
        'headers': {
          'Authorization': 'Bearer '+ accessToken
        }
      });
    } catch(e) {
      //Logger.log('签到失败，错误信息：' + e);
      break;
    };
    var checkinInfo = JSON.parse(checkin);
    //Logger.log(JSON.stringify(checkinInfo,null,2));
    var {signInLogs,signInCount} = checkinInfo.result;
    var signInArray = signInLogs.filter(function(day) {
      return day.status === 'normal';
    });
    var currentSignIn = signInArray[signInCount - 1]
    if (currentSignIn.reward === null) {
      var signInReward = '毛都没有！';
    } else {
      var signInReward = currentSignIn.reward.name + currentSignIn.reward.description;
    };
    var checkinData = {};
    checkinData['账号' + ': ' + nickName] = {
      '签到奖励': signInReward,
      '本月已经签到': signInCount,
      '执行时间': Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss")
    };
    message = Object.assign({},message,checkinData);
  sendNotify(message);
}
